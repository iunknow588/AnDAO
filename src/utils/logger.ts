/**
 * 日志系统
 * 
 * 提供统一的日志记录功能，支持不同日志级别
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: string;
  data?: unknown;
  error?: Error;
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // 最多保存1000条日志

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 获取日志级别
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, context?: string, data?: unknown, error?: Error): void {
    if (level < this.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
      data,
      error,
    };

    // 保存到内存
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // 移除最旧的日志
    }

    // 输出到控制台
    const prefix = `[${LogLevel[level]}]${context ? ` [${context}]` : ''}`;
    const timestamp = new Date(entry.timestamp).toISOString();
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`${timestamp} ${prefix}`, message, data || '');
        break;
      case LogLevel.INFO:
        console.info(`${timestamp} ${prefix}`, message, data || '');
        break;
      case LogLevel.WARN:
        console.warn(`${timestamp} ${prefix}`, message, data || '');
        break;
      case LogLevel.ERROR:
        console.error(`${timestamp} ${prefix}`, message, error || data || '');
        break;
    }
  }

  /**
   * 调试日志
   */
  debug(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  /**
   * 信息日志
   */
  info(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  /**
   * 警告日志
   */
  warn(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  /**
   * 错误日志
   */
  error(message: string, context?: string, error?: Error, data?: unknown): void {
    this.log(LogLevel.ERROR, message, context, data, error);
  }

  /**
   * 获取所有日志
   */
  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level >= level);
    }
    return [...this.logs];
  }

  /**
   * 获取最近的日志
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * 导出日志为JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * 导出日志为文本
   */
  exportLogsAsText(): string {
    return this.logs
      .map(entry => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const level = LogLevel[entry.level];
        const context = entry.context ? `[${entry.context}]` : '';
        const data = entry.data ? JSON.stringify(entry.data) : '';
        const error = entry.error ? entry.error.stack : '';
        return `${timestamp} [${level}] ${context} ${entry.message} ${data} ${error}`;
      })
      .join('\n');
  }
}

export const logger = new Logger();

// 在开发环境下设置为DEBUG级别
if (import.meta.env.DEV) {
  logger.setLevel(LogLevel.DEBUG);
}
