/**
 * Service Worker - 后台监控服务
 * 
 * 负责在后台监控两阶段提交任务的状态
 * 即使页面关闭也能继续监控任务状态
 * 
 * 注意：这是一个独立的 Service Worker 文件，用于监控功能
 * 与 PWA 的 Service Worker（由 vite-plugin-pwa 生成）分离
 */

// 监控任务存储
const monitoringTasks = new Map();

// 监控定时器
let monitoringTimer = null;

/**
 * 处理来自主线程的消息
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'START_MONITORING':
      startMonitoring(data);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
      break;

    case 'STOP_MONITORING':
      stopMonitoring(data.taskId);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
      break;

    case 'TASK_STATUS_CHECK_RESULT':
      // 处理主线程返回的检查结果
      handleTaskStatusResult(data);
      break;

    default:
      console.warn('[Service Worker] Unknown message type:', type);
  }
});

/**
 * 启动监控任务
 */
function startMonitoring(config) {
  const task = {
    taskId: config.taskId,
    chainId: config.chainId,
    contractAddress: config.contractAddress,
    commitmentHash: config.commitmentHash,
    rpcUrl: config.rpcUrl,
    interval: config.interval || 5000,
    lastCheck: Date.now(),
  };

  monitoringTasks.set(config.taskId, task);

  // 启动监控循环
  if (!monitoringTimer) {
    monitoringLoop();
  }
}

/**
 * 停止监控任务
 */
function stopMonitoring(taskId) {
  monitoringTasks.delete(taskId);

  // 如果没有监控任务，停止定时器
  if (monitoringTasks.size === 0 && monitoringTimer) {
    clearTimeout(monitoringTimer);
    monitoringTimer = null;
  }
}

/**
 * 监控循环
 */
async function monitoringLoop() {
  const now = Date.now();

  // 请求主线程检查所有任务状态
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  
  for (const [taskId, task] of monitoringTasks.entries()) {
    // 检查是否到了检查时间
    if (now - task.lastCheck >= task.interval) {
      task.lastCheck = now;

      // 请求主线程检查任务状态
      clients.forEach((client) => {
        client.postMessage({
          type: 'CHECK_TASK_STATUS',
          taskId: task.taskId,
          chainId: task.chainId,
          contractAddress: task.contractAddress,
          commitmentHash: task.commitmentHash,
          rpcUrl: task.rpcUrl,
        });
      });
    }
  }

  // 继续循环
  if (monitoringTasks.size > 0) {
    monitoringTimer = setTimeout(monitoringLoop, 5000);
  } else {
    monitoringTimer = null;
  }
}

/**
 * 处理任务状态检查结果
 */
function handleTaskStatusResult(data) {
  if (data.canReveal) {
    // 通知所有客户端任务已准备好揭示
    self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'TASK_READY_TO_REVEAL',
          taskId: data.taskId,
        });
      });
    });

    // 移除监控任务
    monitoringTasks.delete(data.taskId);

    // 如果没有监控任务，停止定时器
    if (monitoringTasks.size === 0 && monitoringTimer) {
      clearTimeout(monitoringTimer);
      monitoringTimer = null;
    }
  }
}

/**
 * Service Worker 安装事件
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Monitoring service installed');
  // 立即激活
  self.skipWaiting();
});

/**
 * Service Worker 激活事件
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Monitoring service activated');
  // 立即控制所有客户端
  event.waitUntil(self.clients.claim());
});
