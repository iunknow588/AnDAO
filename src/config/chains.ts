/**
 * 链配置
 * 
 * 配置支持的区块链网络
 * 优先支持 Mantle，Injective 待技术验证
 * 
 * 配置说明：
 * - chainId: 链的唯一标识符
 * - rpcUrl: RPC 节点 URL，用于与链交互
 * - bundlerUrl: ERC-4337 Bundler 服务 URL（必需）
 * - paymasterAddress: Paymaster 合约地址（可选，用于 Gas 代付）
 * - kernelFactoryAddress: Kernel Factory 合约地址（必需，用于创建账户）
 * - entryPointAddress: ERC-4337 EntryPoint 合约地址（必需）
 * - nativeCurrency: 原生代币信息
 * 
 * 注意：
 * - 所有地址配置可以通过环境变量覆盖
 * - 如果地址未配置，相关功能将无法使用
 * 
 * @module config/chains
 */

import { ChainConfig, SupportedChain } from '@/types';

/**
 * Mantle 链配置（优先支持）
 * 
 * Mantle 是一个高性能的 EVM 兼容链
 * 支持 ERC-4337 账户抽象标准
 * 
 * 配置来源：
 * - 环境变量优先（VITE_MANTLE_*）
 * - 默认值作为降级方案
 * 
 * 
 * 注意：
 * - Chain ID 和合约地址需要根据实际部署情况配置
 * - 可以通过环境变量覆盖默认配置
 * - 测试网和主网的配置需要分别设置
 */
export const MANTLE_CHAIN: ChainConfig = {
  chainId: 5000, // Mantle 主网 Chain ID（需要确认）
  name: 'Mantle',
  rpcUrl: process.env.VITE_MANTLE_RPC_URL || 'https://rpc.mantle.xyz',
  bundlerUrl: process.env.VITE_MANTLE_BUNDLER_URL || '', // 需要配置
  paymasterAddress: process.env.VITE_MANTLE_PAYMASTER_ADDRESS || '', // 可选
  kernelFactoryAddress: process.env.VITE_MANTLE_KERNEL_FACTORY_ADDRESS || '', // 需要从 kernel.zerodev.app 获取或部署
  entryPointAddress: process.env.VITE_MANTLE_ENTRYPOINT_ADDRESS || '', // ERC-4337 EntryPoint 地址
  multiChainValidatorAddress: process.env.VITE_MANTLE_MULTI_CHAIN_VALIDATOR_ADDRESS || '', // MultiChainValidator 地址
  recoveryPluginAddress: process.env.VITE_MANTLE_RECOVERY_PLUGIN_ADDRESS || '', // 恢复插件地址（可选，用于社交恢复功能）
  nativeCurrency: {
    name: 'Mantle',
    symbol: 'MNT',
    decimals: 18,
  },
};

// Mantle 测试网配置
export const MANTLE_TESTNET_CHAIN: ChainConfig = {
  chainId: 5001, // Mantle 测试网 Chain ID（需要确认）
  name: 'Mantle Testnet',
  rpcUrl: process.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.testnet.mantle.xyz',
  bundlerUrl: process.env.VITE_MANTLE_TESTNET_BUNDLER_URL || '',
  paymasterAddress: process.env.VITE_MANTLE_TESTNET_PAYMASTER_ADDRESS || '',
  kernelFactoryAddress: process.env.VITE_MANTLE_TESTNET_KERNEL_FACTORY_ADDRESS || '',
  entryPointAddress: process.env.VITE_MANTLE_TESTNET_ENTRYPOINT_ADDRESS || '',
  multiChainValidatorAddress: process.env.VITE_MANTLE_TESTNET_MULTI_CHAIN_VALIDATOR_ADDRESS || '',
  recoveryPluginAddress: process.env.VITE_MANTLE_TESTNET_RECOVERY_PLUGIN_ADDRESS || '', // 恢复插件地址（可选）
  nativeCurrency: {
    name: 'Mantle Testnet',
    symbol: 'MNT',
    decimals: 18,
  },
};

/**
 * Injective 链配置（待技术验证）
 * 
 * Injective 是一个去中心化交易协议
 * 需要验证是否支持 ERC-4337 账户抽象标准
 * 
 * 注意：此配置尚未完全验证，使用前需要确认：
 * - 是否支持 ERC-4337
 * - 是否可以部署 Kernel 合约
 * - Bundler 服务是否可用
 */
export const INJECTIVE_CHAIN: ChainConfig = {
  chainId: 888, // Injective 主网 Chain ID（需要确认）
  name: 'Injective',
  rpcUrl: process.env.VITE_INJECTIVE_RPC_URL || 'https://tm.injective.network',
  bundlerUrl: process.env.VITE_INJECTIVE_BUNDLER_URL || '', // 需要验证是否支持
  paymasterAddress: process.env.VITE_INJECTIVE_PAYMASTER_ADDRESS || '',
  kernelFactoryAddress: process.env.VITE_INJECTIVE_KERNEL_FACTORY_ADDRESS || '', // 需要验证是否可部署
  entryPointAddress: process.env.VITE_INJECTIVE_ENTRYPOINT_ADDRESS || '', // 需要验证
  multiChainValidatorAddress: process.env.VITE_INJECTIVE_MULTI_CHAIN_VALIDATOR_ADDRESS || '',
  recoveryPluginAddress: process.env.VITE_INJECTIVE_RECOVERY_PLUGIN_ADDRESS || '', // 恢复插件地址（可选）
  nativeCurrency: {
    name: 'Injective',
    symbol: 'INJ',
    decimals: 18,
  },
};

// 链配置映射
export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
  [SupportedChain.MANTLE]: MANTLE_CHAIN,
  [SupportedChain.INJECTIVE]: INJECTIVE_CHAIN,
};

// 默认链（MVP 阶段使用 Mantle）
export const DEFAULT_CHAIN = SupportedChain.MANTLE;
export const DEFAULT_CHAIN_CONFIG = MANTLE_CHAIN;

/**
 * 获取链配置
 * 
 * 根据链枚举值获取对应的链配置
 * 
 * @param chain 支持的链枚举值
 * @returns 链配置对象
 * @throws 如果链未配置，返回默认配置（Mantle）
 * 
 * @example
 * ```typescript
 * const config = getChainConfig(SupportedChain.MANTLE);
 * console.log(config.rpcUrl); // 'https://rpc.mantle.xyz'
 * ```
 */
export function getChainConfig(chain: SupportedChain): ChainConfig {
  return CHAIN_CONFIGS[chain] || DEFAULT_CHAIN_CONFIG;
}

/**
 * 根据 Chain ID 获取链配置
 * 
 * 通过 Chain ID 查找对应的链配置
 * 用于从交易或 RPC 响应中获取链信息
 * 
 * @param chainId 链 ID
 * @returns 链配置对象，如果未找到返回 undefined
 * 
 * @example
 * ```typescript
 * const config = getChainConfigByChainId(5000);
 * if (config) {
 *   console.log(config.name); // 'Mantle'
 * }
 * ```
 */
export function getChainConfigByChainId(chainId: number): ChainConfig | undefined {
  return Object.values(CHAIN_CONFIGS).find((config) => config.chainId === chainId);
}

