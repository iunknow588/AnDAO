/**
 * ApplicationRegistry合约客户端
 * 
 * 封装ApplicationRegistry合约的交互逻辑
 * 提供类型安全的合约调用接口
 * 
 * @module services/ApplicationRegistryClient
 */

import { Address, Hash, type Chain, type PublicClient, type WalletClient } from 'viem';
import { ErrorHandler, ErrorCode } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { StorageProviderType } from '@/interfaces/IStorageProvider';
import { rpcClientManager } from '@/utils/RpcClientManager';

const LOG_CONTEXT = 'ApplicationRegistryClient';

/**
 * ApplicationRegistry合约ABI（简化版，实际应该从编译产物导入）
 */
const APPLICATION_REGISTRY_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'applicationId', type: 'string' },
          { name: 'accountAddress', type: 'address' },
          { name: 'ownerAddress', type: 'address' },
          { name: 'eoaAddress', type: 'address' },
          { name: 'sponsorId', type: 'address' },
          { name: 'targetContractAddress', type: 'address' },
          { name: 'chainId', type: 'uint256' },
          { name: 'storageIdentifier', type: 'string' },
          { name: 'storageType', type: 'uint8' },
        ],
        name: 'input',
        type: 'tuple',
      },
    ],
    name: 'registerApplication',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'applicationId', type: 'string' },
      { name: 'status', type: 'uint8' },
      { name: 'reviewStorageIdentifier', type: 'string' },
    ],
    name: 'updateApplicationStatus',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'sponsorAddress', type: 'address' },
      { name: 'gasAccountAddress', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'storageType', type: 'uint8' },
    ],
    name: 'registerSponsor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'maxGasPerAccount', type: 'uint256' },
      { name: 'autoApprove', type: 'bool' },
    ],
    name: 'updateSponsorRules',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'targetContracts', type: 'address[]' },
      { name: 'allowed', type: 'bool' },
    ],
    name: 'setSponsorContractWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'users', type: 'address[]' },
      { name: 'allowed', type: 'bool' },
    ],
    name: 'setSponsorUserWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'applicationId', type: 'string' }],
    name: 'getApplication',
    outputs: [
      {
        components: [
          { name: 'applicationId', type: 'string' },
          { name: 'accountAddress', type: 'address' },
          { name: 'ownerAddress', type: 'address' },
          { name: 'eoaAddress', type: 'address' },
          { name: 'sponsorId', type: 'address' },
          { name: 'targetContractAddress', type: 'address' },
          { name: 'chainId', type: 'uint256' },
          { name: 'storageIdentifier', type: 'string' },
          { name: 'storageType', type: 'uint8' },
          { name: 'status', type: 'uint8' },
          { name: 'reviewStorageIdentifier', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'reviewedAt', type: 'uint256' },
          { name: 'deployedAt', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'sponsorAddress', type: 'address' }],
    name: 'getSponsor',
    outputs: [
      {
        components: [
          { name: 'sponsorAddress', type: 'address' },
          { name: 'gasAccountAddress', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'storageType', type: 'uint8' },
          { name: 'isActive', type: 'bool' },
          { name: 'registeredAt', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'sponsorAddress', type: 'address' }],
    name: 'canSponsor',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'sponsorAddress', type: 'address' },
      { name: 'targetContractAddress', type: 'address' },
      { name: 'ownerAddress', type: 'address' },
      { name: 'eoaAddress', type: 'address' },
    ],
    name: 'canSponsorFor',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'sponsorAddress', type: 'address' }],
    name: 'getSponsorContractWhitelist',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'sponsorAddress', type: 'address' }],
    name: 'getSponsorUserWhitelist',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'sponsorAddress', type: 'address' }],
    name: 'getSponsorApplicationCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'sponsorAddress', type: 'address' },
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    name: 'getSponsorApplicationIds',
    outputs: [{ name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * 申请状态枚举（与合约对应）
 */
export enum ApplicationStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
  DEPLOYED = 3,
}

/**
 * 存储提供者类型枚举（与合约对应）
 */
export enum ContractStorageProviderType {
  IPFS = 0,
  ARWEAVE = 1,
  CUSTOM = 2,
}

export interface ApplicationRegistryRecord {
  applicationId: string;
  accountAddress: Address;
  ownerAddress: Address;
  eoaAddress: Address;
  sponsorId: Address;
  targetContractAddress: Address;
  chainId: bigint;
  storageIdentifier: string;
  storageType: number;
  status: number;
  reviewStorageIdentifier: string;
  createdAt: bigint;
  reviewedAt: bigint;
  deployedAt: bigint;
}

export interface SponsorRegistryRecord {
  sponsorAddress: Address;
  gasAccountAddress: Address;
  name: string;
  description: string;
  storageType: number;
  isActive: boolean;
  registeredAt: bigint;
}

export interface ListApplicationsBySponsorParams {
  chainId: number;
  sponsorAddress: Address;
}

type SponsorApplicationsResolver = (
  params: ListApplicationsBySponsorParams
) => Promise<ApplicationRegistryRecord[]>;

/**
 * ApplicationRegistry客户端类
 */
export class ApplicationRegistryClient {
  private contractAddress: Address | null = null;
  private sponsorApplicationsResolver: SponsorApplicationsResolver | null = null;
  
  /**
   * 初始化客户端
   * 
   * @param contractAddress 合约地址
   */
  init(contractAddress: Address): void {
    this.contractAddress = contractAddress;
    logger.info('ApplicationRegistryClient initialized', LOG_CONTEXT, { contractAddress });
  }

  isInitialized(): boolean {
    return this.contractAddress !== null;
  }
  
  /**
   * 获取公共客户端
   * 
   * 使用统一的 RpcClientManager 管理客户端实例，避免重复创建
   * 
   * @param chainId 链ID
   * @returns 公共客户端
   */
  private getPublicClient(chainId: number): PublicClient {
    return rpcClientManager.getPublicClient(chainId);
  }
  
  /**
   * 获取钱包客户端
   * 
   * 使用统一的 RpcClientManager 管理客户端实例，避免重复创建
   * 
   * @param chainId 链ID
   * @param privateKey 私钥
   * @returns 钱包客户端
   */
  private getWalletClient(chainId: number, privateKey: `0x${string}`): WalletClient {
    return rpcClientManager.getWalletClient(chainId, privateKey);
  }

  /**
   * 获取链配置（用于显式传入写操作）
   */
  private getChain(chainId: number): Chain {
    return rpcClientManager.getChain(chainId);
  }

  /**
   * 设置“按赞助商查询申请”解析器（可选）
   *
   * 用于接入子图/后端索引服务；未设置时会自动降级为空结果。
   */
  setSponsorApplicationsResolver(resolver: SponsorApplicationsResolver | null): void {
    this.sponsorApplicationsResolver = resolver;
  }

  isSponsorApplicationsResolverConfigured(): boolean {
    return this.sponsorApplicationsResolver !== null;
  }
  
  /**
   * 注册申请索引
   * 
   * @param chainId 链ID
   * @param applicationId 申请ID
   * @param accountAddress 账户地址
   * @param ownerAddress 所有者地址
   * @param eoaAddress EOA地址（可选）
   * @param sponsorId 赞助商地址
   * @param storageIdentifier 存储标识符
   * @param storageType 存储类型
   * @param privateKey 签名者私钥
   * @returns 交易哈希
   */
  async registerApplication(
    chainId: number,
    applicationId: string,
    accountAddress: Address,
    ownerAddress: Address,
    eoaAddress: Address | null,
    sponsorId: Address,
    targetContractAddress: Address | null,
    storageIdentifier: string,
    storageType: StorageProviderType,
    privateKey: `0x${string}`
  ): Promise<Hash> {
    if (!this.contractAddress) {
      throw new Error('ApplicationRegistry contract address not set');
    }
    
    try {
      const walletClient = this.getWalletClient(chainId, privateKey);
      
      // 转换存储类型
      const contractStorageType = this.convertStorageType(storageType);
      
      const hash = await walletClient.writeContract({
        account: walletClient.account ?? null,
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'registerApplication',
        args: [
          {
            applicationId,
            accountAddress,
            ownerAddress,
            eoaAddress: eoaAddress || '0x0000000000000000000000000000000000000000' as Address,
            sponsorId,
            targetContractAddress: targetContractAddress || '0x0000000000000000000000000000000000000000' as Address,
            chainId: BigInt(chainId),
            storageIdentifier,
            storageType: contractStorageType,
          },
        ],
        chain: this.getChain(chainId),
      });
      
      logger.info('Application registered on chain', LOG_CONTEXT, { applicationId, hash });
      return hash;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.CONTRACT_ERROR);
      throw error;
    }
  }
  
  /**
   * 更新申请状态
   * 
   * @param chainId 链ID
   * @param applicationId 申请ID
   * @param status 新状态
   * @param reviewStorageIdentifier 审核记录存储标识符（可选）
   * @param privateKey 签名者私钥
   * @returns 交易哈希
   */
  async updateApplicationStatus(
    chainId: number,
    applicationId: string,
    status: ApplicationStatus,
    reviewStorageIdentifier: string,
    privateKey: `0x${string}`
  ): Promise<Hash> {
    if (!this.contractAddress) {
      throw new Error('ApplicationRegistry contract address not set');
    }
    
    try {
      const walletClient = this.getWalletClient(chainId, privateKey);
      
      const hash = await walletClient.writeContract({
        account: walletClient.account ?? null,
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'updateApplicationStatus',
        args: [
          applicationId,
          status,
          reviewStorageIdentifier || '',
        ],
        chain: this.getChain(chainId),
      });
      
      logger.info('Application status updated', LOG_CONTEXT, { applicationId, status, hash });
      return hash;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.CONTRACT_ERROR);
      throw error;
    }
  }
  
  /**
   * 注册赞助商
   * 
   * @param chainId 链ID
   * @param sponsorAddress 赞助商地址
   * @param gasAccountAddress Gas账户地址
   * @param name 赞助商名称
   * @param description 赞助商描述
   * @param storageType 存储类型
   * @param privateKey 签名者私钥
   * @returns 交易哈希
   */
  async registerSponsor(
    chainId: number,
    sponsorAddress: Address,
    gasAccountAddress: Address,
    name: string,
    description: string,
    storageType: StorageProviderType,
    privateKey: `0x${string}`
  ): Promise<Hash> {
    if (!this.contractAddress) {
      throw new Error('ApplicationRegistry contract address not set');
    }
    
    try {
      const walletClient = this.getWalletClient(chainId, privateKey);
      
      const contractStorageType = this.convertStorageType(storageType);
      
      const hash = await walletClient.writeContract({
        account: walletClient.account ?? null,
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'registerSponsor',
        args: [
          sponsorAddress,
          gasAccountAddress,
          name,
          description,
          contractStorageType,
        ],
        chain: this.getChain(chainId),
      });
      
      logger.info('Sponsor registered on chain', LOG_CONTEXT, { sponsorAddress, hash });
      return hash;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.CONTRACT_ERROR);
      throw error;
    }
  }
  
  /**
   * 更新赞助商审核规则
   * 
   * @param chainId 链ID
   * @param dailyLimit 每日赞助限额
   * @param maxGasPerAccount 单账户最大Gas（wei）
   * @param autoApprove 自动审核开关
   * @param privateKey 签名者私钥
   * @returns 交易哈希
   */
  async updateSponsorRules(
    chainId: number,
    dailyLimit: bigint,
    maxGasPerAccount: bigint,
    autoApprove: boolean,
    privateKey: `0x${string}`
  ): Promise<Hash> {
    if (!this.contractAddress) {
      throw new Error('ApplicationRegistry contract address not set');
    }
    
    try {
      const walletClient = this.getWalletClient(chainId, privateKey);
      
      const hash = await walletClient.writeContract({
        account: walletClient.account ?? null,
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'updateSponsorRules',
        args: [
          dailyLimit,
          maxGasPerAccount,
          autoApprove,
        ],
        chain: this.getChain(chainId),
      });
      
      logger.info('Sponsor rules updated', LOG_CONTEXT, { hash });
      return hash;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.CONTRACT_ERROR);
      throw error;
    }
  }

  async setSponsorContractWhitelist(
    chainId: number,
    targetContracts: Address[],
    allowed: boolean,
    privateKey: `0x${string}`
  ): Promise<Hash> {
    if (!this.contractAddress) {
      throw new Error('ApplicationRegistry contract address not set');
    }

    try {
      const walletClient = this.getWalletClient(chainId, privateKey);
      const hash = await walletClient.writeContract({
        account: walletClient.account ?? null,
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'setSponsorContractWhitelist',
        args: [targetContracts, allowed],
        chain: this.getChain(chainId),
      });

      logger.info('Sponsor contract whitelist updated', LOG_CONTEXT, {
        count: targetContracts.length,
        allowed,
        hash,
      });
      return hash;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.CONTRACT_ERROR);
      throw error;
    }
  }

  async setSponsorUserWhitelist(
    chainId: number,
    users: Address[],
    allowed: boolean,
    privateKey: `0x${string}`
  ): Promise<Hash> {
    if (!this.contractAddress) {
      throw new Error('ApplicationRegistry contract address not set');
    }

    try {
      const walletClient = this.getWalletClient(chainId, privateKey);
      const hash = await walletClient.writeContract({
        account: walletClient.account ?? null,
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'setSponsorUserWhitelist',
        args: [users, allowed],
        chain: this.getChain(chainId),
      });

      logger.info('Sponsor user whitelist updated', LOG_CONTEXT, {
        count: users.length,
        allowed,
        hash,
      });
      return hash;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.CONTRACT_ERROR);
      throw error;
    }
  }
  
  /**
   * 查询申请索引
   * 
   * @param chainId 链ID
   * @param applicationId 申请ID
   * @returns 申请索引数据
   */
  async getApplication(chainId: number, applicationId: string): Promise<ApplicationRegistryRecord | null> {
    if (!this.contractAddress) {
      throw new Error('ApplicationRegistry contract address not set');
    }
    
    try {
      const publicClient = this.getPublicClient(chainId);
      
      const result = await publicClient.readContract({
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'getApplication',
        args: [applicationId],
      });

      if (Array.isArray(result) && result.length >= 13) {
        const tuple = result as readonly unknown[];
        const hasTargetContract = tuple.length >= 14;
        return {
          applicationId: String(tuple[0] ?? ''),
          accountAddress: tuple[1] as Address,
          ownerAddress: tuple[2] as Address,
          eoaAddress: tuple[3] as Address,
          sponsorId: tuple[4] as Address,
          targetContractAddress: (hasTargetContract ? tuple[5] : '0x0000000000000000000000000000000000000000') as Address,
          chainId: BigInt(tuple[hasTargetContract ? 6 : 5] as bigint | number | string),
          storageIdentifier: String(tuple[hasTargetContract ? 7 : 6] ?? ''),
          storageType: Number(tuple[hasTargetContract ? 8 : 7] ?? 0),
          status: Number(tuple[hasTargetContract ? 9 : 8] ?? 0),
          reviewStorageIdentifier: String(tuple[hasTargetContract ? 10 : 9] ?? ''),
          createdAt: BigInt(tuple[hasTargetContract ? 11 : 10] as bigint | number | string),
          reviewedAt: BigInt(tuple[hasTargetContract ? 12 : 11] as bigint | number | string),
          deployedAt: BigInt(tuple[hasTargetContract ? 13 : 12] as bigint | number | string),
        };
      }

      return null;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.NETWORK_ERROR);
      throw error;
    }
  }
  
  /**
   * 查询赞助商信息
   * 
   * @param chainId 链ID
   * @param sponsorAddress 赞助商地址
   * @returns 赞助商信息
   */
  async getSponsor(chainId: number, sponsorAddress: Address): Promise<SponsorRegistryRecord | null> {
    if (!this.contractAddress) {
      throw new Error('ApplicationRegistry contract address not set');
    }
    
    try {
      const publicClient = this.getPublicClient(chainId);
      
      const result = await publicClient.readContract({
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'getSponsor',
        args: [sponsorAddress],
      });

      if (Array.isArray(result) && result.length >= 7) {
        const tuple = result as readonly unknown[];
        return {
          sponsorAddress: tuple[0] as Address,
          gasAccountAddress: tuple[1] as Address,
          name: String(tuple[2] ?? ''),
          description: String(tuple[3] ?? ''),
          storageType: Number(tuple[4] ?? 0),
          isActive: Boolean(tuple[5]),
          registeredAt: BigInt(tuple[6] as bigint | number | string),
        };
      }

      return null;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.NETWORK_ERROR);
      throw error;
    }
  }
  
  /**
   * 检查赞助商是否可以赞助
   * 
   * @param chainId 链ID
   * @param sponsorAddress 赞助商地址
   * @returns 是否可以赞助
   */
  async canSponsor(chainId: number, sponsorAddress: Address): Promise<boolean> {
    if (!this.contractAddress) {
      return false;
    }
    
    try {
      const publicClient = this.getPublicClient(chainId);
      
      const result = await publicClient.readContract({
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'canSponsor',
        args: [sponsorAddress],
      });
      
      return result as boolean;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.NETWORK_ERROR);
      return false;
    }
  }

  async canSponsorFor(
    chainId: number,
    sponsorAddress: Address,
    targetContractAddress: Address,
    ownerAddress: Address,
    eoaAddress: Address | null = null
  ): Promise<boolean> {
    if (!this.contractAddress) {
      return false;
    }

    try {
      const publicClient = this.getPublicClient(chainId);
      const result = await publicClient.readContract({
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'canSponsorFor',
        args: [
          sponsorAddress,
          targetContractAddress,
          ownerAddress,
          eoaAddress || '0x0000000000000000000000000000000000000000' as Address,
        ],
      });
      return result as boolean;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.NETWORK_ERROR);
      return false;
    }
  }

  async getSponsorContractWhitelist(chainId: number, sponsorAddress: Address): Promise<Address[]> {
    if (!this.contractAddress) {
      return [];
    }

    try {
      const publicClient = this.getPublicClient(chainId);
      const result = await publicClient.readContract({
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'getSponsorContractWhitelist',
        args: [sponsorAddress],
      });
      return (result as Address[]) || [];
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.NETWORK_ERROR);
      return [];
    }
  }

  async getSponsorUserWhitelist(chainId: number, sponsorAddress: Address): Promise<Address[]> {
    if (!this.contractAddress) {
      return [];
    }

    try {
      const publicClient = this.getPublicClient(chainId);
      const result = await publicClient.readContract({
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'getSponsorUserWhitelist',
        args: [sponsorAddress],
      });
      return (result as Address[]) || [];
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.NETWORK_ERROR);
      return [];
    }
  }

  /**
   * 按赞助商查询申请列表（可插拔索引入口）
   *
   * 注意：当前链上合约 ABI 未暴露按赞助商批量查询接口；
   * 若未配置 resolver，会返回空数组并由上层执行降级逻辑。
   */
  async listApplicationsBySponsor(
    chainId: number,
    sponsorAddress: Address
  ): Promise<ApplicationRegistryRecord[]> {
    if (!this.sponsorApplicationsResolver) {
      logger.warn('listApplicationsBySponsor fallback: resolver not configured', LOG_CONTEXT, {
        chainId,
        sponsorAddress,
      });
      return [];
    }

    try {
      return await this.sponsorApplicationsResolver({ chainId, sponsorAddress });
    } catch (error) {
      logger.warn('listApplicationsBySponsor resolver failed, fallback to empty list', LOG_CONTEXT, {
        chainId,
        sponsorAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 按赞助商从链上 ApplicationRegistry 直接查询申请列表（分页）
   *
   * 说明：
   * - 该能力依赖合约实现 `getSponsorApplicationCount/getSponsorApplicationIds`；
   * - 若目标链上的合约版本较旧（无该方法），会自动降级为空数组，由上层继续走 resolver/缓存回退。
   */
  async listApplicationsBySponsorOnChain(
    chainId: number,
    sponsorAddress: Address,
    pageSize: number = 50
  ): Promise<ApplicationRegistryRecord[]> {
    if (!this.contractAddress) {
      return [];
    }

    try {
      const publicClient = this.getPublicClient(chainId);
      const rawCount = await publicClient.readContract({
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'getSponsorApplicationCount',
        args: [sponsorAddress],
      });
      const total = Number(rawCount as bigint);
      if (!Number.isFinite(total) || total <= 0) {
        return [];
      }

      const ids: string[] = [];
      const size = Math.max(1, pageSize);
      for (let offset = 0; offset < total; offset += size) {
        const chunk = await publicClient.readContract({
          address: this.contractAddress,
          abi: APPLICATION_REGISTRY_ABI,
          functionName: 'getSponsorApplicationIds',
          args: [sponsorAddress, BigInt(offset), BigInt(size)],
        });
        ids.push(...((chunk as string[]) || []));
      }

      if (ids.length === 0) {
        return [];
      }

      const records = await Promise.all(
        ids.map(async (applicationId) => {
          try {
            return await this.getApplication(chainId, applicationId);
          } catch (error) {
            logger.warn('Skip invalid application record while listing by sponsor', LOG_CONTEXT, {
              chainId,
              sponsorAddress,
              applicationId,
              error: error instanceof Error ? error.message : String(error),
            });
            return null;
          }
        })
      );

      return records.filter((item): item is ApplicationRegistryRecord => item !== null);
    } catch (error) {
      logger.warn('listApplicationsBySponsorOnChain failed, fallback to resolver/cache', LOG_CONTEXT, {
        chainId,
        sponsorAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
  
  /**
   * 转换存储类型（从接口类型到合约类型）
   * 
   * @param storageType 存储类型
   * @returns 合约存储类型
   */
  private convertStorageType(storageType: StorageProviderType): ContractStorageProviderType {
    switch (storageType) {
      case StorageProviderType.IPFS:
        return ContractStorageProviderType.IPFS;
      case StorageProviderType.ARWEAVE:
        return ContractStorageProviderType.ARWEAVE;
      case StorageProviderType.CUSTOM:
        return ContractStorageProviderType.CUSTOM;
      default:
        return ContractStorageProviderType.IPFS;
    }
  }
}

// 导出单例实例
export const applicationRegistryClient = new ApplicationRegistryClient();
