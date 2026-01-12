/**
 * EIP-712 签名工具
 * 
 * 用于 UserOperation 的 EIP-712 结构化签名
 * 参考 ERC-4337 标准和 kernel-dev 实现
 * 
 * 签名流程：
 * 1. 计算 UserOperation 哈希（getUserOpHash）
 * 2. 使用 EIP-191 标准签名（toEthSignedMessageHash）
 * 3. 返回签名结果
 * 
 * @module utils/eip712
 */

import type { Address, Hex } from 'viem';
import { createWalletClient, http, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { UserOperation } from '@/types';

/**
 * 获取 EntryPoint 的 UserOperation 哈希
 * 
 * 根据 ERC-4337 标准，UserOperation 的哈希由 EntryPoint 合约计算
 * 哈希计算方式：keccak256(encode(UserOperation) || entryPoint || chainId)
 * 
 * @param userOp UserOperation 对象
 * @param entryPointAddress EntryPoint 合约地址
 * @param chainId 链 ID
 * @returns UserOperation 哈希
 * 
 * @see https://eips.ethereum.org/EIPS/eip-4337
 */
export function getUserOpHash(
  userOp: UserOperation,
  entryPointAddress: Address,
  chainId: number
): Hash {
  // ERC-4337 UserOperation 哈希计算
  // hash = keccak256(encode(UserOperation) || entryPoint || chainId)
  
  const encodedUserOp = encodeUserOperation(userOp);
  const encoded = encodeAbiParameters(
    parseAbiParameters('bytes, address, uint256'),
    [encodedUserOp, entryPointAddress, BigInt(chainId)]
  );
  
  return keccak256(encoded);
}

/**
 * 编码 UserOperation
 * 
 * 将 UserOperation 对象编码为 ABI 参数
 * 用于计算哈希
 * 
 * @param userOp UserOperation 对象
 * @returns 编码后的数据
 */
function encodeUserOperation(userOp: UserOperation): Hex {
  return encodeAbiParameters(
    parseAbiParameters(
      'address, uint256, bytes, bytes, uint256, uint256, uint256, uint256, uint256, bytes, bytes'
    ),
    [
      userOp.sender as Address,
      userOp.nonce,
      userOp.initCode as Hex,
      userOp.callData as Hex,
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      userOp.paymasterAndData as Hex,
      userOp.signature as Hex,
    ]
  );
}

/**
 * 签名 UserOperation
 * 
 * 使用 EIP-191 标准签名（toEthSignedMessageHash）
 * 参考 kernel-dev 中的签名逻辑
 * 
 * 签名流程：
 * 1. 计算 UserOperation 哈希（getUserOpHash）
 * 2. 使用 EIP-191 标准签名（添加 "\x19Ethereum Signed Message:\n32" 前缀）
 * 3. 返回签名结果
 * 
 * 根据 kernel-dev/src/validator/MultiChainValidator.sol:
 * - 签名是对 userOpHash 使用 ECDSA.recover(userOpHash, sig) 或
 * - ECDSA.recover(ECDSA.toEthSignedMessageHash(userOpHash), sig)
 * 
 * 这里我们使用 ethers.js 来签名，因为它提供了更底层的签名控制
 * 
 * @param userOp UserOperation 对象
 * @param entryPointAddress EntryPoint 合约地址
 * @param chainId 链 ID
 * @param signerPrivateKey 签名者私钥
 * @param rpcUrl RPC 节点 URL（当前未使用，保留用于未来扩展）
 * @returns 签名结果（65 字节，r + s + v）
 * 
 * @example
 * ```typescript
 * const signature = await signUserOperation(
 *   userOp,
 *   '0x0000000071727De22E5E9d8BAf0edAc6f37da032', // EntryPoint 地址
 *   5000, // Mantle Chain ID
 *   '0x...', // 私钥
 *   'https://rpc.mantle.xyz'
 * );
 * ```
 */
export async function signUserOperation(
  userOp: UserOperation,
  entryPointAddress: Address,
  chainId: number,
  signerPrivateKey: Hex,
  rpcUrl: string
): Promise<Hex> {
  // 1. 获取 UserOperation 哈希
  const userOpHash = getUserOpHash(userOp, entryPointAddress, chainId);
  
  // 2. 使用 ethers.js 进行签名
  // 导入 ethers
  const { Wallet } = await import('ethers');
  
  // 创建钱包实例
  const wallet = new Wallet(signerPrivateKey);
  
  // 根据 kernel-dev 的实现，签名应该是对 userOpHash 使用 toEthSignedMessageHash
  // ethers.js 的 signMessage 会自动添加 EIP-191 前缀 "\x19Ethereum Signed Message:\n32"
  // 这正是我们需要的
  const signature = await wallet.signMessage(userOpHash);
  
  return signature as Hex;
}

