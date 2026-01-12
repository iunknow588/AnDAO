/**
 * 全局类型定义
 * 
 * 包含钱包系统的核心类型定义
 * 
 * 主要类型：
 * - ChainConfig: 链配置信息
 * - AccountInfo: 账户信息
 * - UserOperation: ERC-4337 用户操作
 * - Transaction: 交易信息
 * - Guardian: 守护人信息（社交恢复）
 * - TwoPhaseCommitTask: 两阶段提交任务
 * 
 * @module types
 */

/**
 * 链配置接口
 * 
 * 定义区块链网络的配置信息
 * 包括 RPC 节点、Bundler、Paymaster、合约地址等
 * 
 * @property chainId - 链的唯一标识符
 * @property name - 链的名称
 * @property rpcUrl - RPC 节点 URL（必需）
 * @property bundlerUrl - ERC-4337 Bundler 服务 URL（必需）
 * @property paymasterAddress - Paymaster 合约地址（可选，用于 Gas 代付）
 * @property kernelFactoryAddress - Kernel Factory 合约地址（必需）
 * @property entryPointAddress - ERC-4337 EntryPoint 合约地址（必需）
 * @property multiChainValidatorAddress - MultiChainValidator 合约地址（必需，用于账户初始化）
 * @property recoveryPluginAddress - 恢复插件合约地址（可选，用于社交恢复功能）
 * @property nativeCurrency - 原生代币信息
 */
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  bundlerUrl?: string;
  paymasterAddress?: string;
  kernelFactoryAddress: string;
  entryPointAddress: string;
  multiChainValidatorAddress?: string; // MultiChainValidator 地址，用于账户初始化
  recoveryPluginAddress?: string; // 恢复插件地址，用于社交恢复功能
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  defaultGasLimits?: {
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
  };
}

// 支持的链
export enum SupportedChain {
  MANTLE = 'mantle',
  INJECTIVE = 'injective',
}

/**
 * 账户信息接口
 * 
 * 存储智能合约账户的基本信息
 * 
 * @property address - 智能合约账户地址
 * @property chainId - 链 ID
 * @property owner - 所有者地址（签名者地址）
 * @property createdAt - 创建时间戳（毫秒）
 * @property status - 账户状态：'predicted' 表示仅预测地址，'deployed' 表示已部署
 * @property deployedAt - 部署时间戳（可选，仅当 status 为 'deployed' 时存在）
 */
export interface AccountInfo {
  address: string;
  chainId: number;
  owner: string; // 签名者地址
  createdAt: number;
  status: 'predicted' | 'deployed';
  deployedAt?: number;
}

/**
 * UserOperation 接口（ERC-4337 标准）
 * 
 * 账户抽象的核心数据结构，代表一个用户操作
 * 与传统的交易不同，UserOperation 由 Bundler 打包成交易
 * 
 * 从 kernel-types 模块导入，确保类型一致性
 * 
 * @see utils/kernel-types.ts
 * @see https://eips.ethereum.org/EIPS/eip-4337
 */
export type { UserOperation } from '@/utils/kernel-types';

// 交易信息
export interface Transaction {
  to: string;
  value: bigint;
  data: string;
}

// 批量交易
export interface BatchTransaction {
  transactions: Transaction[];
}

/**
 * 守护人信息接口（社交恢复）
 * 
 * 用于社交恢复功能的守护人信息
 * 守护人可以投票恢复账户的所有权
 * 
 * @property address - 守护人地址
 * @property addedAt - 添加时间戳（毫秒）
 */
export interface Guardian {
  address: string;
  addedAt: number;
}

/**
 * 两阶段提交任务接口
 * 
 * 用于管理两阶段提交（比特承诺）任务
 * 第一阶段：提交承诺哈希
 * 第二阶段：揭示原始数据
 * 
 * @property id - 任务唯一标识符
 * @property chainId - 链 ID
 * @property contractAddress - 合约地址
 * @property firstPhaseTxHash - 第一阶段交易哈希
 * @property commitmentHash - 承诺哈希
 * @property status - 任务状态
 * @property createdAt - 创建时间戳
 * @property revealedAt - 揭示时间戳（可选）
 * @property revealedTxHash - 揭示交易哈希（可选）
 */
export interface TwoPhaseCommitTask {
  id: string;
  chainId: number;
  contractAddress: string; // 两阶段提交合约地址
  accountAddress?: string; // 账户地址（用于发送 reveal 交易）
  firstPhaseTxHash: string;
  commitmentHash: string;
  encryptedData?: {
    iv: string;           // 加密初始化向量（Base64）
    ciphertext: string;   // 加密后的数据（Base64）
    timestamp: number;    // 加密时间戳
  }; // 加密存储的原始数据（承诺阶段保存，用于揭示阶段）
  status: TwoPhaseCommitTaskStatus;
  createdAt: number;
  revealedAt?: number;
  revealedTxHash?: string;
}

export type TwoPhaseCommitTaskStatus =
  | 'pending'
  | 'monitoring'
  | 'ready_to_reveal'
  | 'revealing'
  | 'revealed'
  | 'failed'
  | 'cancelled';

// 错误类型
export class WalletError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

// 存储键
export enum StorageKey {
  ACCOUNTS = 'accounts',
  CURRENT_ACCOUNT = 'current_account',
  CURRENT_CHAIN = 'current_chain',
  SESSION = 'session',
  SETTINGS = 'settings',
  TWO_PHASE_COMMIT_TASKS = 'two_phase_commit_tasks',
  GUARDIANS = 'guardians',
  PLUGINS = 'plugins',
}

