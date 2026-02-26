/**
 * 错误处理工具
 * 
 * 提供统一的错误分类和处理机制
 */

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  RPC_ERROR = 'RPC_ERROR',
  BUNDLER_ERROR = 'BUNDLER_ERROR',
  
  // 合约错误
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  INSUFFICIENT_GAS = 'INSUFFICIENT_GAS',
  SIGNATURE_INVALID = 'SIGNATURE_INVALID',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  
  // 用户错误
  AUTH_ERROR = 'AUTH_ERROR',
  PASSWORD_INVALID = 'PASSWORD_INVALID',
  ADDRESS_INVALID = 'ADDRESS_INVALID',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // 系统错误
  STORAGE_ERROR = 'STORAGE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  INIT_ERROR = 'INIT_ERROR',
  
  // 未知错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * 钱包错误类
 */
export class WalletError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public details?: unknown
  ) {
    super(message);
    this.name = 'WalletError';
    Object.setPrototypeOf(this, WalletError.prototype);
  }

  /**
   * 转换为用户友好的错误消息
   */
  toUserMessage(): string {
    switch (this.code) {
      case ErrorCode.NETWORK_ERROR:
      case ErrorCode.RPC_ERROR:
        return '网络连接失败，请检查网络连接后重试';
      
      case ErrorCode.BUNDLER_ERROR:
        return 'Bundler 服务不可用，请稍后重试';
      
      case ErrorCode.ACCOUNT_NOT_FOUND:
        return '账户不存在，请先创建账户';
      
      case ErrorCode.INSUFFICIENT_GAS:
        return 'Gas 不足，请确保账户有足够的余额';
      
      case ErrorCode.SIGNATURE_INVALID:
        return '签名验证失败';
      
      case ErrorCode.TRANSACTION_FAILED:
        return '交易执行失败';
      
      case ErrorCode.AUTH_ERROR:
      case ErrorCode.PASSWORD_INVALID:
        return '密码错误，请重新输入';
      
      case ErrorCode.ADDRESS_INVALID:
        return '地址格式不正确';
      
      case ErrorCode.VALIDATION_ERROR:
        return this.message || '输入验证失败';
      
      case ErrorCode.STORAGE_ERROR:
        return '存储操作失败';
      
      case ErrorCode.ENCRYPTION_ERROR:
        return '加密操作失败';
      
      case ErrorCode.INIT_ERROR:
        return '初始化失败';
      
      default:
        return this.message || '发生未知错误';
    }
  }

  /**
   * 判断是否为网络错误
   */
  isNetworkError(): boolean {
    return [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.RPC_ERROR,
      ErrorCode.BUNDLER_ERROR,
    ].includes(this.code);
  }

  /**
   * 判断是否为可重试的错误
   */
  isRetryable(): boolean {
    return this.isNetworkError() || this.code === ErrorCode.BUNDLER_ERROR;
  }
}

export type WalletMessageType = 'error' | 'success';

export interface WalletMessageDetail {
  type: WalletMessageType;
  message: string;
}

/**
 * 错误处理工具函数
 */
export class ErrorHandler {
  private static readonly MESSAGE_EVENT = 'wallet:message';

  /**
   * 从错误对象创建 WalletError
   */
  static fromError(error: unknown, defaultCode: ErrorCode = ErrorCode.UNKNOWN_ERROR): WalletError {
    if (error instanceof WalletError) {
      return error;
    }

    if (error instanceof Error) {
      // 尝试从错误消息中推断错误类型
      const message = error.message.toLowerCase();
      
      if (message.includes('network') || message.includes('fetch')) {
        return new WalletError(error.message, ErrorCode.NETWORK_ERROR, error);
      }
      
      if (message.includes('rpc') || message.includes('json-rpc')) {
        return new WalletError(error.message, ErrorCode.RPC_ERROR, error);
      }
      
      if (message.includes('bundler')) {
        return new WalletError(error.message, ErrorCode.BUNDLER_ERROR, error);
      }
      
      if (message.includes('insufficient') || message.includes('gas')) {
        return new WalletError(error.message, ErrorCode.INSUFFICIENT_GAS, error);
      }
      
      if (message.includes('signature') || message.includes('invalid signature')) {
        return new WalletError(error.message, ErrorCode.SIGNATURE_INVALID, error);
      }
      
      if (message.includes('account') && message.includes('not found')) {
        return new WalletError(error.message, ErrorCode.ACCOUNT_NOT_FOUND, error);
      }
      
      return new WalletError(error.message, defaultCode, error);
    }

    return new WalletError(
      String(error),
      defaultCode,
      error
    );
  }

  /**
   * 处理错误并返回用户友好的消息
   */
  static handleError(
    error: unknown,
    defaultCode: ErrorCode = ErrorCode.UNKNOWN_ERROR
  ): string {
    const walletError = this.fromError(error, defaultCode);
    return walletError.toUserMessage();
  }

  /**
   * 兼容旧调用：获取用户友好的错误消息
   */
  static getErrorMessage(
    error: unknown,
    defaultCode: ErrorCode = ErrorCode.UNKNOWN_ERROR
  ): string {
    return this.handleError(error, defaultCode);
  }

  /**
   * 记录错误日志
   */
  static logError(error: unknown, context?: string): void {
    const walletError = this.fromError(error);
    console.error(`[WalletError${context ? `: ${context}` : ''}]`, {
      code: walletError.code,
      message: walletError.message,
      details: walletError.details,
    });
  }

  /**
   * 发布全局消息事件（由 UI 组件统一消费）
   */
  private static emitMessage(detail: WalletMessageDetail): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<WalletMessageDetail>(this.MESSAGE_EVENT, { detail }));
    }
  }

  /**
   * 显示错误消息
   */
  static showError(message: string): void {
    console.error('[Error]', message);
    this.emitMessage({ type: 'error', message });
  }

  /**
   * 处理错误并显示全局错误消息
   */
  static handleAndShow(
    error: unknown,
    defaultCode: ErrorCode = ErrorCode.UNKNOWN_ERROR
  ): string {
    const message = this.handleError(error, defaultCode);
    this.showError(message);
    return message;
  }

  /**
   * 显示成功消息
   */
  static showSuccess(message: string): void {
    console.info('[Success]', message);
    this.emitMessage({ type: 'success', message });
  }
}
