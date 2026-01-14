/**
 * 存储服务模块导出
 * 
 * 统一导出存储相关的接口和实现
 * 
 * @module services/storage
 */

export { IStorageProvider, StorageProviderType, StorageProviderConfig } from '@/interfaces/IStorageProvider';
export { DefaultIPFSStorageProvider, IPFSConfig } from './DefaultIPFSStorageProvider';
export { StorageProviderManager, storageProviderManager } from './StorageProviderManager';
