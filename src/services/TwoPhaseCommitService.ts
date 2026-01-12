/**
 * 两阶段提交服务
 * 
 * 负责管理两阶段提交任务
 * 支持提交承诺哈希、监控状态、揭示数据等功能
 */

import type { Address, Hash, Hex } from 'viem';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { TwoPhaseCommitTask, TwoPhaseCommitTaskStatus } from '@/types';
import { getChainConfigByChainId } from '@/config/chains';
import { storageAdapter } from '@/adapters/StorageAdapter';
import { StorageKey } from '@/types';
import { transactionRelayer } from './TransactionRelayer';
import { accountManager } from './AccountManager';
import { twoPhaseCommitEncryption } from './TwoPhaseCommitEncryption';

/**
 * 两阶段提交合约标准 ABI
 * 
 * 基于设计文档中的标准接口：
 * - commit(bytes32 commitmentHash, bytes calldata defaultValue)
 * - reveal(bytes calldata originalData)
 * - canReveal(bytes32 commitmentHash) view returns (bool)
 * - getCommitmentStatus(bytes32 commitmentHash) view returns (...)
 */
const TWO_PHASE_COMMIT_ABI = [
  {
    inputs: [
      { name: 'commitmentHash', type: 'bytes32' },
      { name: 'defaultValue', type: 'bytes' },
    ],
    name: 'commit',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'originalData', type: 'bytes' }],
    name: 'reveal',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'commitmentHash', type: 'bytes32' }],
    name: 'canReveal',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'commitmentHash', type: 'bytes32' }],
    name: 'getCommitmentStatus',
    outputs: [
      { name: 'committer', type: 'address' },
      { name: 'isCommitted', type: 'bool' },
      { name: 'isRevealed', type: 'bool' },
      { name: 'defaultValue', type: 'bytes' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * 两阶段提交服务
 */
export class TwoPhaseCommitService {
  private monitoringTasks: Map<string, NodeJS.Timeout> = new Map();
  private useServiceWorker: boolean = false;
  
  /**
   * 初始化服务
   * 
   * 尝试启用 Service Worker 监控（如果支持）
   */
  async init(): Promise<void> {
    // 尝试初始化 Service Worker 监控
    try {
      if ('serviceWorker' in navigator) {
        const { monitoringServiceWorker } = await import('@/serviceWorker/MonitoringServiceWorker');
        await monitoringServiceWorker.init();
        
        // 监听 Service Worker 消息
        monitoringServiceWorker.onMessage('TASK_READY_TO_REVEAL', (data: { taskId: string }) => {
          this.handleTaskReadyToReveal(data.taskId);
        });
        
        // 监听来自 Service Worker 的检查请求
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'CHECK_TASK_STATUS') {
              this.handleServiceWorkerCheckRequest(event.data);
            }
          });
        }
        
        this.useServiceWorker = monitoringServiceWorker.isAvailable();
      }
    } catch (error) {
      console.warn('[TwoPhaseCommitService] Service Worker not available, using fallback:', error);
      this.useServiceWorker = false;
    }
  }

  /**
   * 生成承诺哈希
   * 
   * 根据原始数据生成承诺哈希（SHA-256）
   * 用于两阶段提交的第一阶段
   * 
   * @param data 原始数据（字符串或 hex）
   * @returns 承诺哈希（0x 前缀的 hex 字符串）
   * 
   * @example
   * ```typescript
   * const commitmentHash = await service.generateCommitmentHash('my secret data');
   * // 使用 commitmentHash 调用合约的 commit 方法
   * ```
   */
  async generateCommitmentHash(data: string | Hex): Promise<Hash> {
    // 将数据转换为字节数组
    let dataBytes: Uint8Array;
    
    if (typeof data === 'string' && data.startsWith('0x')) {
      // hex 字符串
      const hex = data.slice(2);
      dataBytes = new Uint8Array(
        hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );
    } else if (typeof data === 'string') {
      // 普通字符串
      const encoder = new TextEncoder();
      dataBytes = encoder.encode(data);
    } else {
      throw new Error('Invalid data type');
    }

    // 计算 SHA-256 哈希
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = `0x${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`;

    return hashHex as Hash;
  }

  /**
   * 创建两阶段提交任务
   * 
   * 在承诺阶段，加密原始数据并保存到任务中
   * 
   * @param chainId 链 ID
   * @param contractAddress 两阶段提交合约地址
   * @param commitmentHash 承诺哈希
   * @param firstPhaseTxHash 第一阶段交易哈希
   * @param originalData 原始数据（需要加密保存，用于后续揭示）
   * @param accountAddress 账户地址（可选，如果不提供则从 AccountManager 获取）
   * @param signerPrivateKey 签名者私钥（用于后续 reveal，可选）
   * @returns 创建的任务
   */
  async createTask(
    chainId: number,
    contractAddress: Address,
    commitmentHash: Hash,
    firstPhaseTxHash: Hash,
    originalData: string | Hex,
    accountAddress?: Address,
    signerPrivateKey?: `0x${string}`
  ): Promise<TwoPhaseCommitTask> {
    // 如果没有提供账户地址，从 AccountManager 获取
    let finalAccountAddress = accountAddress;
    if (!finalAccountAddress) {
      const accounts = await accountManager.getAllAccounts();
      const account = accounts.find(a => a.chainId === chainId);
      if (account) {
        finalAccountAddress = account.address as Address;
      }
    }

    // 加密原始数据（使用三特征密钥系统）
    let encryptedData;
    try {
      encryptedData = await twoPhaseCommitEncryption.encryptData(originalData);
    } catch (error) {
      console.error('数据加密失败:', error);
      throw new Error(`数据加密失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const task: TwoPhaseCommitTask = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chainId,
      contractAddress,
      accountAddress: finalAccountAddress,
      firstPhaseTxHash,
      commitmentHash,
      encryptedData, // 保存加密后的数据
      status: 'pending',
      createdAt: Date.now(),
    };

    // 保存到本地存储
    await this.saveTask(task);

    // 启动监控
    await this.startMonitoring(task);

    return task;
  }

  /**
   * 获取所有任务
   */
  async getAllTasks(): Promise<TwoPhaseCommitTask[]> {
    const tasks = await storageAdapter.get<TwoPhaseCommitTask[]>(StorageKey.TWO_PHASE_COMMIT_TASKS);
    return tasks || [];
  }

  /**
   * 获取任务
   */
  async getTask(taskId: string): Promise<TwoPhaseCommitTask | null> {
    const tasks = await this.getAllTasks();
    return tasks.find((t) => t.id === taskId) || null;
  }

  /**
   * 揭示数据
   * 
   * 当条件满足时，解密数据并调用合约的 reveal 方法
   * 
   * @param taskId 任务ID
   * @param signerPrivateKey 签名者私钥
   * @param overrideData 可选：覆盖数据（如果不提供，则从任务中解密）
   * @returns 交易哈希
   */
  async reveal(
    taskId: string,
    signerPrivateKey: `0x${string}`,
    overrideData?: string
  ): Promise<Hash> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status !== 'ready_to_reveal') {
      throw new Error(`Task is not ready to reveal. Current status: ${task.status}`);
    }

    // 更新任务状态
    task.status = 'revealing';
    await this.saveTask(task);

    try {
      // 获取原始数据
      let originalData: string;

      if (overrideData) {
        // 使用提供的数据
        originalData = overrideData;
      } else if (task.encryptedData) {
        // 从加密数据中解密
        try {
          originalData = await twoPhaseCommitEncryption.decryptData(task.encryptedData);
        } catch (error) {
          throw new Error(`数据解密失败: ${error instanceof Error ? error.message : 'Unknown error'}. 请确保使用相同的用户ID和系统环境。`);
        }
      } else {
        throw new Error('任务中没有保存的加密数据，且未提供原始数据');
      }

      // 构造 reveal 调用数据
      // 注意：reveal 方法接收的是 bytes，需要将字符串转换为 hex
      let dataHex: Hex;
      if (originalData.startsWith('0x')) {
        dataHex = originalData as Hex;
      } else {
        // 将字符串转换为 hex（使用 TextEncoder）
        const encoder = new TextEncoder();
        const bytes = encoder.encode(originalData);
        const hexString = Array.from(bytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        dataHex = `0x${hexString}` as Hex;
      }

      const callData = await this.encodeRevealCallData(dataHex);

      // 获取账户地址
      // 优先使用任务中保存的账户地址
      let accountAddress: Address;
      
      if (task.accountAddress) {
        accountAddress = task.accountAddress as Address;
      } else {
        // 降级方案：从 AccountManager 获取
        const accounts = await accountManager.getAllAccounts();
        const account = accounts.find(a => a.chainId === task.chainId);
        
        if (!account) {
          throw new Error(`No account found for chainId: ${task.chainId}`);
        }
        
        accountAddress = account.address as Address;
        
        // 更新任务，保存账户地址
        task.accountAddress = accountAddress;
        await this.saveTask(task);
      }

      // 发送交易
      const txHash = await transactionRelayer.sendTransaction(
        accountAddress,
        task.chainId,
        task.contractAddress,
        callData,
        signerPrivateKey
      );

      // 更新任务状态
      task.status = 'revealed';
      task.revealedAt = Date.now();
      task.revealedTxHash = txHash;
      await this.saveTask(task);

      // 停止监控
      await this.stopMonitoring(task.id);

      return txHash;
    } catch (error) {
      // 恢复状态
      task.status = 'ready_to_reveal';
      await this.saveTask(task);
      throw error;
    }
  }

  /**
   * 启动监控
   * 
   * 优先使用 Service Worker 进行后台监控
   * 如果不支持 Service Worker，则使用 setInterval 作为降级方案
   */
  private async startMonitoring(task: TwoPhaseCommitTask): Promise<void> {
    // 停止之前的监控（如果存在）
    await this.stopMonitoring(task.id);

    // 更新状态
    task.status = 'monitoring';
    await this.saveTask(task);

    // 优先使用 Service Worker 监控
    if (this.useServiceWorker) {
      try {
        const { monitoringServiceWorker } = await import('@/serviceWorker/MonitoringServiceWorker');
        const chainConfig = getChainConfigByChainId(task.chainId);
        
        if (chainConfig) {
          await monitoringServiceWorker.startMonitoring({
            taskId: task.id,
            chainId: task.chainId,
            contractAddress: task.contractAddress,
            commitmentHash: task.commitmentHash,
            rpcUrl: chainConfig.rpcUrl,
            interval: 5000,
          });
          return;
        }
      } catch (error) {
        console.warn('[TwoPhaseCommitService] Service Worker monitoring failed, using fallback:', error);
        this.useServiceWorker = false;
      }
    }

    // 降级方案：使用 setInterval（需要页面保持打开）
    const interval = setInterval(async () => {
      try {
        const canReveal = await this.checkCanReveal(task);
        if (canReveal) {
          task.status = 'ready_to_reveal';
          await this.saveTask(task);
          await this.stopMonitoring(task.id);

          // 触发事件通知用户
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('two-phase-commit:ready-to-reveal', {
                detail: { taskId: task.id },
              })
            );
          }
        }
      } catch (error) {
        console.error(`Error monitoring task ${task.id}:`, error);
      }
    }, 5000); // 每5秒检查一次

    this.monitoringTasks.set(task.id, interval);
  }
  
  /**
   * 处理任务准备好揭示
   */
  private async handleTaskReadyToReveal(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) {
      return;
    }

    task.status = 'ready_to_reveal';
    await this.saveTask(task);
    await this.stopMonitoring(taskId);

    // 触发事件通知用户
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('two-phase-commit:ready-to-reveal', {
          detail: { taskId: task.id },
        })
      );
    }
  }
  
  /**
   * 处理来自 Service Worker 的检查请求
   */
  private async handleServiceWorkerCheckRequest(data: {
    taskId: string;
    chainId: number;
    contractAddress: string;
    commitmentHash: string;
    rpcUrl: string;
  }): Promise<void> {
    try {
      const canReveal = await this.checkCanRevealByParams(
        data.chainId,
        data.contractAddress,
        data.commitmentHash,
        data.rpcUrl
      );

      // 发送结果回 Service Worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'TASK_STATUS_CHECK_RESULT',
          data: {
            taskId: data.taskId,
            canReveal,
          },
        });
      }
    } catch (error) {
      console.error('[TwoPhaseCommitService] Error handling Service Worker check request:', error);
    }
  }
  
  /**
   * 根据参数检查是否可以揭示
   */
  private async checkCanRevealByParams(
    chainId: number,
    contractAddress: string,
    commitmentHash: string,
    rpcUrl: string
  ): Promise<boolean> {
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    try {
      const canReveal = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: TWO_PHASE_COMMIT_ABI,
        functionName: 'canReveal',
        args: [commitmentHash as `0x${string}`],
      });

      return canReveal as boolean;
    } catch (error) {
      // 降级方案：使用 getCommitmentStatus
      try {
        const status = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: TWO_PHASE_COMMIT_ABI,
          functionName: 'getCommitmentStatus',
          args: [commitmentHash as `0x${string}`],
        });

        return (status as any).isCommitted && !(status as any).isRevealed;
      } catch (fallbackError) {
        console.error('Error checking commitment status:', fallbackError);
        return false;
      }
    }
  }

  /**
   * 停止监控
   */
  private async stopMonitoring(taskId: string): Promise<void> {
    // 停止 setInterval 监控（如果存在）
    const interval = this.monitoringTasks.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.monitoringTasks.delete(taskId);
    }

    // 停止 Service Worker 监控
    if (this.useServiceWorker) {
      try {
        const { monitoringServiceWorker } = await import('@/serviceWorker/MonitoringServiceWorker');
        await monitoringServiceWorker.stopMonitoring(taskId);
      } catch (error) {
        console.warn('[TwoPhaseCommitService] Failed to stop Service Worker monitoring:', error);
      }
    }
  }

  /**
   * 检查是否可以揭示
   * 
   * 调用合约的 canReveal 方法检查是否可以揭示
   * 
   * @param task 两阶段提交任务
   * @returns 是否可以揭示
   */
  private async checkCanReveal(task: TwoPhaseCommitTask): Promise<boolean> {
    const chainConfig = getChainConfigByChainId(task.chainId);
    if (!chainConfig) {
      return false;
    }

    const publicClient = createPublicClient({
      transport: http(chainConfig.rpcUrl),
    });

    try {
      // 调用合约的 canReveal 方法
      const canReveal = await publicClient.readContract({
        address: task.contractAddress,
        abi: TWO_PHASE_COMMIT_ABI,
        functionName: 'canReveal',
        args: [task.commitmentHash],
      });

      return canReveal as boolean;
    } catch (error) {
      console.error('Error checking can reveal:', error);
      // 如果合约不支持 canReveal 方法，尝试使用 getCommitmentStatus
      try {
        const status = await publicClient.readContract({
          address: task.contractAddress,
          abi: TWO_PHASE_COMMIT_ABI,
          functionName: 'getCommitmentStatus',
          args: [task.commitmentHash],
        });
        
        // 如果已提交且未揭示，则可以揭示
        return (status as any).isCommitted && !(status as any).isRevealed;
      } catch (fallbackError) {
        console.error('Error checking commitment status:', fallbackError);
        return false;
      }
    }
  }

  /**
   * 编码 reveal 调用数据
   * 
   * 根据标准两阶段提交接口编码 reveal 方法调用
   * 
   * @param data 原始数据（hex 字符串）
   * @returns 编码后的调用数据
   */
  private async encodeRevealCallData(data: string): Promise<Hex> {
    return encodeFunctionData({
      abi: TWO_PHASE_COMMIT_ABI,
      functionName: 'reveal',
      args: [data as Hex],
    });
  }

  /**
   * 保存任务
   */
  private async saveTask(task: TwoPhaseCommitTask): Promise<void> {
    const tasks = await this.getAllTasks();
    const index = tasks.findIndex((t) => t.id === task.id);
    if (index >= 0) {
      tasks[index] = task;
    } else {
      tasks.push(task);
    }
    await storageAdapter.set(StorageKey.TWO_PHASE_COMMIT_TASKS, tasks);
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = 'cancelled';
    await this.saveTask(task);
    await this.stopMonitoring(taskId);
  }
}

export const twoPhaseCommitService = new TwoPhaseCommitService();

