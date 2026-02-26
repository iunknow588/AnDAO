/**
 * 存储提供者接口定义
 * 
 * 定义了可插拔存储系统的核心接口
 * 支持IPFS、Arweave、自定义存储等多种存储方案
 * 
 * @module interfaces/IStorageProvider
 */

/**
 * 存储提供者类型枚举
 * 
 * 定义支持的存储提供者类型
 */
export enum StorageProviderType {
  /**
   * IPFS存储（默认）
   * 使用IPFS网络存储数据，返回CID
   */
  IPFS = 'ipfs',
  
  /**
   * Arweave存储
   * 使用Arweave网络存储数据，返回交易ID
   */
  ARWEAVE = 'arweave',
  
  /**
   * 自定义存储（赞助商）
   * 赞助商可以实现自己的存储方案
   * 例如：自建IPFS节点、私有存储服务等
   */
  CUSTOM = 'custom',
}

/**
 * 存储提供者配置接口
 * 
 * 用于配置和初始化存储提供者
 */
export interface StorageProviderConfig {
  /**
   * 存储提供者类型
   */
  type: StorageProviderType;
  
  /**
   * 存储提供者名称（用于显示）
   */
  name: string;
  
  /**
   * 存储提供者特定配置
   * 
   * 不同存储提供者可能需要不同的配置项
   * 例如：
   * - IPFS: { gatewayUrl, pinataApiKey, pinataApiSecret }
   * - Arweave: { gatewayUrl, wallet }
   * - Custom: { endpoint, apiKey, ... }
   */
  config?: Record<string, unknown>;
  
  /**
   * 自定义端点（可选）
   * 
   * 对于自定义存储，可以指定端点URL
   */
  endpoint?: string;
}

/**
 * 存储提供者接口
 * 
 * 所有存储方案必须实现此接口
 * 支持IPFS、Arweave、自定义存储等
 * 
 * @interface IStorageProvider
 */
export interface IStorageProvider {
  /**
   * 存储提供者类型标识
   * 
   * @readonly
   */
  readonly type: StorageProviderType;
  
  /**
   * 存储提供者名称
   * 
   * @readonly
   */
  readonly name: string;
  
  /**
   * 存储数据
   * 
   * 将数据存储到去中心化存储网络，返回存储标识符
   * 
   * @param data 要存储的数据（任意JSON可序列化对象）
   * @returns 存储标识符（CID、URI等）
   * @throws {Error} 如果存储失败
   * 
   * @example
   * ```typescript
   * const cid = await provider.add({ accountAddress: '0x...', ownerAddress: '0x...' });
   * // cid = 'QmXXX...' 或 'bafy...' (IPFS)
   * // 或自定义URI (自定义存储)
   * ```
   */
  add(data: unknown): Promise<string>;
  
  /**
   * 获取数据
   * 
   * 从存储网络获取数据
   * 
   * @param identifier 存储标识符（CID、URI等）
   * @returns 存储的数据
   * @throws {Error} 如果获取失败或标识符无效
   * 
   * @example
   * ```typescript
   * const data = await provider.get<ApplicationDetail>('QmXXX...');
   * ```
   */
  get<T = unknown>(identifier: string): Promise<T>;
  
  /**
   * 验证存储标识符是否有效
   * 
   * 检查标识符是否符合该存储提供者的格式要求
   * 
   * @param identifier 存储标识符
   * @returns 是否有效
   * 
   * @example
   * ```typescript
   * if (provider.isValid('QmXXX...')) {
   *   // 有效的IPFS CID
   * }
   * ```
   */
  isValid(identifier: string): boolean;
  
  /**
   * 获取数据的访问URL（可选）
   * 
   * 返回可以直接访问数据的HTTP/HTTPS URL
   * 如果存储提供者不支持直接URL访问，返回null
   * 
   * @param identifier 存储标识符
   * @returns 访问URL，如果不支持则返回null
   * 
   * @example
   * ```typescript
   * const url = provider.getAccessUrl('QmXXX...');
   * // url = 'https://ipfs.io/ipfs/QmXXX...' 或 null
   * ```
   */
  getAccessUrl?(identifier: string): string | null;
  
  /**
   * 批量获取数据（可选）
   * 
   * 如果存储提供者支持，可以批量获取多个数据
   * 如果不支持，可以不实现此方法
   * 
   * @param identifiers 存储标识符数组
   * @returns 数据数组（顺序与输入数组一致）
   * 
   * @example
   * ```typescript
   * const dataArray = await provider.getBatch(['QmXXX...', 'QmYYY...']);
   * ```
   */
  getBatch?<T = unknown>(identifiers: string[]): Promise<T[]>;
}
