/**
 * RPC 客户端管理器
 * 
 * 统一管理 PublicClient 和 WalletClient 实例，避免重复创建
 * 按链ID缓存客户端实例，实现复用
 * 
 * @module utils/RpcClientManager
 */

import { createPublicClient, createWalletClient, http, type Chain, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { requireChainConfig } from '@/utils/chainConfigValidation';
import { logger } from './logger';

const LOG_CONTEXT = 'RpcClientManager';

/**
 * RPC 客户端管理器
 * 
 * 单例模式，全局管理所有链的 RPC 客户端实例
 */
class RpcClientManager {
  private publicClients: Map<number, PublicClient> = new Map();
  private walletClients: Map<string, WalletClient> = new Map();
  private viemChains: Map<number, Chain> = new Map();

  /**
   * 获取 viem Chain 配置（按 chainId 缓存）
   */
  getChain(chainId: number): Chain {
    const cached = this.viemChains.get(chainId);
    if (cached) {
      return cached;
    }

    const chainConfig = requireChainConfig(chainId, ['rpcUrl']);

    const chain: Chain = {
      id: chainConfig.chainId,
      name: chainConfig.name,
      nativeCurrency: chainConfig.nativeCurrency,
      rpcUrls: {
        default: { http: [chainConfig.rpcUrl] },
        public: { http: [chainConfig.rpcUrl] },
      },
      testnet: /testnet|sepolia|fuji/i.test(chainConfig.name),
    };

    this.viemChains.set(chainId, chain);
    return chain;
  }

  /**
   * 获取 PublicClient 实例
   * 
   * 如果已存在则复用，否则创建新实例并缓存
   * 
   * @param chainId 链ID
   * @returns PublicClient 实例
   * @throws 如果链配置不存在
   */
  getPublicClient(chainId: number): PublicClient {
    // 检查缓存
    let client = this.publicClients.get(chainId);
    if (client) {
      return client;
    }

    // 获取链配置
    const chainConfig = requireChainConfig(chainId, ['rpcUrl']);

    // 创建新实例
    client = createPublicClient({
      chain: this.getChain(chainId),
      transport: http(chainConfig.rpcUrl),
    });

    // 缓存实例
    this.publicClients.set(chainId, client);
    logger.debug(`Created and cached PublicClient for chain ${chainId}`, LOG_CONTEXT);

    return client;
  }

  /**
   * 获取 WalletClient 实例
   * 
   * 如果已存在则复用，否则创建新实例并缓存
   * 缓存键为 `${chainId}:${privateKey}`，确保同一链和私钥复用同一实例
   * 
   * @param chainId 链ID
   * @param privateKey 私钥
   * @returns WalletClient 实例
   * @throws 如果链配置不存在
   */
  getWalletClient(chainId: number, privateKey: `0x${string}`): WalletClient {
    // 生成缓存键（避免在缓存键中保留明文私钥）
    const account = privateKeyToAccount(privateKey);
    const cacheKey = `${chainId}:${account.address.toLowerCase()}`;

    // 检查缓存
    let client = this.walletClients.get(cacheKey);
    if (client) {
      return client;
    }

    // 获取链配置
    const chainConfig = requireChainConfig(chainId, ['rpcUrl']);

    // 创建新实例
    client = createWalletClient({
      account,
      chain: this.getChain(chainId),
      transport: http(chainConfig.rpcUrl),
    });

    // 缓存实例
    this.walletClients.set(cacheKey, client);
    logger.debug(`Created and cached WalletClient for chain ${chainId}`, LOG_CONTEXT);

    return client;
  }

  /**
   * 清除指定链的 PublicClient 缓存
   * 
   * @param chainId 链ID
   */
  clearPublicClient(chainId: number): void {
    this.publicClients.delete(chainId);
    logger.debug(`Cleared PublicClient cache for chain ${chainId}`, LOG_CONTEXT);
  }

  /**
   * 清除指定链和私钥的 WalletClient 缓存
   * 
   * @param chainId 链ID
   * @param privateKey 私钥（可选，如果不提供则清除该链的所有 WalletClient）
   */
  clearWalletClient(chainId: number, privateKey?: `0x${string}`): void {
    if (privateKey) {
      const account = privateKeyToAccount(privateKey);
      const cacheKey = `${chainId}:${account.address.toLowerCase()}`;
      this.walletClients.delete(cacheKey);
      logger.debug(`Cleared WalletClient cache for chain ${chainId}`, LOG_CONTEXT);
    } else {
      // 清除该链的所有 WalletClient
      const keysToDelete: string[] = [];
      for (const key of this.walletClients.keys()) {
        if (key.startsWith(`${chainId}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.walletClients.delete(key));
      logger.debug(`Cleared all WalletClient cache for chain ${chainId}`, LOG_CONTEXT);
    }
  }

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    this.publicClients.clear();
    this.walletClients.clear();
    this.viemChains.clear();
    logger.debug('Cleared all RPC client cache', LOG_CONTEXT);
  }

  /**
   * 获取缓存的 PublicClient 数量
   */
  getPublicClientCount(): number {
    return this.publicClients.size;
  }

  /**
   * 获取缓存的 WalletClient 数量
   */
  getWalletClientCount(): number {
    return this.walletClients.size;
  }
}

// 导出单例实例
export const rpcClientManager = new RpcClientManager();
