/**
 * 监控服务
 * 
 * 集成 Sentry 错误监控和性能监控
 * 可选功能，通过环境变量控制
 */

interface MonitoringConfig {
  enabled: boolean;
  sentryDsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}

class MonitoringService {
  private initialized = false;
  private config: MonitoringConfig = {
    enabled: false,
    tracesSampleRate: 0.1, // 10% 的请求采样
  };

  /**
   * 初始化监控服务
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 检查是否启用监控
    const enableSentry = import.meta.env.VITE_ENABLE_SENTRY === 'true';
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

    if (!enableSentry || !sentryDsn) {
      console.log('[Monitoring] Sentry 未启用或未配置 DSN');
      return;
    }

    this.config = {
      enabled: true,
      sentryDsn,
      environment: import.meta.env.MODE || 'development',
      release: import.meta.env.VITE_APP_VERSION || '0.1.0',
      tracesSampleRate: 0.1,
    };

    try {
      // 动态导入 Sentry（可选依赖）
      const Sentry = await this.loadSentry();
      
      if (Sentry) {
        Sentry.init({
          dsn: this.config.sentryDsn,
          environment: this.config.environment,
          release: this.config.release,
          tracesSampleRate: this.config.tracesSampleRate,
          integrations: [
            // 浏览器集成
            Sentry.browserTracingIntegration(),
          ],
          // 忽略某些错误
          ignoreErrors: [
            // 浏览器扩展相关错误
            'ResizeObserver loop limit exceeded',
            'Non-Error promise rejection captured',
          ],
          // 忽略某些 URL
          denyUrls: [
            // 浏览器扩展
            /extensions\//i,
            /^chrome:\/\//i,
            /^moz-extension:\/\//i,
          ],
        });

        this.initialized = true;
        console.log('[Monitoring] Sentry 初始化成功');
      }
    } catch (error) {
      console.warn('[Monitoring] Sentry 初始化失败:', error);
    }
  }

  /**
   * 动态加载 Sentry（可选依赖）
   */
  private async loadSentry(): Promise<any> {
    try {
      // 如果安装了 @sentry/react，则使用它
      const Sentry = await import('@sentry/react');
      return Sentry;
    } catch (error) {
      console.warn('[Monitoring] @sentry/react 未安装，跳过 Sentry 集成');
      return null;
    }
  }

  /**
   * 捕获异常
   */
  captureException(error: Error, context?: Record<string, any>): void {
    if (!this.config.enabled || !this.initialized) {
      return;
    }

    // 动态调用 Sentry（如果已加载）
    this.loadSentry().then((Sentry) => {
      if (Sentry) {
        Sentry.captureException(error, {
          extra: context,
        });
      }
    });
  }

  /**
   * 捕获消息
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.config.enabled || !this.initialized) {
      return;
    }

    // 动态调用 Sentry（如果已加载）
    this.loadSentry().then((Sentry) => {
      if (Sentry) {
        Sentry.captureMessage(message, {
          level: level as any,
        });
      }
    });
  }

  /**
   * 设置用户上下文
   */
  setUser(user: { id?: string; email?: string; username?: string }): void {
    if (!this.config.enabled || !this.initialized) {
      return;
    }

    // 动态调用 Sentry（如果已加载）
    this.loadSentry().then((Sentry) => {
      if (Sentry) {
        Sentry.setUser(user);
      }
    });
  }

  /**
   * 设置标签
   */
  setTag(key: string, value: string): void {
    if (!this.config.enabled || !this.initialized) {
      return;
    }

    // 动态调用 Sentry（如果已加载）
    this.loadSentry().then((Sentry) => {
      if (Sentry) {
        Sentry.setTag(key, value);
      }
    });
  }

  /**
   * 设置额外上下文
   */
  setContext(key: string, context: Record<string, any>): void {
    if (!this.config.enabled || !this.initialized) {
      return;
    }

    // 动态调用 Sentry（如果已加载）
    this.loadSentry().then((Sentry) => {
      if (Sentry) {
        Sentry.setContext(key, context);
      }
    });
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// 导出单例
export const monitoringService = new MonitoringService();

