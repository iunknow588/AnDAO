/**
 * 存储服务模块导出
 * 
 * 统一导出存储相关的接口和实现
 * 
 * @module services/storage
 */

export { StorageProviderType } from '@/interfaces/IStorageProvider';
export type { IStorageProvider, StorageProviderConfig } from '@/interfaces/IStorageProvider';
export { DefaultIPFSStorageProvider } from './DefaultIPFSStorageProvider';
export type { IPFSConfig } from './DefaultIPFSStorageProvider';
export { StorageProviderManager, storageProviderManager } from './StorageProviderManager';
