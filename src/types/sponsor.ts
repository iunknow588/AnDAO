/**
 * 赞助商相关类型定义
 * 
 * 定义赞助商、申请、渠道等相关的类型和接口
 * 
 * @module types/sponsor
 */

import { Address } from 'viem';
import { StorageProviderType, StorageProviderConfig } from '@/interfaces/IStorageProvider';

/**
 * 赞助商信息接口
 */
export interface Sponsor {
  /**
   * 赞助商唯一标识符
   */
  id: string;
  
  /**
   * 赞助商地址（EOA地址）
   */
  address: Address;
  
  /**
   * 赞助商名称
   */
  name: string;
  
  /**
   * 赞助商描述（可选）
   */
  description?: string;
  
  /**
   * 通过率（0-100）
   */
  approvalRate: number;
  
  /**
   * 平均等待时间（分钟）
   */
  avgWaitTime: number;
  
  /**
   * 总赞助账户数
   */
  totalSponsored: number;
  
  /**
   * 可用Gas余额
   */
  availableBalance: bigint;
  
  /**
   * 存储类型（可选）
   * 如果赞助商指定了存储类型，使用赞助商的存储
   */
  storageType?: StorageProviderType;
  
  /**
   * 存储配置（可选）
   */
  storageConfig?: StorageProviderConfig;
  
  /**
   * 审核规则（可选）
   */
  rules?: SponsorRules;
}

/**
 * 审核规则接口
 */
export interface SponsorRules {
  /**
   * 每日赞助限额（账户数）
   */
  dailyLimit?: number;
  
  /**
   * 单账户最大Gas（wei）
   */
  maxGasPerAccount?: bigint;
  
  /**
   * 自动审核开关
   */
  autoApprove?: boolean;
  
  /**
   * 最小赏金要求（wei，可选）
   */
  minBounty?: bigint;
  
  /**
   * 地区限制（可选）
   */
  regionRestriction?: string[];
  
  /**
   * IP限制（可选）
   */
  ipRestriction?: string[];
}

/**
 * 申请参数接口
 */
export interface ApplicationParams {
  /**
   * 账户地址（预测的地址）
   */
  accountAddress: Address;
  
  /**
   * 所有者地址（签名者地址）
   */
  ownerAddress: Address;
  
  /**
   * EOA地址（可选，路径B可能有）
   */
  eoaAddress?: Address;
  
  /**
   * 赞助商ID
   */
  sponsorId: string;

  /**
   * 链ID
   */
  chainId: number;
  
  /**
   * 邀请码（可选）
   */
  inviteCode?: string;
  
  /**
   * 申请详情（可选，用于存储）
   */
  details?: Record<string, unknown>;
}

/**
 * 申请状态
 */
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'deployed';

/**
 * 申请信息接口
 */
export interface Application {
  /**
   * 申请ID
   */
  id: string;
  
  /**
   * 账户地址
   */
  accountAddress: Address;
  
  /**
   * 所有者地址
   */
  ownerAddress: Address;
  
  /**
   * EOA地址（可选）
   */
  eoaAddress?: Address;
  
  /**
   * 赞助商ID
   */
  sponsorId: string;

  /**
   * 赞助商地址（可选）
   *
   * 用于精确匹配赞助商，不依赖 sponsorId 编码规则。
   */
  sponsorAddress?: Address;
  
  /**
   * 链ID
   */
  chainId: number;
  
  /**
   * 申请状态
   */
  status: ApplicationStatus;
  
  /**
   * 创建时间戳
   */
  createdAt: number;
  
  /**
   * 审核时间戳（可选）
   */
  reviewedAt?: number;
  
  /**
   * 部署时间戳（可选）
   */
  deployedAt?: number;
  
  /**
   * 邀请码（可选）
   */
  inviteCode?: string;
  
  /**
   * 存储标识符（CID/URI等）
   */
  storageIdentifier?: string;
  
  /**
   * 存储类型
   */
  storageType?: StorageProviderType;
  
  /**
   * 审核记录存储标识符（可选）
   */
  reviewStorageIdentifier?: string;
  
  /**
   * 拒绝原因（可选）
   */
  rejectReason?: string;
}

/**
 * 审核记录接口
 */
export interface ReviewRecord {
  /**
   * 申请ID
   */
  applicationId: string;
  
  /**
   * 审核决定
   */
  decision: 'approve' | 'reject';
  
  /**
   * 拒绝原因（可选）
   */
  reason?: string;
  
  /**
   * 审核时间戳
   */
  reviewedAt: number;
  
  /**
   * 审核者地址
   */
  reviewer: Address;
}

/**
 * 赞助商注册参数接口
 */
export interface SponsorRegistrationParams {
  /**
   * 赞助商地址（EOA地址）
   */
  sponsorAddress: Address;
  
  /**
   * Gas账户地址
   */
  gasAccountAddress: Address;
  
  /**
   * 赞助商信息
   */
  sponsorInfo: {
    name: string;
    description?: string;
    contact?: {
      email?: string;
      wechat?: string;
      x?: string;
      website?: string;
    };
  };
  
  /**
   * 审核规则
   */
  rules: SponsorRules;
  
  /**
   * 存储配置（可选）
   */
  storageConfig?: StorageProviderConfig;

  /**
   * 链ID（可选）
   *
   * 未提供时由调用方上下文决定（例如当前激活链）。
   */
  chainId?: number;

  /**
   * Gas 账户解锁密码（可选）
   *
   * 提供时可用于执行真实链上注册；未提供时仅执行本地注册。
   */
  password?: string;
}

/**
 * 渠道信息接口
 */
export interface ChannelInfo {
  /**
   * 渠道名称
   */
  name: string;
  
  /**
   * 渠道描述（可选）
   */
  description?: string;
  
  /**
   * 邀请码（可选）
   */
  inviteCode?: string;
  
  /**
   * 渠道类型（可选）
   */
  type?: string;
}

/**
 * 渠道统计接口
 */
export interface ChannelStats {
  /**
   * 渠道ID
   */
  channelId: string;
  
  /**
   * 总申请数
   */
  totalApplications: number;
  
  /**
   * 已批准数
   */
  approvedCount: number;
  
  /**
   * 已拒绝数
   */
  rejectedCount: number;
  
  /**
   * 已部署数
   */
  deployedCount: number;
  
  /**
   * 通过率
   */
  approvalRate: number;
}

/**
 * 赞助商账户接口
 */
export interface SponsorAccount {
  /**
   * 赞助商ID
   */
  sponsorId: string;
  
  /**
   * EOA地址
   */
  eoaAddress: Address;
  
  /**
   * Gas账户地址
   */
  gasAccountAddress: Address;
  
  /**
   * 智能合约账户地址（可选）
   */
  accountAddress?: Address;
  
  /**
   * 所有者地址（智能账户控制密钥）
   */
  ownerAddress?: Address;
  
  /**
   * 审核规则
   */
  rules: SponsorRules;
  
  /**
   * 存储配置（可选）
   */
  storageConfig?: StorageProviderConfig;
}
