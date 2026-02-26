/**
 * Bundler 客户端
 * 
 * 负责与 ERC-4337 Bundler 服务交互
 * 支持多服务商故障转移
 */

import { UserOperation } from '@/types';
import type { Address, Hash } from 'viem';
import { rpcClientManager } from '@/utils/RpcClientManager';
import { requireChainConfig } from '@/utils/chainConfigValidation';

const ENTRYPOINT_HANDLE_OPS_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'callGasLimit', type: 'uint256' },
          { name: 'verificationGasLimit', type: 'uint256' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'maxFeePerGas', type: 'uint256' },
          { name: 'maxPriorityFeePerGas', type: 'uint256' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
        name: 'ops',
        type: 'tuple[]',
      },
      { name: 'beneficiary', type: 'address' },
    ],
    name: 'handleOps',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export class BundlerUnavailableError extends Error {
  code = 'BUNDLER_UNAVAILABLE';
  constructor(message: string) {
    super(message);
    this.name = 'BundlerUnavailableError';
  }
}

export interface BundlerConfig {
  url: string;
  name: string;
  priority: number; // 优先级，数字越小优先级越高
  chainId?: number; // 关联的链ID，用于获取EntryPoint地址
}

export class BundlerClient {
  private bundlers: BundlerConfig[] = [];
  private currentBundler: BundlerConfig | null = null;
  private currentChainId: number | null = null;

  /**
   * 添加 Bundler 服务
   */
  addBundler(config: BundlerConfig): void {
    this.bundlers.push(config);
    this.bundlers.sort((a, b) => a.priority - b.priority);
    
    // 如果没有当前 Bundler，设置为第一个
    if (!this.currentBundler) {
      this.currentBundler = this.bundlers[0];
    }
  }

  /**
   * 确保 bundler 已注册（幂等）
   */
  ensureBundler(config: BundlerConfig): void {
    const exists = this.bundlers.some((b) => b.url === config.url);
    if (!exists) {
      this.addBundler(config);
    }
  }

  /**
   * 设置当前使用的 Bundler
   */
  setBundler(url: string, chainId?: number): void {
    const bundler = this.bundlers.find((b) => b.url === url);
    if (bundler) {
      this.currentBundler = bundler;
      if (chainId) {
        this.currentChainId = chainId;
      }
    }
  }

  /**
   * 设置当前链ID（用于获取EntryPoint地址）
   */
  setChainId(chainId: number): void {
    this.currentChainId = chainId;
  }

  /**
   * 发送 UserOperation
   * 
   * 优先使用 currentBundler，如果失败则尝试其他 bundlers
   */
  async sendUserOperation(userOp: UserOperation, chainId?: number): Promise<Hash> {
    if (this.bundlers.length === 0) {
      throw new BundlerUnavailableError('No bundler configured');
    }

    const entryPointAddress = this.getEntryPointAddress(chainId);

    // 构建尝试列表：优先使用 currentBundler
    const bundlersToTry: BundlerConfig[] = [];
    if (this.currentBundler) {
      bundlersToTry.push(this.currentBundler);
    }
    // 添加其他 bundlers（排除已添加的 currentBundler）
    for (const bundler of this.bundlers) {
      if (bundler.url !== this.currentBundler?.url) {
        bundlersToTry.push(bundler);
      }
    }

    // 如果 currentBundler 未设置，使用列表顺序
    if (bundlersToTry.length === 0) {
      bundlersToTry.push(...this.bundlers);
    }

    // 尝试发送，如果失败则尝试下一个
    let lastError: Error | null = null;
    for (const bundler of bundlersToTry) {
      try {
        const hash = await this.sendToBundler(userOp, bundler.url, entryPointAddress);
        // 成功时更新 currentBundler
        this.currentBundler = bundler;
        return hash;
      } catch (error) {
        console.warn(`Bundler ${bundler.name} failed, trying next...`, error);
        lastError = error as Error;
        continue;
      }
    }

    throw new BundlerUnavailableError(`All bundlers failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * 发送到指定的 Bundler
   */
  private async sendToBundler(userOp: UserOperation, bundlerUrl: string, entryPointAddress: string): Promise<Hash> {
    // ERC-4337 Bundler RPC 格式
    // method: eth_sendUserOperation
    // params: [userOp, entryPointAddress]
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'eth_sendUserOperation',
      params: [this.formatUserOperation(userOp), entryPointAddress],
    };

    const response = await fetch(bundlerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bundler request failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message || `Bundler error: ${JSON.stringify(result.error)}`);
    }

    return result.result as Hash;
  }

  /**
   * 获取 EntryPoint 地址
   * 从链配置中获取，如果未配置则使用默认地址
   */
  private getEntryPointAddress(chainId?: number): string {
    const targetChainId = chainId || this.currentChainId;
    if (targetChainId) {
      try {
        const chainConfig = requireChainConfig(targetChainId, ['entryPointAddress']);
        return chainConfig.entryPointAddress;
      } catch {
        // 保留降级路径，避免估算流程因配置缺失直接中断
      }
    }
    // 降级方案：使用标准的 EntryPoint 地址（ERC-4337 v0.6）
    return '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
  }

  /**
   * 估算 UserOperation Gas
   */
  async estimateUserOperationGas(userOp: UserOperation, chainId?: number): Promise<{
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
  }> {
    if (!this.currentBundler) {
      throw new BundlerUnavailableError('No bundler configured');
    }

    const entryPointAddress = this.getEntryPointAddress(chainId);
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'eth_estimateUserOperationGas',
      params: [this.formatUserOperation(userOp), entryPointAddress],
    };

    const response = await fetch(this.currentBundler.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bundler request failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message || `Bundler error: ${JSON.stringify(result.error)}`);
    }

    // 处理不同格式的返回值
    const gasResult = result.result;
    return {
      callGasLimit: typeof gasResult.callGasLimit === 'string' 
        ? BigInt(gasResult.callGasLimit) 
        : BigInt(gasResult.callGasLimit || 0),
      verificationGasLimit: typeof gasResult.verificationGasLimit === 'string'
        ? BigInt(gasResult.verificationGasLimit)
        : BigInt(gasResult.verificationGasLimit || 0),
      preVerificationGas: typeof gasResult.preVerificationGas === 'string'
        ? BigInt(gasResult.preVerificationGas)
        : BigInt(gasResult.preVerificationGas || 0),
    };
  }

  /**
   * 格式化 UserOperation 为 Bundler 期望的格式
   */
  private formatUserOperation(userOp: UserOperation): unknown {
    return {
      sender: userOp.sender,
      nonce: `0x${userOp.nonce.toString(16)}`,
      initCode: userOp.initCode,
      callData: userOp.callData,
      callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
      verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
      preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
      maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(bundlerUrl?: string): Promise<boolean> {
    const url = bundlerUrl || this.currentBundler?.url;
    if (!url) {
      return false;
    }

    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      // 如果 /health 端点不存在，尝试 ping 端点
      try {
        const response = await fetch(`${url}/ping`, {
          method: 'GET',
        });
        return response.ok;
      } catch {
        return false;
      }
    }
  }

  /**
   * 获取 UserOperation 状态
   */
  async getUserOperationReceipt(userOpHash: Hash): Promise<unknown> {
    if (!this.currentBundler) {
      throw new Error('No bundler configured');
    }

    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'eth_getUserOperationReceipt',
      params: [userOpHash],
    };

    const response = await fetch(this.currentBundler.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bundler request failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message || `Bundler error: ${JSON.stringify(result.error)}`);
    }

    return result.result;
  }

  /**
   * 降级模式：直发 EntryPoint + 自付 Gas
   * 
   * 当所有 Bundler 不可用时，直接调用 EntryPoint 合约的 handleOps 方法
   * 用户需要自付 Gas，账户需要有足够的余额
   * 
   * 注意：
   * - 需要用户确认（因为需要自付 Gas）
   * - 需要检查账户余额
   * - 需要重新计算 userOpHash（防止签名重放）
   * 
   * @param userOp UserOperation 对象
   * @param chainId 链 ID
   * @param signerPrivateKey 签名者私钥（用于发送交易，需要账户有余额）
   * @returns 交易哈希
   */
  async sendUserOperationDirectly(
    userOp: UserOperation,
    chainId: number,
    signerPrivateKey: `0x${string}`
  ): Promise<Hash> {
    const chainConfig = requireChainConfig(chainId, ['entryPointAddress', 'rpcUrl']);

    const entryPointAddress = chainConfig.entryPointAddress as Address;
    const rpcUrl = chainConfig.rpcUrl;

    // 导入必要的模块
    const { createWalletClient, http } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');

    // 创建钱包客户端
    const account = privateKeyToAccount(signerPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain: rpcClientManager.getChain(chainId),
      transport: http(rpcUrl),
    });

    // 重新计算 userOpHash（防止签名重放）
    // 注意：如果切换了 RPC，需要重新计算 hash，但签名是基于原始 hash 的
    // 这里我们假设 userOp 已经正确签名，直接使用
    const { getUserOpHash } = await import('@/utils/eip712');
    getUserOpHash(userOp, entryPointAddress, chainId);

    const txHash = await walletClient.writeContract({
      address: entryPointAddress,
      abi: ENTRYPOINT_HANDLE_OPS_ABI,
      functionName: 'handleOps',
      args: [
        [this.formatUserOperationForEntryPoint(userOp)],
        account.address, // beneficiary（接收 Gas 退款）
      ],
      gas: userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas + BigInt(50000),
      chain: rpcClientManager.getChain(chainId),
    });

    return txHash;
  }

  /**
   * 格式化 UserOperation 为 EntryPoint 期望的格式
   * 
   * EntryPoint.handleOps 接收的 UserOperation 格式与 Bundler 略有不同
   */
  private formatUserOperationForEntryPoint(userOp: UserOperation): UserOperation {
    return {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: userOp.initCode,
      callData: userOp.callData,
      callGasLimit: userOp.callGasLimit,
      verificationGasLimit: userOp.verificationGasLimit,
      preVerificationGas: userOp.preVerificationGas,
      maxFeePerGas: userOp.maxFeePerGas,
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    };
  }

  /**
   * 降级模式：估算直发 EntryPoint 的 Gas
   * 
   * 估算直接调用 EntryPoint.handleOps 所需的 Gas
   * 
   * @param userOp UserOperation 对象
   * @param chainId 链 ID
   * @returns 估算的 Gas 限制
   */
  async estimateDirectGas(
    userOp: UserOperation,
    chainId: number
  ): Promise<bigint> {
    const chainConfig = requireChainConfig(chainId, ['entryPointAddress', 'rpcUrl']);

    const entryPointAddress = chainConfig.entryPointAddress as Address;
    const rpcUrl = chainConfig.rpcUrl;

    // 导入必要的模块
    const { createPublicClient, http, encodeFunctionData } = await import('viem');

    // 创建公共客户端
    const publicClient = createPublicClient({
      chain: rpcClientManager.getChain(chainId),
      transport: http(rpcUrl),
    });

    // 构造 handleOps 调用数据
    const callData = encodeFunctionData({
      abi: ENTRYPOINT_HANDLE_OPS_ABI,
      functionName: 'handleOps',
      args: [
        [this.formatUserOperationForEntryPoint(userOp)],
        userOp.sender, // beneficiary（临时使用 sender 地址）
      ],
    });

    try {
      // 估算 Gas
      const gasEstimate = await publicClient.estimateGas({
        to: entryPointAddress,
        data: callData,
        account: userOp.sender as Address,
      });

      // 添加缓冲（20%）
      return gasEstimate + (gasEstimate * BigInt(20)) / BigInt(100);
    } catch (error) {
      console.warn('Gas estimation failed, using fallback:', error);
      // 降级方案：使用 UserOperation 的 Gas 限制加上缓冲
      return userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas + BigInt(100000);
    }
  }
}

export const bundlerClient = new BundlerClient();
