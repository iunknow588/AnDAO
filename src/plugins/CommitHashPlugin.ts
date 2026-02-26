/**
 * 比特承诺插件
 * 
 * 实现比特承诺功能：提交承诺哈希，稍后揭示原始数据
 */

import type { Address, Hash, Hex } from 'viem';
import { IPlugin, PluginType } from '@/types/plugins';
import { createPublicClient, http } from 'viem';
import { getChainConfigByChainId } from '@/config/chains';

type CommitmentStatus = {
  isCommitted: boolean;
  isRevealed: boolean;
};

function toCommitmentStatus(value: unknown): CommitmentStatus {
  if (
    Array.isArray(value) &&
    value.length >= 3 &&
    typeof value[1] === 'boolean' &&
    typeof value[2] === 'boolean'
  ) {
    return {
      isCommitted: value[1],
      isRevealed: value[2],
    };
  }
  throw new Error('Invalid getCommitmentStatus response');
}

/**
 * 比特承诺插件
 */
export class CommitHashPlugin {
  private plugin: IPlugin;

  constructor(pluginAddress: Address) {
    this.plugin = {
      id: `commit-hash-${pluginAddress.toLowerCase()}`,
      name: 'Commit Hash Plugin',
      type: PluginType.EXECUTOR,
      address: pluginAddress,
      version: '1.0.0',
      description: '比特承诺插件：支持提交承诺哈希和揭示数据',
      installed: false,
    };
  }

  /**
   * 获取插件信息
   */
  getPlugin(): IPlugin {
    return this.plugin;
  }

  /**
   * 提交承诺哈希
   */
  async commit(
    _accountAddress: Address,
    chainId: number,
    commitmentHash: Hash
  ): Promise<Hex> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

    // 构造调用插件合约的 commit 方法
    // 注意：这里使用的是标准接口，实际插件合约可能有所不同
    // 需要根据实际部署的插件合约 ABI 进行调整
    const { encodeFunctionData } = await import('viem');
    return encodeFunctionData({
      abi: [
        {
          inputs: [{ name: 'commitmentHash', type: 'bytes32' }],
          name: 'commit',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'commit',
      args: [commitmentHash],
    });
  }

  /**
   * 揭示数据
   */
  async reveal(
    _accountAddress: Address,
    chainId: number,
    data: Hex
  ): Promise<Hex> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

    // 构造调用插件合约的 reveal 方法
    // 注意：这里使用的是标准接口，实际插件合约可能有所不同
    // 需要根据实际部署的插件合约 ABI 进行调整
    const { encodeFunctionData } = await import('viem');
    return encodeFunctionData({
      abi: [
        {
          inputs: [{ name: 'data', type: 'bytes' }],
          name: 'reveal',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'reveal',
      args: [data],
    });
  }

  /**
   * 检查是否可以揭示
   * 
   * 调用插件合约的 canReveal 方法检查是否可以揭示承诺
   * 
   * ⚠️ **实现说明**: 
   * - 此方法需要插件合约地址（通过构造函数传入）
   * - 标准接口：function canReveal(bytes32 commitmentHash) external view returns (bool)
   * - 如果插件合约不支持 canReveal 方法，可以降级使用 getCommitmentStatus 方法
   * 
   * @param accountAddress 账户地址（未使用，保留用于未来扩展）
   * @param chainId 链 ID
   * @param commitmentHash 承诺哈希
   * @returns 是否可以揭示
   * 
   * @example
   * ```typescript
   * const plugin = new CommitHashPlugin(pluginAddress);
   * const canReveal = await plugin.canReveal(accountAddress, chainId, commitmentHash);
   * if (canReveal) {
   *   // 可以揭示
   * }
   * ```
   */
  async canReveal(
    _accountAddress: Address,
    chainId: number,
    commitmentHash: Hash
  ): Promise<boolean> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      return false;
    }

    const publicClient = createPublicClient({
      transport: http(chainConfig.rpcUrl),
    });

    try {
      // 调用插件合约的 canReveal 方法
      // 标准接口：function canReveal(bytes32 commitmentHash) external view returns (bool)
      const canReveal = await publicClient.readContract({
        address: this.plugin.address,
        abi: [
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
        ],
        functionName: 'canReveal',
        args: [commitmentHash],
      });

      return canReveal as boolean;
    } catch (error) {
      console.error('Error checking can reveal, trying fallback:', error);
      // 降级方案：如果合约不支持 canReveal 方法，尝试使用 getCommitmentStatus
      try {
        const status = await publicClient.readContract({
          address: this.plugin.address,
          abi: [
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
          ],
          functionName: 'getCommitmentStatus',
          args: [commitmentHash],
        });
        
        // 如果已提交且未揭示，则可以揭示
        const commitmentStatus = toCommitmentStatus(status);
        return commitmentStatus.isCommitted && !commitmentStatus.isRevealed;
      } catch (fallbackError) {
        console.error('Error checking commitment status:', fallbackError);
        return false;
      }
    }
  }

  /**
   * 生成承诺哈希
   */
  static async generateCommitmentHash(data: string): Promise<Hash> {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = `0x${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`;
    return hashHex as Hash;
  }
}
