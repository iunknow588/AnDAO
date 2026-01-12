/**
 * Service Worker 监控管理器
 * 
 * 负责管理 Service Worker 的注册、通信和监控任务
 * 提供统一的接口来启动和停止后台监控
 * 
 * @module serviceWorker/MonitoringServiceWorker
 */

/**
 * 监控任务配置
 */
export interface MonitoringTaskConfig {
  taskId: string;
  chainId: number;
  contractAddress: string;
  commitmentHash: string;
  rpcUrl: string;
  interval?: number; // 检查间隔（毫秒），默认 5000
}

/**
 * Service Worker 监控管理器
 */
export class MonitoringServiceWorker {
  private registration: ServiceWorkerRegistration | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  /**
   * 初始化 Service Worker
   */
  async init(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[MonitoringServiceWorker] Service Worker not supported');
      return;
    }

    try {
      // 注册 Service Worker
      this.registration = await navigator.serviceWorker.register(
        '/monitoring-sw.js',
        { scope: '/' }
      );

      console.log('[MonitoringServiceWorker] Service Worker registered:', this.registration.scope);

      // 监听 Service Worker 消息
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleMessage(event);
      });

      // 监听 Service Worker 更新
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('[MonitoringServiceWorker] New Service Worker activated');
            }
          });
        }
      });
    } catch (error) {
      console.error('[MonitoringServiceWorker] Service Worker registration failed:', error);
    }
  }

  /**
   * 处理来自 Service Worker 的消息
   */
  private handleMessage(event: MessageEvent): void {
    const { type, data } = event.data;

    // 调用注册的处理器
    const handler = this.messageHandlers.get(type);
    if (handler) {
      handler(data);
    }

    // 处理特定消息类型
    switch (type) {
      case 'TASK_READY_TO_REVEAL':
        // 触发自定义事件
        window.dispatchEvent(
          new CustomEvent('two-phase-commit:ready-to-reveal', {
            detail: { taskId: data.taskId },
          })
        );
        break;

      case 'CHECK_TASK_STATUS':
        // Service Worker 请求检查任务状态
        this.checkTaskStatusInMainThread(data);
        break;

      default:
        console.debug('[MonitoringServiceWorker] Unknown message type:', type);
    }
  }

  /**
   * 在主线程中检查任务状态
   * 
   * Service Worker 请求检查时，在主线程执行实际的合约调用
   * 然后将结果发送回 Service Worker
   */
  private async checkTaskStatusInMainThread(data: {
    taskId: string;
    chainId: number;
    contractAddress: string;
    commitmentHash: string;
    rpcUrl: string;
  }): Promise<void> {
    try {
      // 动态导入检查函数（避免循环依赖）
      const { checkCanReveal } = await import('./checkTaskStatus');
      const canReveal = await checkCanReveal(
        data.chainId,
        data.contractAddress,
        data.commitmentHash,
        data.rpcUrl
      );

      // 发送结果回 Service Worker
      if (this.registration?.active) {
        this.registration.active.postMessage({
          type: 'TASK_STATUS_CHECK_RESULT',
          data: {
            taskId: data.taskId,
            canReveal,
          },
        });
      }
    } catch (error) {
      console.error('[MonitoringServiceWorker] Error checking task status:', error);
    }
  }

  /**
   * 注册消息处理器
   */
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * 启动监控任务
   */
  async startMonitoring(config: MonitoringTaskConfig): Promise<void> {
    if (!this.registration?.active) {
      throw new Error('Service Worker not ready');
    }

    this.registration.active.postMessage({
      type: 'START_MONITORING',
      data: {
        taskId: config.taskId,
        chainId: config.chainId,
        contractAddress: config.contractAddress,
        commitmentHash: config.commitmentHash,
        rpcUrl: config.rpcUrl,
        interval: config.interval || 5000,
      },
    });
  }

  /**
   * 停止监控任务
   */
  async stopMonitoring(taskId: string): Promise<void> {
    if (!this.registration?.active) {
      return;
    }

    this.registration.active.postMessage({
      type: 'STOP_MONITORING',
      data: { taskId },
    });
  }

  /**
   * 检查 Service Worker 是否可用
   */
  isAvailable(): boolean {
    return 'serviceWorker' in navigator && this.registration !== null;
  }
}

// 单例实例
export const monitoringServiceWorker = new MonitoringServiceWorker();
