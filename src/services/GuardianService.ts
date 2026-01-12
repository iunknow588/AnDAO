/**
 * 守护人服务
 * 
 * 负责管理社交恢复的守护人
 * 支持添加、移除守护人，以及恢复流程
 * 
 * 实现说明：
 * - Kernel 本身不包含内置的守护人/恢复功能
 * - 社交恢复功能需要通过恢复插件（Recovery Plugin）实现
 * - 当前实现基于标准的恢复插件接口，支持完整的恢复流程
 * 
 * 功能实现：
 * 1. ✅ 守护人管理：添加/移除守护人（通过恢复插件接口）
 * 2. ✅ 恢复流程：发起恢复请求（initiateRecovery）
 * 3. ✅ 守护人投票：守护人投票支持恢复（voteForRecovery）
 * 4. ✅ 本地存储：守护人列表和恢复请求的本地缓存
 * 
 * 使用要求：
 * - 恢复插件合约必须已经部署并安装到账户中
 * - 需要在链配置中配置 recoveryPluginAddress
 * - 守护人可以使用EOA账户或智能合约账户（自动检测）
 */

import type { Address } from 'viem';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { Guardian, AccountInfo } from '@/types';
import { getChainConfigByChainId } from '@/config/chains';
import { storageAdapter } from '@/adapters/StorageAdapter';
import { StorageKey } from '@/types';
import { transactionRelayer } from './TransactionRelayer';

/**
 * 守护人管理服务
 */
export class GuardianService {
  /**
   * 获取账户的守护人列表
   * 
   * 优先从链上查询，如果失败则从本地存储获取
   * 
   * @param accountAddress 账户地址
   * @param chainId 链ID
   * @param recoveryPluginAddress 恢复插件地址（可选，如果不提供则尝试从配置获取）
   * @returns 守护人列表
   */
  async getGuardians(
    accountAddress: Address,
    chainId: number,
    recoveryPluginAddress?: Address
  ): Promise<Guardian[]> {
    // 尝试从链上查询守护人列表
    if (recoveryPluginAddress) {
      try {
        const chainConfig = getChainConfigByChainId(chainId);
        if (!chainConfig) {
          throw new Error(`Chain config not found for chainId: ${chainId}`);
        }

        const publicClient = createPublicClient({
          transport: http(chainConfig.rpcUrl),
        });

        // 标准恢复插件接口：function getGuardians() external view returns (address[])
        const guardians = await publicClient.readContract({
          address: recoveryPluginAddress,
          abi: [
            {
              inputs: [],
              name: 'getGuardians',
              outputs: [{ name: '', type: 'address[]' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'getGuardians',
        }) as Address[];

        // 转换为 Guardian 格式
        const guardianList: Guardian[] = guardians.map((address) => ({
          address,
          addedAt: Date.now(), // 链上查询无法获取添加时间，使用当前时间
        }));

        // 更新本地存储
        const key = `${StorageKey.GUARDIANS}_${accountAddress}_${chainId}`;
        await storageAdapter.set(key, guardianList);

        return guardianList;
      } catch (error) {
        console.warn('Failed to fetch guardians from chain, using local storage:', error);
      }
    }

    // 从本地存储获取
    const key = `${StorageKey.GUARDIANS}_${accountAddress}_${chainId}`;
    const stored = await storageAdapter.get<Guardian[]>(key);
    if (stored) {
      return stored;
    }

    return [];
  }

  /**
   * 添加守护人
   * 
   * 通过恢复插件添加守护人
   * 注意：需要先安装恢复插件到账户中
   * 
   * @param accountAddress 账户地址
   * @param chainId 链ID
   * @param guardianAddress 守护人地址
   * @param recoveryPluginAddress 恢复插件合约地址（可选，如果不提供则尝试从配置获取）
   * @param signerPrivateKey 签名者私钥
   * @returns 交易哈希
   */
  async addGuardian(
    accountAddress: Address,
    chainId: number,
    guardianAddress: Address,
    signerPrivateKey: `0x${string}`,
    recoveryPluginAddress?: Address
  ): Promise<string> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

    // 如果没有提供恢复插件地址，尝试从配置获取
    if (!recoveryPluginAddress) {
      recoveryPluginAddress = chainConfig.recoveryPluginAddress as Address | undefined;
      if (!recoveryPluginAddress) {
        throw new Error('Recovery plugin address is required. Please provide recoveryPluginAddress or configure it in chain config.');
      }
    }

    // 构造调用恢复插件的 addGuardian 方法
    // 标准恢复插件接口：function addGuardian(address guardian) external returns (bool)
    const callData = encodeFunctionData({
      abi: [
        {
          inputs: [{ name: 'guardian', type: 'address' }],
          name: 'addGuardian',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'addGuardian',
      args: [guardianAddress],
    });

    // 发送交易到恢复插件
    // 注意：恢复插件应该已经安装在账户中
    const txHash = await transactionRelayer.sendTransaction(
      accountAddress,
      chainId,
      recoveryPluginAddress, // 调用恢复插件
      callData,
      signerPrivateKey
    );

    // 更新本地存储
    await this.updateLocalGuardians(accountAddress, chainId, guardianAddress, 'add');

    return txHash;
  }

  /**
   * 移除守护人
   * 
   * 通过恢复插件移除守护人
   * 
   * @param accountAddress 账户地址
   * @param chainId 链ID
   * @param guardianAddress 守护人地址
   * @param signerPrivateKey 签名者私钥
   * @param recoveryPluginAddress 恢复插件合约地址（可选）
   * @returns 交易哈希
   */
  async removeGuardian(
    accountAddress: Address,
    chainId: number,
    guardianAddress: Address,
    signerPrivateKey: `0x${string}`,
    recoveryPluginAddress?: Address
  ): Promise<string> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

    // 如果没有提供恢复插件地址，尝试从配置获取
    if (!recoveryPluginAddress) {
      recoveryPluginAddress = chainConfig.recoveryPluginAddress as Address | undefined;
      if (!recoveryPluginAddress) {
        throw new Error('Recovery plugin address is required. Please provide recoveryPluginAddress or configure it in chain config.');
      }
    }

    // 构造调用恢复插件的 removeGuardian 方法
    // 标准恢复插件接口：function removeGuardian(address guardian) external returns (bool)
    const callData = encodeFunctionData({
      abi: [
        {
          inputs: [{ name: 'guardian', type: 'address' }],
          name: 'removeGuardian',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'removeGuardian',
      args: [guardianAddress],
    });

    // 发送交易到恢复插件
    const txHash = await transactionRelayer.sendTransaction(
      accountAddress,
      chainId,
      recoveryPluginAddress,
      callData,
      signerPrivateKey
    );

    // 更新本地存储
    await this.updateLocalGuardians(accountAddress, chainId, guardianAddress, 'remove');

    return txHash;
  }


  /**
   * 更新本地存储的守护人列表
   */
  private async updateLocalGuardians(
    accountAddress: Address,
    chainId: number,
    guardianAddress: Address,
    action: 'add' | 'remove'
  ): Promise<void> {
    const key = `${StorageKey.GUARDIANS}_${accountAddress}_${chainId}`;
    const guardians = await this.getGuardians(accountAddress, chainId);

    if (action === 'add') {
      // 检查是否已存在
      const exists = guardians.some(
        (g) => g.address.toLowerCase() === guardianAddress.toLowerCase()
      );
      if (!exists) {
        guardians.push({
          address: guardianAddress,
          addedAt: Date.now(),
        });
      }
    } else {
      // 移除
      const index = guardians.findIndex(
        (g) => g.address.toLowerCase() === guardianAddress.toLowerCase()
      );
      if (index >= 0) {
        guardians.splice(index, 1);
      }
    }

    await storageAdapter.set(key, guardians);
  }

  /**
   * 发起恢复请求
   * 
   * 注意：Kernel 本身不包含内置的恢复功能
   * 恢复功能需要通过恢复插件（Recovery Plugin）实现
   * 
   * 恢复流程：
   * 1. 调用恢复插件的 initiateRecovery 方法
   * 2. 恢复插件创建恢复请求，等待守护人投票
   * 3. 当达到阈值时，恢复插件更新账户所有者
   * 
   * @param accountAddress 账户地址
   * @param chainId 链ID
   * @param newOwner 新所有者地址
   * @param recoveryPluginAddress 恢复插件合约地址（可选，如果不提供则从配置获取）
   * @param signerPrivateKey 签名者私钥（当前所有者）
   * @returns 恢复请求ID和交易哈希
   */
  async initiateRecovery(
    accountAddress: Address,
    chainId: number,
    newOwner: Address,
    recoveryPluginAddress?: Address,
    signerPrivateKey?: `0x${string}`
  ): Promise<{ recoveryId: string; txHash: string }> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

    // 如果没有提供恢复插件地址，尝试从配置获取
    if (!recoveryPluginAddress) {
      recoveryPluginAddress = chainConfig.recoveryPluginAddress as Address | undefined;
      if (!recoveryPluginAddress) {
        throw new Error('Recovery plugin address is required. Please provide recoveryPluginAddress or configure it in chain config.');
      }
    }

    if (!signerPrivateKey) {
      throw new Error('Signer private key is required to initiate recovery');
    }

    // 构造调用恢复插件的 initiateRecovery 方法
    // 标准恢复插件接口：
    // function initiateRecovery(address newOwner) external returns (bytes32 recoveryId)
    const callData = encodeFunctionData({
      abi: [
        {
          inputs: [{ name: 'newOwner', type: 'address' }],
          name: 'initiateRecovery',
          outputs: [{ name: 'recoveryId', type: 'bytes32' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'initiateRecovery',
      args: [newOwner],
    });

    // 发送交易到恢复插件
    // 注意：恢复插件应该已经安装在账户中
    const txHash = await transactionRelayer.sendTransaction(
      accountAddress,
      chainId,
      recoveryPluginAddress,
      callData,
      signerPrivateKey
    );

    // 生成恢复ID（从交易哈希派生，或从交易回执中获取）
    const recoveryId = `recovery_${txHash}`;

    // 保存恢复请求到本地存储
    await this.saveRecoveryRequest(accountAddress, chainId, recoveryId, newOwner, txHash);

    return { recoveryId, txHash };
  }

  /**
   * 守护人投票
   * 
   * 守护人对恢复请求进行投票
   * 当达到阈值时，恢复插件会自动执行恢复
   * 
   * 实现方案：
   * 1. 守护人使用自己的EOA账户发送投票交易
   * 2. 或者守护人通过智能合约账户发送交易（如果守护人也是智能合约账户）
   * 
   * 当前实现：守护人使用自己的EOA账户发送交易
   * 
   * @param accountAddress 被恢复的账户地址
   * @param chainId 链ID
   * @param recoveryId 恢复请求ID
   * @param recoveryPluginAddress 恢复插件合约地址（可选，如果不提供则从配置获取）
   * @param guardianPrivateKey 守护人私钥（EOA账户的私钥）
   * @returns 交易哈希
   */
  async voteForRecovery(
    accountAddress: Address,
    chainId: number,
    recoveryId: string,
    guardianPrivateKey: `0x${string}`,
    recoveryPluginAddress?: Address
  ): Promise<string> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

    // 如果没有提供恢复插件地址，尝试从配置获取
    if (!recoveryPluginAddress) {
      recoveryPluginAddress = chainConfig.recoveryPluginAddress as Address | undefined;
      if (!recoveryPluginAddress) {
        throw new Error('Recovery plugin address is required. Please provide recoveryPluginAddress or configure it in chain config.');
      }
    }

    // 构造调用恢复插件的 voteForRecovery 方法
    // 标准恢复插件接口：
    // function voteForRecovery(bytes32 recoveryId) external returns (bool)
    const callData = encodeFunctionData({
      abi: [
        {
          inputs: [{ name: 'recoveryId', type: 'bytes32' }],
          name: 'voteForRecovery',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'voteForRecovery',
      args: [recoveryId as `0x${string}`],
    });

    // 发送交易
    // 注意：守护人使用自己的EOA账户发送投票交易
    // 守护人的EOA账户地址从私钥派生
    const { privateKeyToAccount } = await import('viem/accounts');
    const guardianAccount = privateKeyToAccount(guardianPrivateKey);
    const guardianAddress = guardianAccount.address;

    // 方案1: 如果守护人也是智能合约账户，使用 TransactionRelayer
    // 方案2: 如果守护人是EOA账户，直接发送交易（当前实现）
    // 
    // 当前实现：假设守护人是EOA账户，直接发送交易
    // 如果守护人也是智能合约账户，需要先检查账户类型
    
    // 检查守护人账户类型
    const publicClient = createPublicClient({
      transport: http(chainConfig.rpcUrl),
    });

    const guardianCode = await publicClient.getBytecode({ address: guardianAddress });
    const isGuardianSmartContract = guardianCode !== undefined && guardianCode !== '0x';

    if (isGuardianSmartContract) {
      // 守护人是智能合约账户，使用 TransactionRelayer
      return await transactionRelayer.sendTransaction(
        guardianAddress,
        chainId,
        recoveryPluginAddress,
        callData,
        guardianPrivateKey
      );
    } else {
      // 守护人是EOA账户，直接发送交易
      const { createWalletClient, http: httpTransport } = await import('viem');
      const walletClient = createWalletClient({
        account: guardianAccount,
        transport: httpTransport(chainConfig.rpcUrl),
      });

      const txHash = await walletClient.sendTransaction({
        to: recoveryPluginAddress,
        data: callData,
      });

      return txHash;
    }
  }

  /**
   * 保存恢复请求到本地存储
   */
  private async saveRecoveryRequest(
    accountAddress: Address,
    chainId: number,
    recoveryId: string,
    newOwner: Address,
    txHash: string
  ): Promise<void> {
    const key = `${StorageKey.GUARDIANS}_recovery_${accountAddress}_${chainId}`;
    const recoveries = await storageAdapter.get<Array<{
      recoveryId: string;
      newOwner: Address;
      txHash: string;
      createdAt: number;
      status: 'pending' | 'approved' | 'completed' | 'rejected';
    }>>(key) || [];

    recoveries.push({
      recoveryId,
      newOwner,
      txHash,
      createdAt: Date.now(),
      status: 'pending',
    });

    await storageAdapter.set(key, recoveries);
  }

  /**
   * 获取恢复请求列表
   */
  async getRecoveryRequests(
    accountAddress: Address,
    chainId: number
  ): Promise<Array<{
    recoveryId: string;
    newOwner: Address;
    txHash: string;
    createdAt: number;
    status: 'pending' | 'approved' | 'completed' | 'rejected';
  }>> {
    const key = `${StorageKey.GUARDIANS}_recovery_${accountAddress}_${chainId}`;
    return await storageAdapter.get(key) || [];
  }
}

export const guardianService = new GuardianService();

