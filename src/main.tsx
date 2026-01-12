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

/**
 * 初始化存储适配器
 * 
 * 使用 IndexedDB 作为主要存储，LocalStorage 作为配置存储
 * 必须在其他服务初始化之前完成
 */
import { storageAdapter } from './adapters/StorageAdapter';
storageAdapter.init().catch(console.error);

/**
 * 初始化链管理服务
 * 
 * 管理多链配置和链切换逻辑
 */
import { chainService } from './services/ChainService';
chainService.init().catch(console.error);

/**
 * 初始化监控服务（可选）
 * 
 * 集成 Sentry 错误监控和性能监控
 * 通过环境变量 VITE_ENABLE_SENTRY 控制是否启用
 */
import { monitoringService } from './services/MonitoringService';
monitoringService.init().catch(console.error);

/**
 * 初始化两阶段提交服务
 * 
 * 包括 Service Worker 监控功能的初始化
 * Service Worker 用于后台监控两阶段提交任务状态
 */
import { twoPhaseCommitService } from './services/TwoPhaseCommitService';
twoPhaseCommitService.init().catch(console.error);

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
    // 动态导入以避免循环依赖
    const { WindowProviderAdapter } = await import('./adapters/ProviderAdapter');
    const { accountStore } = await import('./stores');
    const { TransactionRelayer } = await import('./services/TransactionRelayer');
    const { AccountManager } = await import('./services/AccountManager');
    
    const transactionRelayer = new TransactionRelayer();
    const accountManager = new AccountManager();
    const providerAdapter = new WindowProviderAdapter();
    
    // 注册 Provider 到 window.ethereum
    // 注意：这里需要在应用加载后初始化，确保 Store 已就绪
    providerAdapter.registerProvider(accountStore, transactionRelayer, accountManager);
    providerInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Provider:', error);
  }
}

/**
 * 延迟初始化 Provider
 * 
 * 在应用挂载后延迟 100ms 初始化，确保 React 组件和 Store 都已就绪
 */
setTimeout(() => {
  initProvider();
}, 100);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

