/**
 * Kernel 合约类型导入辅助模块
 * 
 * 提供从 kernel-dev 导入类型和 ABI 的统一接口
 * 支持两种模式：
 * 1. 如果 kernel-dev 已编译，从 artifacts 导入
 * 2. 如果未编译，使用本地定义的 ABI（降级方案）
 * 
 * @module utils/kernel-types
 */

import type { Address, Hex } from 'viem';

/**
 * 尝试从 kernel-dev 导入 ABI
 * 如果导入失败，返回 null（使用降级方案）
 */
async function tryImportKernelABI(): Promise<{
  factoryABI: readonly unknown[] | null;
  kernelABI: readonly unknown[] | null;
  entryPointABI: readonly unknown[] | null;
}> {
  try {
    // 尝试从 kernel-dev 导入
    // 注意：需要先编译 kernel-dev 并生成 artifacts
    // const KernelFactoryArtifact = await import('../../../kernel-dev/artifacts/contracts/factory/KernelFactory.sol/KernelFactory.json');
    // const KernelArtifact = await import('../../../kernel-dev/artifacts/contracts/Kernel.sol/Kernel.json');
    // const EntryPointArtifact = await import('../../../kernel-dev/artifacts/contracts/interfaces/IEntryPoint.sol/IEntryPoint.json');
    
    // 当前返回 null，使用降级方案
    return {
      factoryABI: null,
      kernelABI: null,
      entryPointABI: null,
    };
  } catch (error) {
    console.warn('Failed to import kernel-dev ABI, using fallback:', error);
    return {
      factoryABI: null,
      kernelABI: null,
      entryPointABI: null,
    };
  }
}

/**
 * Kernel Factory ABI（降级方案）
 * 
 * 基于 kernel-dev/src/factory/KernelFactory.sol
 * 当无法从 kernel-dev 导入时使用此 ABI
 */
const KERNEL_FACTORY_ABI_FALLBACK = [
  {
    inputs: [
      { name: 'data', type: 'bytes' },
      { name: 'salt', type: 'bytes32' },
    ],
    name: 'createAccount',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'data', type: 'bytes' },
      { name: 'salt', type: 'bytes32' },
    ],
    name: 'getAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Kernel ABI（降级方案）
 * 
 * 基于 kernel-dev/src/Kernel.sol
 */
const KERNEL_ABI_FALLBACK = [
  {
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'execute',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'datas', type: 'bytes[]' },
    ],
    name: 'executeBatch',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

/**
 * EntryPoint ABI（降级方案）
 * 
 * 基于 ERC-4337 EntryPoint 标准
 */
const ENTRYPOINT_ABI_FALLBACK = [
  {
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'key', type: 'uint192' },
    ],
    name: 'getNonce',
    outputs: [{ name: 'nonce', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * 获取 Kernel Factory ABI
 * 
 * 优先从 kernel-dev 导入，失败时使用降级方案
 */
export async function getKernelFactoryABI(): Promise<readonly unknown[]> {
  const imported = await tryImportKernelABI();
  return imported.factoryABI || KERNEL_FACTORY_ABI_FALLBACK;
}

/**
 * 获取 Kernel ABI
 */
export async function getKernelABI(): Promise<readonly unknown[]> {
  const imported = await tryImportKernelABI();
  return imported.kernelABI || KERNEL_ABI_FALLBACK;
}

/**
 * 获取 EntryPoint ABI
 */
export async function getEntryPointABI(): Promise<readonly unknown[]> {
  const imported = await tryImportKernelABI();
  return imported.entryPointABI || ENTRYPOINT_ABI_FALLBACK;
}

/**
 * 同步版本（不使用 async）
 * 直接返回降级方案的 ABI
 */
export const KERNEL_FACTORY_ABI = KERNEL_FACTORY_ABI_FALLBACK;
export const KERNEL_ABI = KERNEL_ABI_FALLBACK;
export const ENTRYPOINT_ABI = ENTRYPOINT_ABI_FALLBACK;

/**
 * UserOperation 类型定义
 * 
 * 基于 ERC-4337 标准
 * 
 * 注意：
 * - 当前使用本地定义的类型
 * - 当 kernel-dev 编译完成后，可以从 kernel-dev 导入 PackedUserOperation 类型
 * - 类型定义需要与 ERC-4337 标准保持一致
 */
export interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
}
