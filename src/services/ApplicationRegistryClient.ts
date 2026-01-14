/**
 * ApplicationRegistry合约客户端
 * 
 * 封装ApplicationRegistry合约的交互逻辑
 * 提供类型安全的合约调用接口
 * 
 * @module services/ApplicationRegistryClient
 */

import { Address, Hash, createPublicClient, createWalletClient, http, PublicClient, WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainConfigByChainId } from '@/config/chains';
import { ErrorHandler, ErrorCode } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { StorageProviderType } from '@/interfaces/IStorageProvider';

const LOG_CONTEXT = 'ApplicationRegistryClient';

/**
 * ApplicationRegistry合约ABI（简化版，实际应该从编译产物导入）
 */
const APPLICATION_REGISTRY_ABI = [
  {
    inputs: [
      { name: 'applicationId', type: 'string' },
      { name: 'accountAddress', type: 'address' },
      { name: 'ownerAddress', type: 'address' },
      { name: 'eoaAddress', type: 'address' },
      { name: 'sponsorId', type: 'address' },
      { name: 'chainId', type: 'uint256' },
      { name: 'storageIdentifier', type: 'string' },
      { name: 'storageType', type: 'uint8' },
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

/**
 * ApplicationRegistry客户端类
 */
export class ApplicationRegistryClient {
  private contractAddress: Address | null = null;
  private publicClients: Map<number, PublicClient> = new Map();
  
  /**
   * 初始化客户端
   * 
   * @param contractAddress 合约地址
   */
  init(contractAddress: Address): void {
    this.contractAddress = contractAddress;
    logger.info('ApplicationRegistryClient initialized', LOG_CONTEXT, { contractAddress });
  }
  
  /**
   * 获取公共客户端
   * 
   * @param chainId 链ID
   * @returns 公共客户端
   */
  private getPublicClient(chainId: number): PublicClient {
    let client = this.publicClients.get(chainId);
    if (!client) {
      const chainConfig = getChainConfigByChainId(chainId);
      if (!chainConfig) {
        throw new Error(`Unsupported chain: ${chainId}`);
      }
      
      client = createPublicClient({
        transport: http(chainConfig.rpcUrl),
      });
      this.publicClients.set(chainId, client);
    }
    
    return client;
  }
  
  /**
   * 获取钱包客户端
   * 
   * @param chainId 链ID
   * @param privateKey 私钥
   * @returns 钱包客户端
   */
  private getWalletClient(chainId: number, privateKey: `0x${string}`): WalletClient {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    
    const account = privateKeyToAccount(privateKey);
    return createWalletClient({
      account,
      transport: http(chainConfig.rpcUrl),
    });
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
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'registerApplication',
        args: [
          applicationId,
          accountAddress,
          ownerAddress,
          eoaAddress || '0x0000000000000000000000000000000000000000' as Address,
          sponsorId,
          BigInt(chainId),
          storageIdentifier,
          contractStorageType,
        ],
        // viem@2 需要显式提供链参数；这里使用 null 以沿用当前 transport 对应链配置
        chain: null,
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
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'updateApplicationStatus',
        args: [
          applicationId,
          status,
          reviewStorageIdentifier || '',
        ],
        chain: null,
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
        chain: null,
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
        address: this.contractAddress,
        abi: APPLICATION_REGISTRY_ABI,
        functionName: 'updateSponsorRules',
        args: [
          dailyLimit,
          maxGasPerAccount,
          autoApprove,
        ],
        chain: null,
      });
      
      logger.info('Sponsor rules updated', LOG_CONTEXT, { hash });
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
  async getApplication(chainId: number, applicationId: string): Promise<any> {
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
      
      return result;
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
  async getSponsor(chainId: number, sponsorAddress: Address): Promise<any> {
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
      
      return result;
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
