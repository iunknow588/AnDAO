/**
 * 存储提供者管理器
 * 
 * 管理所有可用的存储提供者，提供统一的访问接口
 * 支持注册、获取、自动选择等功能
 * 
 * 功能：
 * - 注册存储提供者
 * - 根据类型获取存储提供者
 * - 根据存储标识符自动选择提供者
 * - 提供默认存储提供者
 * 
 * @module services/storage/StorageProviderManager
 */

import { IStorageProvider, StorageProviderType } from '@/interfaces/IStorageProvider';
import { DefaultIPFSStorageProvider } from './DefaultIPFSStorageProvider';

/**
 * 存储提供者管理器类
 * 
 * 单例模式，全局管理所有存储提供者
 */
export class StorageProviderManager {
  private providers: Map<StorageProviderType, IStorageProvider> = new Map();
  private defaultProvider: IStorageProvider | null = null;
  private defaultProviderInitialized = false;
  
  constructor() {
    // 延迟初始化默认提供者，确保枚举已加载
    // 在生产构建中，枚举可能还未加载，所以延迟到第一次使用时初始化
  }
  
  /**
   * 确保默认提供者已初始化
   */
  private ensureDefaultProvider(): void {
    if (!this.defaultProviderInitialized) {
      try {
        this.defaultProvider = new DefaultIPFSStorageProvider();
        // 手动注册，避免循环调用
        this.providers.set(this.defaultProvider.type, this.defaultProvider);
        this.defaultProviderInitialized = true;
      } catch (error) {
        console.error('StorageProviderManager: 初始化默认提供者失败', error);
        // 如果仍然失败，创建一个最小实现
        throw new Error('Failed to initialize default storage provider');
      }
    }
  }

  private getDefaultProviderOrThrow(): IStorageProvider {
    if (!this.defaultProvider) {
      throw new Error('Default storage provider is not initialized');
    }
    return this.defaultProvider;
  }
  
  /**
   * 注册存储提供者
   * 
   * 如果已存在同类型的提供者，将被替换
   * 
   * @param provider 存储提供者实例
   * 
   * @example
   * ```typescript
   * const manager = new StorageProviderManager();
   * const customProvider = new CustomStorageProvider();
   * manager.register(customProvider);
   * ```
   */
  register(provider: IStorageProvider): void {
    this.ensureDefaultProvider();
    this.providers.set(provider.type, provider);
    
    // 如果注册的是默认类型，更新默认提供者
    if (provider.type === StorageProviderType.IPFS) {
      this.defaultProvider = provider;
      this.defaultProviderInitialized = true;
    }
  }
  
  /**
   * 获取存储提供者
   * 
   * 根据类型获取对应的存储提供者
   * 如果未找到，返回默认提供者
   * 
   * @param type 存储提供者类型
   * @returns 存储提供者实例
   * 
   * @example
   * ```typescript
   * const provider = manager.getProvider(StorageProviderType.IPFS);
   * ```
   */
  getProvider(type: StorageProviderType): IStorageProvider {
    this.ensureDefaultProvider();
    return this.providers.get(type) ?? this.getDefaultProviderOrThrow();
  }
  
  /**
   * 获取默认存储提供者
   * 
   * 返回默认的IPFS存储提供者
   * 
   * @returns 默认存储提供者实例
   * 
   * @example
   * ```typescript
   * const defaultProvider = manager.getDefaultProvider();
   * const cid = await defaultProvider.add(data);
   * ```
   */
  getDefaultProvider(): IStorageProvider {
    this.ensureDefaultProvider();
    return this.getDefaultProviderOrThrow();
  }
  
  /**
   * 根据存储标识符自动选择提供者
   * 
   * 通过分析标识符的格式，自动识别应该使用哪个存储提供者
   * 
   * 识别规则：
   * - IPFS CID: Qm开头（CIDv0）或bafy开头（CIDv1）
   * - Arweave: 43个字符的base64字符串
   * - 自定义: 其他格式或包含特定前缀
   * 
   * @param identifier 存储标识符
   * @returns 存储提供者实例
   * 
   * @example
   * ```typescript
   * const provider = manager.getProviderByIdentifier('QmXXX...');
   * // 自动识别为IPFS提供者
   * ```
   */
  getProviderByIdentifier(identifier: string): IStorageProvider {
    this.ensureDefaultProvider();
    if (!identifier || typeof identifier !== 'string') {
      return this.getDefaultProviderOrThrow();
    }
    
    // 检查IPFS CID格式
    // 使用字符串字面量避免枚举加载问题
    if (identifier.startsWith('Qm') || identifier.startsWith('bafy') || identifier.startsWith('bafk')) {
      return this.getProvider(StorageProviderType.IPFS);
    }
    
    // 检查Arweave格式（43个字符的base64字符串）
    if (/^[A-Za-z0-9_-]{43}$/.test(identifier)) {
      const arweaveProvider = this.providers.get(StorageProviderType.ARWEAVE);
      if (arweaveProvider) {
        return arweaveProvider;
      }
    }
    
    // 检查自定义格式（包含特定前缀或URL格式）
    if (identifier.startsWith('custom://') || identifier.startsWith('http://') || identifier.startsWith('https://')) {
      const customProvider = this.providers.get(StorageProviderType.CUSTOM);
      if (customProvider) {
        return customProvider;
      }
    }
    
    // 默认返回IPFS提供者
    return this.getDefaultProviderOrThrow();
  }
  
  /**
   * 获取所有已注册的存储提供者
   * 
   * @returns 存储提供者数组
   */
  getAllProviders(): IStorageProvider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * 检查是否已注册指定类型的提供者
   * 
   * @param type 存储提供者类型
   * @returns 是否已注册
   */
  hasProvider(type: StorageProviderType): boolean {
    return this.providers.has(type);
  }
  
  /**
   * 移除存储提供者
   * 
   * 注意：不能移除默认IPFS提供者
   * 
   * @param type 存储提供者类型
   */
  removeProvider(type: StorageProviderType): void {
    this.ensureDefaultProvider();
    // 不允许移除默认提供者
    if (type === StorageProviderType.IPFS) {
      throw new Error('Cannot remove default IPFS provider');
    }
    
    this.providers.delete(type);
  }
}

/**
 * 全局存储提供者管理器实例（延迟初始化）
 * 
 * 单例模式，在整个应用中共享
 * 使用延迟初始化避免模块加载顺序问题
 */
let _storageProviderManagerInstance: StorageProviderManager | null = null;

/**
 * 获取全局存储提供者管理器实例
 * 
 * 延迟初始化，确保所有依赖模块都已加载
 */
export function getStorageProviderManager(): StorageProviderManager {
  if (!_storageProviderManagerInstance) {
    _storageProviderManagerInstance = new StorageProviderManager();
  }
  return _storageProviderManagerInstance;
}

/**
 * 全局存储提供者管理器实例
 * 
 * 使用延迟初始化避免模块加载顺序问题
 * 在第一次访问时创建实例
 */
export const storageProviderManager = getStorageProviderManager();
