/**
 * 链配置
 * 
 * 配置支持的区块链网络
 * 当前保留链：Mantle / Injective / Avalanche / Solana
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
 * CREATE2_PROXY 支持：
 * - 如果链支持 CREATE2_PROXY，可以使用固定地址（与 kernel-dev 相同）
 * - 固定地址：Factory = 0x6723b44Abeec4E71eBE3232BD5B455805baDD22f
 * - 如果链不支持 CREATE2_PROXY，需要独立部署并使用链特定地址
 * 
 * @module config/chains
 */

import { ChainConfig, SupportedChain } from '@/types';

/**
 * CREATE2_PROXY 固定地址（与 kernel-dev 保持一致）
 * 
 * 如果链支持 CREATE2_PROXY，可以使用这些固定地址
 * 地址来源：kernel-dev v3.0 部署脚本
 * 
 * @see https://github.com/zerodevapp/kernel-dev
 */
const CREATE2_FIXED_ADDRESSES = {
  /** Kernel 实现合约地址 */
  KERNEL: '0x94F097E1ebEB4ecA3AAE54cabb08905B239A7D27',
  /** KernelFactory 地址 */
  FACTORY: '0x6723b44Abeec4E71eBE3232BD5B455805baDD22f',
} as const;

/**
 * 获取 Factory 地址
 * 
 * 优先使用环境变量配置的地址，如果不支持 CREATE2_PROXY 或未配置，则使用固定地址
 * 
 * @param envAddress 环境变量中的地址
 * @param useCREATE2 是否使用 CREATE2_PROXY 固定地址（默认 false，需要验证支持后启用）
 * @returns Factory 地址
 */
function getFactoryAddress(envAddress: string, useCREATE2: boolean = false): string {
  // 如果环境变量有配置，优先使用
  if (envAddress && envAddress !== '') {
    return envAddress;
  }
  
  // 如果启用 CREATE2_PROXY 支持，使用固定地址
  if (useCREATE2) {
    return CREATE2_FIXED_ADDRESSES.FACTORY;
  }
  
  // 否则返回空字符串（需要配置）
  return '';
}

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
  chainId: 5000, // Mantle 主网 Chain ID
  name: 'Mantle',
  rpcUrl: import.meta.env.VITE_MANTLE_RPC_URL || 'https://rpc.mantle.xyz',
  bundlerUrl: import.meta.env.VITE_MANTLE_BUNDLER_URL || '', // 需要配置
  paymasterAddress: import.meta.env.VITE_MANTLE_PAYMASTER_ADDRESS || '', // 可选
  // 优先使用环境变量，如果未配置且支持 CREATE2_PROXY，则使用固定地址
  // 注意：需要先验证 CREATE2_PROXY 在 Mantle 主网上的支持
  kernelFactoryAddress: getFactoryAddress(
    import.meta.env.VITE_MANTLE_KERNEL_FACTORY_ADDRESS || '',
    import.meta.env.VITE_USE_CREATE2_PROXY === 'true' // 通过环境变量控制是否使用 CREATE2_PROXY
  ),
  entryPointAddress: import.meta.env.VITE_MANTLE_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // ERC-4337 EntryPoint v0.6.0 标准地址
  multiChainValidatorAddress: import.meta.env.VITE_MANTLE_MULTI_CHAIN_VALIDATOR_ADDRESS || '', // MultiChainValidator 地址（需要部署）
  recoveryPluginAddress: import.meta.env.VITE_MANTLE_RECOVERY_PLUGIN_ADDRESS || '', // 恢复插件地址（可选，用于社交恢复功能）
  nativeCurrency: {
    name: 'Mantle',
    symbol: 'MNT',
    decimals: 18,
  },
};

// Mantle 测试网配置（Sepolia）
export const MANTLE_TESTNET_CHAIN: ChainConfig = {
  chainId: 5003, // Mantle Sepolia 测试网 Chain ID
  name: 'Mantle Sepolia Testnet',
  rpcUrl: import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz',
  bundlerUrl: import.meta.env.VITE_MANTLE_TESTNET_BUNDLER_URL || '',
  paymasterAddress: import.meta.env.VITE_MANTLE_TESTNET_PAYMASTER_ADDRESS || '',
  // 优先使用环境变量，如果未配置且支持 CREATE2_PROXY，则使用固定地址
  // 当前默认使用独立部署的地址（0x5401b77d3b9BB2ce8757951d03aB6d9aEb22161d）
  // 如果验证 CREATE2_PROXY 支持后，可以启用固定地址
  kernelFactoryAddress: getFactoryAddress(
    import.meta.env.VITE_MANTLE_TESTNET_KERNEL_FACTORY_ADDRESS || '0x5401b77d3b9BB2ce8757951d03aB6d9aEb22161d',
    import.meta.env.VITE_USE_CREATE2_PROXY === 'true' // 通过环境变量控制是否使用 CREATE2_PROXY
  ),
  // ERC-4337 EntryPoint v0.6.0 标准地址（所有支持 ERC-4337 的链都使用相同地址）
  entryPointAddress: import.meta.env.VITE_MANTLE_TESTNET_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  multiChainValidatorAddress: import.meta.env.VITE_MANTLE_TESTNET_MULTI_CHAIN_VALIDATOR_ADDRESS || '', // MultiChainValidator 地址（需要部署）
  recoveryPluginAddress: import.meta.env.VITE_MANTLE_TESTNET_RECOVERY_PLUGIN_ADDRESS || '', // 恢复插件地址（可选）
  nativeCurrency: {
    name: 'Mantle Testnet',
    symbol: 'MNT',
    decimals: 18,
  },
};

/**
 * Injective 主网配置（EVM）
 * 
 * Injective 是一个去中心化交易协议，支持 EVM 兼容
 * 
 * 参考：https://docs.injective.network/developers/network-information#injective-mainnet
 * 
 * 注意：
 * - Chain ID: 1776 (EVM) / injective-1 (原生)
 * - 原生 Chain ID 为 injective-1，但 EVM 使用 1776
 * - 需要验证是否支持 ERC-4337 账户抽象标准
 * - 需要验证是否可以部署 Kernel 合约
 * - Bundler 服务需要单独配置
 */
export const INJECTIVE_CHAIN: ChainConfig = {
  chainId: 1776, // Injective EVM 主网 Chain ID
  name: 'Injective',
  rpcUrl: import.meta.env.VITE_INJECTIVE_RPC_URL || 'https://sentry.evm-rpc.injective.network',
  bundlerUrl: import.meta.env.VITE_INJECTIVE_BUNDLER_URL || '', // 需要配置
  paymasterAddress: import.meta.env.VITE_INJECTIVE_PAYMASTER_ADDRESS || '',
  // 优先使用环境变量，如果未配置且支持 CREATE2_PROXY，则使用固定地址
  // 注意：需要先验证 CREATE2_PROXY 在 Injective 主网上的支持
  kernelFactoryAddress: getFactoryAddress(
    import.meta.env.VITE_INJECTIVE_KERNEL_FACTORY_ADDRESS || '',
    import.meta.env.VITE_USE_CREATE2_PROXY === 'true' // 通过环境变量控制是否使用 CREATE2_PROXY
  ),
  entryPointAddress: import.meta.env.VITE_INJECTIVE_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // ERC-4337 EntryPoint v0.6.0 标准地址
  multiChainValidatorAddress: import.meta.env.VITE_INJECTIVE_MULTI_CHAIN_VALIDATOR_ADDRESS || '',
  recoveryPluginAddress: import.meta.env.VITE_INJECTIVE_RECOVERY_PLUGIN_ADDRESS || '', // 恢复插件地址（可选）
  nativeCurrency: {
    name: 'Injective',
    symbol: 'INJ',
    decimals: 18,
  },
};

/**
 * Injective 测试网配置（EVM）
 * 
 * 参考：https://docs.injective.network/developers/network-information#injective-testnet
 * 
 * 注意：
 * - Chain ID: 1439 (EVM) / injective-888 (原生)
 * - 原生 Chain ID 为 injective-888，但 EVM 使用 1439
 * - 测试网水龙头：https://testnet.faucet.injective.network/
 */
export const INJECTIVE_TESTNET_CHAIN: ChainConfig = {
  chainId: 1439, // Injective EVM 测试网 Chain ID
  name: 'Injective Testnet',
  rpcUrl: import.meta.env.VITE_INJECTIVE_TESTNET_RPC_URL || 'https://k8s.testnet.json-rpc.injective.network',
  bundlerUrl: import.meta.env.VITE_INJECTIVE_TESTNET_BUNDLER_URL || '',
  paymasterAddress: import.meta.env.VITE_INJECTIVE_TESTNET_PAYMASTER_ADDRESS || '',
  // 优先使用环境变量，如果未配置且支持 CREATE2_PROXY，则使用固定地址
  // 注意：需要先验证 CREATE2_PROXY 在 Injective 测试网上的支持
  kernelFactoryAddress: getFactoryAddress(
    import.meta.env.VITE_INJECTIVE_TESTNET_KERNEL_FACTORY_ADDRESS || '',
    import.meta.env.VITE_USE_CREATE2_PROXY === 'true' // 通过环境变量控制是否使用 CREATE2_PROXY
  ),
  entryPointAddress: import.meta.env.VITE_INJECTIVE_TESTNET_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // ERC-4337 EntryPoint v0.6.0 标准地址
  multiChainValidatorAddress: import.meta.env.VITE_INJECTIVE_TESTNET_MULTI_CHAIN_VALIDATOR_ADDRESS || '',
  recoveryPluginAddress: import.meta.env.VITE_INJECTIVE_TESTNET_RECOVERY_PLUGIN_ADDRESS || '', // 恢复插件地址（可选）
  nativeCurrency: {
    name: 'Injective Testnet',
    symbol: 'INJ',
    decimals: 18,
  },
};

/**
 * Avalanche 主网配置（EVM）
 *
 * 说明：
 * - Chain ID: 43114
 * - 作为目标支持链，配置层必须保留；是否启用完整 AA 能力取决于 Bundler/Paymaster 可用性
 */
export const AVALANCHE_CHAIN: ChainConfig = {
  chainId: 43114,
  name: 'Avalanche C-Chain',
  rpcUrl: import.meta.env.VITE_AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  bundlerUrl: import.meta.env.VITE_AVALANCHE_BUNDLER_URL || '',
  paymasterAddress: import.meta.env.VITE_AVALANCHE_PAYMASTER_ADDRESS || '',
  kernelFactoryAddress: getFactoryAddress(
    import.meta.env.VITE_AVALANCHE_KERNEL_FACTORY_ADDRESS || '',
    import.meta.env.VITE_USE_CREATE2_PROXY === 'true'
  ),
  entryPointAddress: import.meta.env.VITE_AVALANCHE_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  multiChainValidatorAddress: import.meta.env.VITE_AVALANCHE_MULTI_CHAIN_VALIDATOR_ADDRESS || '',
  recoveryPluginAddress: import.meta.env.VITE_AVALANCHE_RECOVERY_PLUGIN_ADDRESS || '',
  nativeCurrency: {
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
  },
};

/**
 * Avalanche Fuji 测试网配置（EVM）
 *
 * 说明：
 * - Chain ID: 43113
 * - 用于 Avalanche 功能开发与联调
 */
export const AVALANCHE_FUJI_CHAIN: ChainConfig = {
  chainId: 43113,
  name: 'Avalanche Fuji Testnet',
  rpcUrl: import.meta.env.VITE_AVALANCHE_FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
  bundlerUrl: import.meta.env.VITE_AVALANCHE_FUJI_BUNDLER_URL || '',
  paymasterAddress: import.meta.env.VITE_AVALANCHE_FUJI_PAYMASTER_ADDRESS || '',
  kernelFactoryAddress: getFactoryAddress(
    import.meta.env.VITE_AVALANCHE_FUJI_KERNEL_FACTORY_ADDRESS || '',
    import.meta.env.VITE_USE_CREATE2_PROXY === 'true'
  ),
  entryPointAddress: import.meta.env.VITE_AVALANCHE_FUJI_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  multiChainValidatorAddress: import.meta.env.VITE_AVALANCHE_FUJI_MULTI_CHAIN_VALIDATOR_ADDRESS || '',
  recoveryPluginAddress: import.meta.env.VITE_AVALANCHE_FUJI_RECOVERY_PLUGIN_ADDRESS || '',
  nativeCurrency: {
    name: 'Avalanche Fuji',
    symbol: 'AVAX',
    decimals: 18,
  },
};

/**
 * Solana 主网配置（非 EVM）
 *
 * 说明：
 * - Chain ID 采用应用内标识，便于与 EVM 链统一管理
 * - 当前主要用于前端链选择与跨链场景展示
 * - 若使用 EVM 专属能力（如 Kernel/EntryPoint），应在业务层做链能力判断
 */
export const SOLANA_CHAIN: ChainConfig = {
  chainId: 101,
  name: 'Solana Mainnet',
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  bundlerUrl: '',
  paymasterAddress: '',
  kernelFactoryAddress: '',
  entryPointAddress: '',
  multiChainValidatorAddress: '',
  recoveryPluginAddress: '',
  nativeCurrency: {
    name: 'Solana',
    symbol: 'SOL',
    decimals: 9,
  },
};

/**
 * Solana Devnet 配置（非 EVM）
 */
export const SOLANA_DEVNET_CHAIN: ChainConfig = {
  chainId: 103,
  name: 'Solana Devnet',
  rpcUrl: 'https://api.devnet.solana.com',
  bundlerUrl: '',
  paymasterAddress: '',
  kernelFactoryAddress: '',
  entryPointAddress: '',
  multiChainValidatorAddress: '',
  recoveryPluginAddress: '',
  nativeCurrency: {
    name: 'Solana Devnet',
    symbol: 'SOL',
    decimals: 9,
  },
};

// 链配置映射（用于枚举值查找）
export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
  [SupportedChain.MANTLE]: MANTLE_CHAIN,
  [SupportedChain.INJECTIVE]: INJECTIVE_CHAIN,
  [SupportedChain.AVALANCHE]: AVALANCHE_CHAIN,
  [SupportedChain.SOLANA]: SOLANA_CHAIN,
};

// 所有链配置列表（包括主网和测试网，用于通过chainId查找）
export const ALL_CHAIN_CONFIGS: ChainConfig[] = [
  MANTLE_CHAIN,
  MANTLE_TESTNET_CHAIN,
  INJECTIVE_CHAIN,
  INJECTIVE_TESTNET_CHAIN,
  AVALANCHE_CHAIN,
  AVALANCHE_FUJI_CHAIN,
  SOLANA_CHAIN,
  SOLANA_DEVNET_CHAIN,
];

export interface ChainGroup {
  key: SupportedChain;
  label: string;
  networks: ChainConfig[];
}

// UI/交互层按组展示链网络（主网在前，测试网在后）
export const CHAIN_GROUPS: ChainGroup[] = [
  {
    key: SupportedChain.AVALANCHE,
    label: 'Avalanche',
    networks: [AVALANCHE_CHAIN, AVALANCHE_FUJI_CHAIN],
  },
  {
    key: SupportedChain.SOLANA,
    label: 'Solana',
    networks: [SOLANA_CHAIN, SOLANA_DEVNET_CHAIN],
  },
  {
    key: SupportedChain.MANTLE,
    label: 'Mantle',
    networks: [MANTLE_TESTNET_CHAIN, MANTLE_CHAIN],
  },
  {
    key: SupportedChain.INJECTIVE,
    label: 'Injective',
    networks: [INJECTIVE_TESTNET_CHAIN, INJECTIVE_CHAIN],
  },
];

// 默认链（MVP 阶段使用 Mantle）
// 注意：开发环境建议使用测试网，生产环境切换到主网
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
 * 注意：此函数会查找所有链配置（包括主网和测试网）
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
 * 
 * const testnetConfig = getChainConfigByChainId(5003);
 * if (testnetConfig) {
 *   console.log(testnetConfig.name); // 'Mantle Sepolia Testnet'
 * }
 * ```
 */
export function getChainConfigByChainId(chainId: number): ChainConfig | undefined {
  // 优先查找所有链配置（包括测试网）
  const config = ALL_CHAIN_CONFIGS.find((config) => config.chainId === chainId);
  if (config) {
    return config;
  }
  
  // 降级：查找CHAIN_CONFIGS（仅主网）
  return Object.values(CHAIN_CONFIGS).find((config) => config.chainId === chainId);
}

/**
 * 根据 chainId 推断主链枚举值（主网与测试网都可映射）
 */
export function getSupportedChainByChainId(chainId: number): SupportedChain | undefined {
  if (chainId === MANTLE_CHAIN.chainId || chainId === MANTLE_TESTNET_CHAIN.chainId) {
    return SupportedChain.MANTLE;
  }
  if (chainId === INJECTIVE_CHAIN.chainId || chainId === INJECTIVE_TESTNET_CHAIN.chainId) {
    return SupportedChain.INJECTIVE;
  }
  if (chainId === AVALANCHE_CHAIN.chainId || chainId === AVALANCHE_FUJI_CHAIN.chainId) {
    return SupportedChain.AVALANCHE;
  }
  if (chainId === SOLANA_CHAIN.chainId || chainId === SOLANA_DEVNET_CHAIN.chainId) {
    return SupportedChain.SOLANA;
  }
  return undefined;
}
