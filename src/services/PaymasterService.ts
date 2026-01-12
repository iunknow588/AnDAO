/**
 * Paymaster 服务
 * 
 * 负责 Paymaster 集成和 Gas 代付功能
 * 支持多种 Paymaster 策略
 */

import type { Address, Hex } from 'viem';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { getChainConfigByChainId } from '@/config/chains';
import { configStorage } from '@/adapters/StorageAdapter';
import { UserOperation } from '@/types';

export interface PaymasterConfig {
  address: Address;
  chainId: number;
  type: 'verifying' | 'sponsor' | 'custom';
}

/**
 * Paymaster 使用记录
 */
export interface PaymasterUsageRecord {
  txHash: string;
  chainId: number;
  paymasterAddress: Address;
  paymasterAndData: Hex;
  sender: Address;
  createdAt: number;
  status: 'pending' | 'success' | 'failed';
  note?: string;
}

/**
 * Paymaster 数据构造
 * 
 * 根据 Paymaster 类型构造不同的 paymasterAndData
 */
export class PaymasterService {
  private readonly HISTORY_KEY = 'paymaster_usage_history';

  /**
   * 构造 Paymaster 数据
   * 
   * @param userOp UserOperation
   * @param chainId 链ID
   * @param paymasterAddress Paymaster 地址（可选）
   * @returns paymasterAndData 字符串
   */
  async buildPaymasterData(
    userOp: UserOperation,
    chainId: number,
    paymasterAddress?: Address
  ): Promise<string> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

    // 如果没有指定 Paymaster 地址，使用链配置中的地址
    const pmAddress = paymasterAddress || (chainConfig.paymasterAddress as Address | undefined);
    if (!pmAddress) {
      // 没有 Paymaster，返回空数据
      return '0x';
    }

    // 根据 Paymaster 类型构造数据
    // 这里使用简单的验证 Paymaster 模式
    // 实际实现可能需要调用 Paymaster 合约的 getHash 方法
    const paymasterData = await this.getPaymasterHash(userOp, chainId, pmAddress);

    // paymasterAndData = paymasterAddress (20 bytes) + paymasterData (可变长度)
    return `${pmAddress}${paymasterData.slice(2)}` as Hex;
  }

  /**
   * 获取 Paymaster 哈希
   * 
   * 调用 Paymaster 合约的 getHash 方法获取验证数据
   */
  private async getPaymasterHash(
    userOp: UserOperation,
    chainId: number,
    paymasterAddress: Address
  ): Promise<Hex> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

    const publicClient = createPublicClient({
      transport: http(chainConfig.rpcUrl),
    });

    try {
      // 调用 Paymaster 的 getHash 方法
      // 注意：不同的 Paymaster 实现可能有不同的接口
      // 这里使用标准的 ERC-4337 Paymaster 接口
      const hash = await publicClient.readContract({
        address: paymasterAddress,
        abi: [
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
                name: 'userOp',
                type: 'tuple',
              },
            ],
            name: 'getHash',
            outputs: [{ name: '', type: 'bytes32' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'getHash',
        args: [this.formatUserOpForPaymaster(userOp)],
      });

      return hash as Hex;
    } catch (error) {
      console.warn('Failed to get Paymaster hash, using empty data:', error);
      // 降级方案：返回空数据
      return '0x' as Hex;
    }
  }

  /**
   * 格式化 UserOperation 为 Paymaster 期望的格式
   */
  private formatUserOpForPaymaster(userOp: UserOperation): any {
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
   * 检查是否可以使用 Paymaster
   */
  async canUsePaymaster(chainId: number): Promise<boolean> {
    const chainConfig = getChainConfigByChainId(chainId);
    return !!(chainConfig?.paymasterAddress);
  }

  /**
   * 获取 Paymaster 地址
   */
  getPaymasterAddress(chainId: number): Address | null {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig?.paymasterAddress) {
      return null;
    }
    return chainConfig.paymasterAddress as Address;
  }

  /**
   * 记录 Paymaster 使用历史
   */
  async recordUsage(record: PaymasterUsageRecord): Promise<void> {
    const history = (await configStorage.get<PaymasterUsageRecord[]>(this.HISTORY_KEY)) || [];
    const exists = history.find((item) => item.txHash === record.txHash);
    const next = exists
      ? history.map((item) => (item.txHash === record.txHash ? record : item))
      : [...history, record];

    // 仅保留最近 100 条记录，防止无限增长
    const trimmed = next.slice(-100);
    await configStorage.set(this.HISTORY_KEY, trimmed);
  }

  /**
   * 更新记录状态
   */
  async updateUsageStatus(txHash: string, status: PaymasterUsageRecord['status']): Promise<void> {
    const history = (await configStorage.get<PaymasterUsageRecord[]>(this.HISTORY_KEY)) || [];
    const next = history.map((item) =>
      item.txHash === txHash
        ? {
            ...item,
            status,
          }
        : item
    );
    await configStorage.set(this.HISTORY_KEY, next);
  }

  /**
   * 获取 Paymaster 使用历史（按时间倒序）
   */
  async getUsageHistory(limit: number = 20): Promise<PaymasterUsageRecord[]> {
    const history = (await configStorage.get<PaymasterUsageRecord[]>(this.HISTORY_KEY)) || [];
    return history
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
}

export const paymasterService = new PaymasterService();

