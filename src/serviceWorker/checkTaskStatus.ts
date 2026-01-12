/**
 * 任务状态检查函数
 * 
 * 在主线程中执行合约状态检查
 * 可以被 Service Worker 通过消息传递调用
 * 
 * @module serviceWorker/checkTaskStatus
 */

import { createPublicClient, http } from 'viem';

/**
 * 两阶段提交合约标准 ABI（仅用于 canReveal 检查）
 */
const TWO_PHASE_COMMIT_ABI = [
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
 * 检查是否可以揭示
 * 
 * 调用合约的 canReveal 方法检查是否可以揭示
 * 
 * @param chainId 链 ID
 * @param contractAddress 合约地址
 * @param commitmentHash 承诺哈希
 * @param rpcUrl RPC 节点 URL
 * @returns 是否可以揭示
 */
export async function checkCanReveal(
  chainId: number,
  contractAddress: string,
  commitmentHash: string,
  rpcUrl: string
): Promise<boolean> {
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  try {
    // 调用合约的 canReveal 方法
    const canReveal = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: TWO_PHASE_COMMIT_ABI,
      functionName: 'canReveal',
      args: [commitmentHash as `0x${string}`],
    });

    return canReveal as boolean;
  } catch (error) {
    console.error('[checkTaskStatus] Error checking can reveal:', error);
    // 如果合约不支持 canReveal 方法，尝试使用 getCommitmentStatus
    try {
      const status = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: TWO_PHASE_COMMIT_ABI,
        functionName: 'getCommitmentStatus',
        args: [commitmentHash as `0x${string}`],
      });

      // 如果已提交且未揭示，则可以揭示
      return (status as any).isCommitted && !(status as any).isRevealed;
    } catch (fallbackError) {
      console.error('[checkTaskStatus] Error checking commitment status:', fallbackError);
      return false;
    }
  }
}
