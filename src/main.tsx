/**
 * 应用入口文件
 * 
 * 负责初始化应用的核心服务和组件
 * 
 * 初始化顺序：
 * 1. 存储适配器（IndexedDB/LocalStorage）
 * 2. 链管理服务（ChainService）
 * 3. 监控服务（MonitoringService，可选）
 * 4. 两阶段提交服务（TwoPhaseCommitService，包括 Service Worker）
 * 5. Provider 适配器（延迟初始化，等待 Store 就绪）
 * 
 * 注意：
 * - Provider 初始化需要延迟，因为依赖 Store 的初始化
 * - 所有初始化都是异步的，失败不会阻塞应用启动
 * - Service Worker 用于后台监控两阶段提交任务
 * 
 * @module main
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import type { ApplicationRegistryRecord } from './services/ApplicationRegistryClient';
import type { Address } from 'viem';
import { applicationRegistryClient } from './services/ApplicationRegistryClient';
import { WindowProviderAdapter } from './adapters/ProviderAdapter';
import { accountStore } from './stores';
import { TransactionRelayer } from './services/TransactionRelayer';
import { accountManager } from './services/AccountManager';

/**
 * 初始化存储适配器
 * 
 * 使用 IndexedDB 作为主要存储，LocalStorage 作为配置存储
 * 必须在其他服务初始化之前完成
 */
import { storageAdapter } from './adapters/StorageAdapter';

/**
 * 初始化链管理服务
 * 
 * 管理多链配置和链切换逻辑
 */
import { chainService } from './services/ChainService';

/**
 * 初始化监控服务（可选）
 * 
 * 集成 Sentry 错误监控和性能监控
 * 通过环境变量 VITE_ENABLE_SENTRY 控制是否启用
 */
import { monitoringService } from './services/MonitoringService';

/**
 * 初始化两阶段提交服务
 * 
 * 包括 Service Worker 监控功能的初始化
 * Service Worker 用于后台监控两阶段提交任务状态
 */
import { twoPhaseCommitService } from './services/TwoPhaseCommitService';

/**
 * 初始化 Solana bridge
 *
 * 默认桥接器会挂载到 window.anDaoWalletSolanaBridge，
 * 供 MingWalletBridgeService 的 solana 链路调用。
 */
import { solanaBridgeService } from './services/SolanaBridgeService';

/**
 * 初始化 Ming 钱包协议桥接服务
 *
 * 负责监听并处理 MING_WALLET_* postMessage 协议请求，
 * 支持立即铸造、定时任务管理与封局释放等接口。
 */
import { mingWalletBridgeService } from './services/MingWalletBridgeService';

/**
 * 初始化 ApplicationRegistry 合约客户端（可选）
 */
async function initApplicationRegistryClient() {
  const contractAddress = import.meta.env.VITE_APPLICATION_REGISTRY_ADDRESS?.trim();
  if (!contractAddress) {
    console.warn('VITE_APPLICATION_REGISTRY_ADDRESS is not set, sponsor on-chain features may be degraded.');
    return;
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    console.error('Invalid VITE_APPLICATION_REGISTRY_ADDRESS:', contractAddress);
    return;
  }

  applicationRegistryClient.init(contractAddress as Address);
}

/**
 * 配置赞助商申请索引解析器（可选）
 */
async function initSponsorApplicationIndexerResolver() {
  const indexerUrl = import.meta.env.VITE_APPLICATION_INDEXER_URL?.trim();
  if (!indexerUrl) {
    return;
  }

  try {
    applicationRegistryClient.setSponsorApplicationsResolver(async ({ chainId, sponsorAddress }) => {
      const url = new URL(indexerUrl);
      url.searchParams.set('chainId', String(chainId));
      url.searchParams.set('sponsorAddress', sponsorAddress);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Indexer request failed: ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      const records = Array.isArray(payload)
        ? payload
        : (payload as { items?: unknown[] })?.items;

      if (!Array.isArray(records)) {
        return [];
      }

      const toBigIntSafe = (value: unknown, fallback: bigint): bigint => {
        if (typeof value === 'bigint') return value;
        if (typeof value === 'number' || typeof value === 'string') {
          try {
            return BigInt(value);
          } catch {
            return fallback;
          }
        }
        return fallback;
      };

      return records
        .map((record) => {
          if (!record || typeof record !== 'object') return null;
          const item = record as Record<string, unknown>;
          const applicationId = typeof item.applicationId === 'string' ? item.applicationId : '';
          const status = Number(item.status ?? 0);
          if (!applicationId) return null;
          const normalized: ApplicationRegistryRecord = {
            applicationId,
            accountAddress: (item.accountAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`,
            ownerAddress: (item.ownerAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`,
            eoaAddress: (item.eoaAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`,
            sponsorId: (item.sponsorId || sponsorAddress) as `0x${string}`,
            chainId: toBigIntSafe(item.chainId, BigInt(chainId)),
            storageIdentifier: String(item.storageIdentifier ?? ''),
            storageType: Number(item.storageType ?? 0),
            status,
            reviewStorageIdentifier: String(item.reviewStorageIdentifier ?? ''),
            createdAt: toBigIntSafe(item.createdAt, BigInt(0)),
            reviewedAt: toBigIntSafe(item.reviewedAt, BigInt(0)),
            deployedAt: toBigIntSafe(item.deployedAt, BigInt(0)),
          };
          return normalized;
        })
        .filter((item): item is ApplicationRegistryRecord => item !== null);
    });
  } catch (error) {
    console.error('Failed to initialize sponsor application indexer resolver:', error);
  }
}

/**
 * Provider 初始化状态标记
 * 
 * 用于防止重复初始化
 */
let providerInitialized = false;

/**
 * 初始化 Provider 适配器
 * 
 * 延迟初始化，等待 Store 就绪后再初始化
 * 这是因为 Provider 依赖 AccountStore 等 Store 实例
 * 
 * 初始化内容：
 * - WindowProviderAdapter：注册 window.ethereum Provider
 * - 支持 EIP-6963 钱包发现
 * - 提供标准的以太坊 Provider 接口
 */
async function initProvider() {
  if (providerInitialized) return;
  
  try {
    // 等待 Store 初始化完成，确保 Provider 读取到稳定状态
    await accountStore.waitUntilReady();
    
    const transactionRelayer = new TransactionRelayer();
    const providerAdapter = new WindowProviderAdapter();
    
    // 注册 Provider 到 window.ethereum
    // 注意：这里需要在应用加载后初始化，确保 Store 已就绪
    providerAdapter.registerProvider(accountStore, transactionRelayer, accountManager);
    providerInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Provider:', error);
  }
}

async function bootstrap() {
  try {
    // 1) 强依赖初始化（顺序执行）
    await storageAdapter.init();
    await chainService.init();
    await initApplicationRegistryClient();
    await initSponsorApplicationIndexerResolver();

    // 2) 可选服务初始化（不阻断主流程）
    await monitoringService.init().catch(console.error);
    await twoPhaseCommitService.init().catch(console.error);
    await Promise.resolve(solanaBridgeService.init()).catch(console.error);
    await mingWalletBridgeService.init().catch(console.error);

    // 3) Provider 在 Store 就绪后注册
    await initProvider();
  } catch (error) {
    console.error('Bootstrap failed:', error);
  } finally {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

bootstrap().catch(console.error);
