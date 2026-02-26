/**
 * 环境变量类型定义
 * 
 * 定义 Vite 环境变量的类型，用于 TypeScript 类型检查和 IDE 自动补全
 * 
 * 支持的链：
 * - Mantle（优先支持）
 * - Injective（开发中）
 * - Avalanche（开发中）
 * 
 * @module env
 */

/// <reference types="vite/client" />

/**
 * 环境变量接口
 * 
 * 定义所有可用的环境变量及其类型
 * 所有变量都是可选的，使用 ? 标记
 */
interface ImportMetaEnv {
  /** Mantle 主网 RPC URL */
  readonly VITE_MANTLE_RPC_URL?: string;
  /** Mantle 测试网 RPC URL */
  readonly VITE_MANTLE_TESTNET_RPC_URL?: string;
  /** Mantle Bundler 服务 URL */
  readonly VITE_MANTLE_BUNDLER_URL?: string;
  /** Mantle 测试网 Bundler 服务 URL */
  readonly VITE_MANTLE_TESTNET_BUNDLER_URL?: string;
  /** Mantle 主网 Paymaster 地址 */
  readonly VITE_MANTLE_PAYMASTER_ADDRESS?: string;
  /** Mantle 测试网 Paymaster 地址 */
  readonly VITE_MANTLE_TESTNET_PAYMASTER_ADDRESS?: string;
  /** Mantle Kernel Factory 合约地址 */
  readonly VITE_MANTLE_KERNEL_FACTORY_ADDRESS?: string;
  /** Mantle 测试网 Kernel Factory 合约地址 */
  readonly VITE_MANTLE_TESTNET_KERNEL_FACTORY_ADDRESS?: string;
  /** Mantle EntryPoint 合约地址 */
  readonly VITE_MANTLE_ENTRYPOINT_ADDRESS?: string;
  /** Mantle 测试网 EntryPoint 合约地址 */
  readonly VITE_MANTLE_TESTNET_ENTRYPOINT_ADDRESS?: string;
  /** Mantle 主网 MultiChainValidator 地址 */
  readonly VITE_MANTLE_MULTI_CHAIN_VALIDATOR_ADDRESS?: string;
  /** Mantle 测试网 MultiChainValidator 地址 */
  readonly VITE_MANTLE_TESTNET_MULTI_CHAIN_VALIDATOR_ADDRESS?: string;
  /** Mantle 主网 Recovery Plugin 地址 */
  readonly VITE_MANTLE_RECOVERY_PLUGIN_ADDRESS?: string;
  /** Mantle 测试网 Recovery Plugin 地址 */
  readonly VITE_MANTLE_TESTNET_RECOVERY_PLUGIN_ADDRESS?: string;

  /** Injective 主网 RPC URL（待技术验证） */
  readonly VITE_INJECTIVE_RPC_URL?: string;
  /** Injective 测试网 RPC URL（待技术验证） */
  readonly VITE_INJECTIVE_TESTNET_RPC_URL?: string;
  /** Injective Bundler 服务 URL（待技术验证） */
  readonly VITE_INJECTIVE_BUNDLER_URL?: string;
  /** Injective 测试网 Bundler 服务 URL（待技术验证） */
  readonly VITE_INJECTIVE_TESTNET_BUNDLER_URL?: string;
  /** Injective 主网 Paymaster 地址（待技术验证） */
  readonly VITE_INJECTIVE_PAYMASTER_ADDRESS?: string;
  /** Injective 测试网 Paymaster 地址（待技术验证） */
  readonly VITE_INJECTIVE_TESTNET_PAYMASTER_ADDRESS?: string;
  /** Injective Kernel Factory 合约地址（待技术验证） */
  readonly VITE_INJECTIVE_KERNEL_FACTORY_ADDRESS?: string;
  /** Injective 测试网 Kernel Factory 合约地址（待技术验证） */
  readonly VITE_INJECTIVE_TESTNET_KERNEL_FACTORY_ADDRESS?: string;
  /** Injective EntryPoint 合约地址（待技术验证） */
  readonly VITE_INJECTIVE_ENTRYPOINT_ADDRESS?: string;
  /** Injective 测试网 EntryPoint 合约地址（待技术验证） */
  readonly VITE_INJECTIVE_TESTNET_ENTRYPOINT_ADDRESS?: string;
  /** Injective 主网 MultiChainValidator 地址（待技术验证） */
  readonly VITE_INJECTIVE_MULTI_CHAIN_VALIDATOR_ADDRESS?: string;
  /** Injective 测试网 MultiChainValidator 地址（待技术验证） */
  readonly VITE_INJECTIVE_TESTNET_MULTI_CHAIN_VALIDATOR_ADDRESS?: string;
  /** Injective 主网 Recovery Plugin 地址（待技术验证） */
  readonly VITE_INJECTIVE_RECOVERY_PLUGIN_ADDRESS?: string;
  /** Injective 测试网 Recovery Plugin 地址（待技术验证） */
  readonly VITE_INJECTIVE_TESTNET_RECOVERY_PLUGIN_ADDRESS?: string;

  /** Avalanche 主网 RPC URL */
  readonly VITE_AVALANCHE_RPC_URL?: string;
  /** Avalanche 主网 Paymaster 地址 */
  readonly VITE_AVALANCHE_PAYMASTER_ADDRESS?: string;
  /** Avalanche 主网 Bundler URL */
  readonly VITE_AVALANCHE_BUNDLER_URL?: string;
  /** Avalanche 主网 Kernel Factory 合约地址 */
  readonly VITE_AVALANCHE_KERNEL_FACTORY_ADDRESS?: string;
  /** Avalanche 主网 EntryPoint 合约地址 */
  readonly VITE_AVALANCHE_ENTRYPOINT_ADDRESS?: string;
  /** Avalanche 主网 MultiChainValidator 合约地址 */
  readonly VITE_AVALANCHE_MULTI_CHAIN_VALIDATOR_ADDRESS?: string;
  /** Avalanche 主网 Recovery Plugin 合约地址 */
  readonly VITE_AVALANCHE_RECOVERY_PLUGIN_ADDRESS?: string;
  /** Avalanche Fuji 测试网 RPC URL */
  readonly VITE_AVALANCHE_FUJI_RPC_URL?: string;
  /** Avalanche Fuji 测试网 Paymaster 地址 */
  readonly VITE_AVALANCHE_FUJI_PAYMASTER_ADDRESS?: string;
  /** Avalanche Fuji 测试网 Bundler URL */
  readonly VITE_AVALANCHE_FUJI_BUNDLER_URL?: string;
  /** Avalanche Fuji 测试网 Kernel Factory 合约地址 */
  readonly VITE_AVALANCHE_FUJI_KERNEL_FACTORY_ADDRESS?: string;
  /** Avalanche Fuji 测试网 EntryPoint 合约地址 */
  readonly VITE_AVALANCHE_FUJI_ENTRYPOINT_ADDRESS?: string;
  /** Avalanche Fuji 测试网 MultiChainValidator 合约地址 */
  readonly VITE_AVALANCHE_FUJI_MULTI_CHAIN_VALIDATOR_ADDRESS?: string;
  /** Avalanche Fuji 测试网 Recovery Plugin 合约地址 */
  readonly VITE_AVALANCHE_FUJI_RECOVERY_PLUGIN_ADDRESS?: string;
  /** 是否启用 CREATE2_PROXY 固定地址策略 */
  readonly VITE_USE_CREATE2_PROXY?: string;
  /** Ming 协议允许的消息来源，逗号分隔 */
  readonly VITE_MING_ALLOWED_ORIGINS?: string;
  /** Ming bridge 调试日志开关（true/false 或 1/0） */
  readonly VITE_MING_BRIDGE_DEBUG?: string;
  /** Solana 当前网络标识（如 solana-devnet） */
  readonly VITE_SOLANA_NETWORK?: string;
  /** Solana bridge API 地址（用于签名与广播） */
  readonly VITE_SOLANA_BRIDGE_ENDPOINT?: string;
  /** Solana 钱包地址（可选，用于任务归属识别） */
  readonly VITE_SOLANA_WALLET_ADDRESS?: string;
  /** ApplicationRegistry 合约地址（可选，启用 Sponsor 链上能力） */
  readonly VITE_APPLICATION_REGISTRY_ADDRESS?: string;
  /** 赞助商申请索引服务 URL（可选） */
  readonly VITE_APPLICATION_INDEXER_URL?: string;
}

/**
 * ImportMeta 接口扩展
 * 
 * 扩展 Vite 的 ImportMeta 接口，添加 env 属性
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
