/**
 * Kernel 合约工具函数
 * 
 * 提供与 kernel-dev 合约交互的工具函数
 * 使用 viem 与合约交互
 * 
 * 注意：当前使用类型导入辅助模块，优先从 kernel-dev 导入，失败时使用降级方案
 * 
 * @module utils/kernel
 */

import type { Address, Hex, Hash } from 'viem';
import { createPublicClient, createWalletClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { KERNEL_FACTORY_ABI, KERNEL_ABI, ENTRYPOINT_ABI } from './kernel-types';
import { rpcClientManager } from './RpcClientManager';

// 重新导出 ABI（保持向后兼容）
export { KERNEL_FACTORY_ABI, KERNEL_ABI, ENTRYPOINT_ABI };

/**
 * 预测账户地址
 * 
 * 使用 Kernel Factory 的 getAddress 方法预测账户地址
 * 这是确定性地址，基于 initData 和 salt 计算得出
 * 
 * @param factoryAddress Kernel Factory 合约地址
 * @param initData 账户初始化数据（Kernel.initialize 的编码数据）
 * @param salt 盐值（用于确定性地址生成）
 * @param rpcUrl RPC 节点 URL
 * @returns 预测的账户地址
 * 
 * @example
 * ```typescript
 * const address = await predictAccountAddress(
 *   '0x...', // Factory 地址
 *   '0x...', // initData
 *   '0x...', // salt
 *   'https://rpc.mantle.xyz'
 * );
 * ```
 */
/**
 * 预测账户地址（带超时和重试机制）
 * 
 * 使用 Kernel Factory 的 getAddress 方法预测账户地址
 * 这是确定性地址，基于 initData 和 salt 计算得出
 * 
 * 优化：
 * - 添加 RPC 调用超时（默认 30 秒）
 * - 添加重试机制（最多 3 次）
 * - 优化错误提示
 * 
 * @param factoryAddress Kernel Factory 合约地址
 * @param initData 账户初始化数据（Kernel.initialize 的编码数据）
 * @param salt 盐值（用于确定性地址生成）
 * @param rpcUrl RPC 节点 URL
 * @param timeout 超时时间（毫秒，默认 30000）
 * @param retries 重试次数（默认 3）
 * @returns 预测的账户地址
 * 
 * @example
 * ```typescript
 * const address = await predictAccountAddress(
 *   '0x...', // Factory 地址
 *   '0x...', // initData
 *   '0x...', // salt
 *   'https://rpc.mantle.xyz'
 * );
 * ```
 */
export async function predictAccountAddress(
  factoryAddress: Address,
  initData: Hex,
  salt: Hex,
  rpcUrl: string,
  timeout: number = 30000,
  retries: number = 3
): Promise<Address> {
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  let lastError: Error | null = null;
  
  // 执行 RPC 调用（带超时）
  const executeWithTimeout = async (): Promise<Address> => {
    return Promise.race([
      publicClient.readContract({
        address: factoryAddress,
        abi: KERNEL_FACTORY_ABI,
        functionName: 'getAddress',
        args: [initData, salt],
      }).then(result => result as Address),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`RPC 调用超时（${timeout}ms）`)), timeout);
      }),
    ]);
  };
  
  // 重试逻辑
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await executeWithTimeout();
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 如果是最后一次尝试，抛出详细错误
      if (attempt === retries) {
        const errorDetails = [
          `预测账户地址失败（已重试 ${retries} 次）`,
          `错误信息：${lastError.message}`,
          `RPC 节点：${rpcUrl}`,
          `Factory 地址：${factoryAddress}`,
          `建议：1) 检查网络连接；2) 确认 RPC 节点可用性；3) 验证 Factory 地址配置是否正确`,
        ].join('\n');
        throw new Error(errorDetails);
      }
      
      // 等待后重试（指数退避：1秒、2秒、3秒...）
      const delay = 1000 * (attempt + 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // 理论上不会到达这里，但 TypeScript 需要
  throw lastError || new Error('预测账户地址失败：未知错误');
}

/**
 * 创建账户
 * 
 * 调用 Kernel Factory 的 createAccount 方法实际部署账户合约
 * 如果提供了 signerPrivateKey，会发送交易部署账户
 * 如果不提供，仅预测地址（账户可能还未部署）
 * 
 * @param factoryAddress Kernel Factory 合约地址
 * @param initData 账户初始化数据
 * @param salt 盐值
 * @param rpcUrl RPC 节点 URL
 * @param signerPrivateKey 签名者私钥（可选，用于发送部署交易）
 * @returns 对象形式结果：
 * - address: 账户地址（已部署或预测的地址）
 * - txHash:  部署交易哈希（仅在提供 signerPrivateKey 时返回）
 * 
 * @example
 * ```typescript
 * // 仅预测地址
 * const { address } = await createAccount(factory, initData, salt, rpcUrl);
 * 
 * // 实际部署账户
 * const { address, txHash } = await createAccount(factory, initData, salt, rpcUrl, privateKey);
 * // txHash 为本次部署交易哈希，可用于前端展示与跟踪
 * ```
 */
export interface CreateAccountResult {
  /** 账户地址（已部署或预测的地址） */
  address: Address;
  /** 部署交易哈希（仅在提供 signerPrivateKey 时存在） */
  txHash?: Hash;
}

export async function createAccount(
  factoryAddress: Address,
  initData: Hex,
  salt: Hex,
  rpcUrl: string,
  signerPrivateKey: Hex | undefined,
  chainId: number
): Promise<CreateAccountResult> {
  const chain = rpcClientManager.getChain(chainId);
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  if (signerPrivateKey) {
    // 使用签名者发送交易
    const account = privateKeyToAccount(signerPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });

    const hash = await walletClient.writeContract({
      address: factoryAddress,
      abi: KERNEL_FACTORY_ABI,
      functionName: 'createAccount',
      args: [initData, salt],
      chain,
    });

    // 等待交易确认
    await publicClient.waitForTransactionReceipt({ hash });
    
    // 返回创建的账户地址和本次部署交易哈希
    const address = await predictAccountAddress(factoryAddress, initData, salt, rpcUrl);
    return {
      address,
      txHash: hash as Hash,
    };
  } else {
    // 仅预测地址，不实际创建
    const address = await predictAccountAddress(factoryAddress, initData, salt, rpcUrl);
    return { address };
  }
}

/**
 * 构造 execute 调用数据
 * 
 * 编码 Kernel.execute(target, value, data) 的调用数据
 * 用于构造 UserOperation 的 callData
 * 
 * @param target 目标合约地址
 * @param value 转账金额（wei）
 * @param data 调用数据
 * @returns 编码后的调用数据
 */
export function encodeExecuteCallData(
  target: Address,
  value: bigint,
  data: Hex
): Hex {
  return encodeFunctionData({
    abi: KERNEL_ABI,
    functionName: 'execute',
    args: [target, value, data],
  });
}

/**
 * 构造 executeBatch 调用数据
 * 
 * 编码 Kernel.executeBatch(targets, values, datas) 的调用数据
 * 用于批量交易，一次签名执行多个交易
 * 
 * @param targets 目标合约地址数组
 * @param values 转账金额数组（wei）
 * @param datas 调用数据数组
 * @returns 编码后的调用数据
 * 
 * @example
 * ```typescript
 * const callData = encodeExecuteBatchCallData(
 *   ['0x...', '0x...'], // 两个目标地址
 *   [0n, 1000000000000000000n], // 第一个不转账，第二个转账 1 ETH
 *   ['0x...', '0x...'] // 两个调用数据
 * );
 * ```
 */
export function encodeExecuteBatchCallData(
  targets: Address[],
  values: bigint[],
  datas: Hex[]
): Hex {
  return encodeFunctionData({
    abi: KERNEL_ABI,
    functionName: 'executeBatch',
    args: [targets, values, datas],
  });
}

/**
 * 获取账户 nonce
 * 
 * 从 EntryPoint 合约获取账户的 nonce
 * nonce 用于防止重放攻击，每个 UserOperation 需要唯一的 nonce
 * 
 * @param entryPointAddress EntryPoint 合约地址
 * @param accountAddress 账户地址
 * @param rpcUrl RPC 节点 URL
 * @param key nonce key（默认为 0，用于支持多个 nonce 序列）
 * @returns 账户的当前 nonce
 * 
 * @example
 * ```typescript
 * const nonce = await getAccountNonce(
 *   '0x0000000071727De22E5E9d8BAf0edAc6f37da032', // EntryPoint 地址
 *   '0x...', // 账户地址
 *   'https://rpc.mantle.xyz'
 * );
 * ```
 */
export async function getAccountNonce(
  entryPointAddress: Address,
  accountAddress: Address,
  rpcUrl: string,
  key: bigint = BigInt(0)
): Promise<bigint> {
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  const nonce = await publicClient.readContract({
    address: entryPointAddress,
    abi: ENTRYPOINT_ABI,
    functionName: 'getNonce',
    args: [accountAddress, key],
  });

  return nonce;
}
