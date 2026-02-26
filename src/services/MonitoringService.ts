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

type SentryLike = {
  init: (options: Record<string, unknown>) => void;
  browserTracingIntegration: () => unknown;
  captureException: (error: Error, options?: { extra?: Record<string, unknown> }) => void;
  captureMessage: (
    message: string,
    options?: { level: 'info' | 'warning' | 'error' }
  ) => void;
  setUser: (user: { id?: string; email?: string; username?: string }) => void;
  setTag: (key: string, value: string) => void;
  setContext: (key: string, context: Record<string, unknown>) => void;
};

function redactSensitiveString(input: string): string {
  // 1) 典型 0x 私钥（32 bytes = 64 hex chars）
  const hexPk = /\b0x[a-fA-F0-9]{64}\b/g;
  // 2) 助记词：粗略匹配“12-24 个以空格分隔的单词”，避免误杀，宁可保守
  const mnemonicLike =
    /\b([a-zA-Z]{3,}\s+){11,23}[a-zA-Z]{3,}\b/g;
  // 3) 明确关键词
  const keywordSecrets =
    /(private\s*key|privkey|secret\s*key|mnemonic|seed\s*phrase|助记词|私钥)/gi;

  return input
    .replace(hexPk, '[REDACTED_PRIVATE_KEY]')
    .replace(mnemonicLike, '[REDACTED_MNEMONIC]')
    .replace(keywordSecrets, '[REDACTED]');
}

function redactSensitiveValue(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveString(value);
  if (value && typeof value === 'object') {
    // 深拷贝并脱敏常见字段名（保守处理，避免把用户输入带出浏览器）
    const sensitiveKeys = new Set([
      'privateKey',
      'privKey',
      'mnemonic',
      'seed',
      'seedPhrase',
      'password',
      'passphrase',
      'secret',
    ]);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (sensitiveKeys.has(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSensitiveValue(v);
      }
    }
    return out;
  }
  return value;
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
          // ⚠️ 安全：对上报内容做脱敏，避免私钥/助记词被意外带出浏览器
          beforeSend(event: Record<string, unknown>) {
            try {
              // message / exception
              if (event?.message) event.message = redactSensitiveString(String(event.message));
              const eventRecord = event as Record<string, unknown>;
              const exceptionRecord = eventRecord.exception as
                | { values?: Array<Record<string, unknown>> }
                | undefined;
              if (Array.isArray(exceptionRecord?.values)) {
                exceptionRecord.values = exceptionRecord.values.map((ex) => ({
                  ...ex,
                  value: ex.value ? redactSensitiveString(String(ex.value)) : ex.value,
                }));
              }

              // extra / contexts / tags（都可能携带业务上下文）
              if (event?.extra) event.extra = redactSensitiveValue(event.extra);
              if (event?.contexts) event.contexts = redactSensitiveValue(event.contexts);
              if (event?.tags) event.tags = redactSensitiveValue(event.tags);

              // breadcrumbs（部分 SDK 可能记录 console / fetch）
              const breadcrumbs = (eventRecord.breadcrumbs as Array<Record<string, unknown>> | undefined);
              if (Array.isArray(breadcrumbs)) {
                eventRecord.breadcrumbs = breadcrumbs.map((b) => ({
                  ...b,
                  message: b.message ? redactSensitiveString(String(b.message)) : b.message,
                  data: b.data ? redactSensitiveValue(b.data) : b.data,
                }));
              }
            } catch {
              // 脱敏失败不阻塞上报，但尽量不抛出异常影响业务
            }
            return event;
          },
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
   * 
   * 注意：@sentry/react 是可选的，如果未安装则返回 null
   * 使用字符串形式的 import() 避免 Vite 在构建时尝试解析
   */
  private async loadSentry(): Promise<SentryLike | null> {
    try {
      // 检查环境变量，如果未启用 Sentry，直接返回 null
      const enableSentry = import.meta.env.VITE_ENABLE_SENTRY === 'true';
      if (!enableSentry) {
        return null;
      }

      // 使用动态 import，如果模块不存在会抛出错误
      // 使用字符串拼接避免 Vite 静态分析
      const sentryModule = '@sentry/react';
      const Sentry = (await import(/* @vite-ignore */ sentryModule)) as unknown as SentryLike;
      return Sentry;
    } catch (error) {
      // 模块不存在或加载失败，这是正常的（Sentry 是可选的）
      console.debug('[Monitoring] @sentry/react 未安装或加载失败，跳过 Sentry 集成:', error);
      return null;
    }
  }

  /**
   * 捕获异常
   */
  captureException(error: Error, context?: Record<string, unknown>): void {
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
          level,
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
  setContext(key: string, context: Record<string, unknown>): void {
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
