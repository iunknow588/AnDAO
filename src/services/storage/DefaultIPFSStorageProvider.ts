/**
 * 默认IPFS存储提供者
 * 
 * 钱包默认使用的存储方案
 * 使用公共IPFS网关（Pinata/Web3.Storage等）
 * 
 * 实现说明：
 * - 使用公共IPFS网关进行数据存储和获取
 * - 支持Pinata和Web3.Storage等Pin服务
 * - 本地缓存优化，减少重复请求
 * - CID验证和格式检查
 * 
 * @module services/storage/DefaultIPFSStorageProvider
 */

import { IStorageProvider, StorageProviderType } from '@/interfaces/IStorageProvider';
import { storageAdapter } from '@/adapters/StorageAdapter';

// 直接使用字符串字面量，避免枚举加载顺序问题
// 在生产构建中，枚举可能被打包到不同的 chunk，导致加载顺序不确定
const IPFS_TYPE_VALUE = 'ipfs' as const;

/**
 * IPFS配置接口
 */
export interface IPFSConfig {
  /**
   * IPFS网关URL（用于读取数据）
   * 默认使用公共网关：https://ipfs.io/ipfs/
   */
  gatewayUrl?: string;
  
  /**
   * Pin服务配置（用于存储数据）
   * 支持Pinata或Web3.Storage
   */
  pinService?: {
    /**
     * Pin服务类型
     */
    type: 'pinata' | 'web3storage' | 'public';
    
    /**
     * API密钥（Pinata需要）
     */
    apiKey?: string;
    
    /**
     * API密钥（Pinata需要）
     */
    apiSecret?: string;
    
    /**
     * Web3.Storage令牌（Web3.Storage需要）
     */
    token?: string;
  };
  
  /**
   * 是否启用本地缓存
   * 默认启用，缓存已获取的数据
   */
  enableCache?: boolean;
}

/**
 * 默认IPFS存储提供者实现
 * 
 * 使用公共IPFS网关和Pin服务进行数据存储
 */
export class DefaultIPFSStorageProvider implements IStorageProvider {
  // 使用 getter 延迟计算，完全避免在类属性初始化时访问枚举
  // 这样可以确保即使枚举未加载也能正常工作
  get type(): StorageProviderType {
    // 直接返回字符串字面量，类型系统会确保兼容性
    return IPFS_TYPE_VALUE as StorageProviderType;
  }
  readonly name = 'IPFS (Default)';

  /**
   * 本地降级存储前缀（用于无 Pin 服务场景）
   *
   * 说明：
   * - 钱包是纯前端应用时，可能未配置 Pinata/Web3.Storage
   * - 为避免核心流程（例如 SponsorService 的申请/审核）完全不可用，
   *   这里在 pinService=public（无写入能力）时，降级到本地存储（IndexedDB/LocalStorage 由 storageAdapter 负责）
   * - 该模式只保证“可用性”，不保证跨设备/跨浏览器同步。
   */
  private readonly LOCAL_FALLBACK_PREFIX = 'local-ipfs-';
  
  private config: Required<IPFSConfig>;
  private cache: Map<string, unknown> = new Map();
  
  constructor(config: IPFSConfig = {}) {
    this.config = {
      gatewayUrl: config.gatewayUrl || 'https://ipfs.io/ipfs/',
      pinService: config.pinService || { type: 'public' },
      enableCache: config.enableCache !== false,
    };
  }
  
  /**
   * 存储数据到IPFS
   * 
   * 根据配置的Pin服务类型，使用不同的方式存储数据
   * - public: 使用公共网关（仅读取，不支持存储）
   * - pinata: 使用Pinata API存储
   * - web3storage: 使用Web3.Storage API存储
   * 
   * @param data 要存储的数据
   * @returns IPFS CID
   */
  async add(data: unknown): Promise<string> {
    try {
      // 无 Pin 服务时降级到本地存储，保证纯前端可用
      if (this.config.pinService.type === 'public') {
        const cid = `${this.LOCAL_FALLBACK_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await storageAdapter.set(`ipfs_fallback_${cid}`, data);
        if (this.config.enableCache) {
          this.cache.set(cid, data);
        }
        return cid;
      }

      // 将数据序列化为JSON
      const jsonData = JSON.stringify(data);
      const blob = new Blob([jsonData], { type: 'application/json' });
      
      // 根据Pin服务类型选择存储方式
      if (this.config.pinService.type === 'pinata' && this.config.pinService.apiKey) {
        return await this.addToPinata(blob);
      } else if (this.config.pinService.type === 'web3storage' && this.config.pinService.token) {
        return await this.addToWeb3Storage(blob);
      } else {
        throw new Error('IPFS存储需要配置Pin服务（Pinata或Web3.Storage），或使用 public 模式的本地降级存储');
      }
    } catch (error) {
      throw new Error(`Failed to add data to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * 从IPFS获取数据
   * 
   * 使用IPFS网关获取数据，支持本地缓存
   * 
   * @param cid IPFS CID
   * @returns 存储的数据
   */
  async get<T = unknown>(cid: string): Promise<T> {
    // 本地降级存储：直接从 storageAdapter 读取
    if (cid.startsWith(this.LOCAL_FALLBACK_PREFIX)) {
      const cached = this.config.enableCache ? this.cache.get(cid) : undefined;
      if (cached !== undefined) return cached as T;

      const data = await storageAdapter.get<T>(`ipfs_fallback_${cid}`);
      if (data === null || data === undefined) {
        throw new Error(`Local IPFS fallback data not found: ${cid}`);
      }
      if (this.config.enableCache) this.cache.set(cid, data);
      return data;
    }

    // 验证CID格式
    if (!this.isValid(cid)) {
      throw new Error(`Invalid IPFS CID: ${cid}`);
    }
    
    // 检查缓存
    if (this.config.enableCache && this.cache.has(cid)) {
      return this.cache.get(cid) as T;
    }
    
    try {
      // 从IPFS网关获取数据
      const url = `${this.config.gatewayUrl}${cid}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data from IPFS: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // 缓存数据
      if (this.config.enableCache) {
        this.cache.set(cid, data);
      }
      
      return data as T;
    } catch (error) {
      throw new Error(`Failed to get data from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * 验证IPFS CID格式
   * 
   * 支持CIDv0（Qm开头）和CIDv1（bafy开头）格式
   * 
   * @param identifier CID字符串
   * @returns 是否有效
   */
  isValid(identifier: string): boolean {
    if (!identifier || typeof identifier !== 'string') {
      return false;
    }
    
    // CIDv0格式：Qm开头，46个字符
    if (identifier.startsWith('Qm') && identifier.length === 46) {
      return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(identifier);
    }
    
    // CIDv1格式：bafy开头或其他base32编码
    if (identifier.startsWith('bafy') || identifier.startsWith('bafk')) {
      return /^baf[a-z0-9]{56,}$/.test(identifier);
    }
    
    // 其他可能的CID格式
    return /^[a-z0-9]{46,}$/.test(identifier);
  }
  
  /**
   * 获取IPFS数据的访问URL
   * 
   * @param cid IPFS CID
   * @returns 访问URL
   */
  getAccessUrl(cid: string): string | null {
    if (!this.isValid(cid)) {
      return null;
    }
    return `${this.config.gatewayUrl}${cid}`;
  }
  
  /**
   * 批量获取数据
   * 
   * 并行获取多个CID的数据
   * 
   * @param cids CID数组
   * @returns 数据数组
   */
  async getBatch<T = unknown>(cids: string[]): Promise<T[]> {
    return Promise.all(cids.map(cid => this.get<T>(cid)));
  }
  
  /**
   * 使用Pinata存储数据
   * 
   * @param blob 数据Blob
   * @returns IPFS CID
   */
  private async addToPinata(blob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', blob);
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': this.config.pinService.apiKey!,
        'pinata_secret_api_key': this.config.pinService.apiSecret!,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Pinata API error: ${error.message || response.statusText}`);
    }
    
    const result = await response.json();
    return result.IpfsHash;
  }
  
  /**
   * 使用Web3.Storage存储数据
   * 
   * @param blob 数据Blob
   * @returns IPFS CID
   */
  private async addToWeb3Storage(blob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', blob);
    
    const response = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.pinService.token!}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Web3.Storage API error: ${error.message || response.statusText}`);
    }
    
    const result = await response.json();
    return result.cid;
  }
  
  /**
   * 清空本地缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}
