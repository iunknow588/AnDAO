/**
 * ErrorHandler 测试
 */

import { describe, it, expect, vi } from 'vitest';
import { ErrorHandler, ErrorCode, WalletError } from '@/utils/errors';

describe('ErrorHandler', () => {
  describe('fromError', () => {
    it('应该从 WalletError 创建 WalletError', () => {
      const error = new WalletError('Test error', ErrorCode.NETWORK_ERROR);
      const result = ErrorHandler.fromError(error);
      
      expect(result).toBe(error);
      expect(result.code).toBe(ErrorCode.NETWORK_ERROR);
    });

    it('应该从普通 Error 创建 WalletError', () => {
      const error = new Error('Network error');
      const result = ErrorHandler.fromError(error);
      
      expect(result).toBeInstanceOf(WalletError);
      expect(result.message).toBe('Network error');
      expect(result.code).toBe(ErrorCode.NETWORK_ERROR);
    });

    it('应该从字符串创建 WalletError', () => {
      const error = 'Unknown error';
      const result = ErrorHandler.fromError(error);
      
      expect(result).toBeInstanceOf(WalletError);
      expect(result.message).toBe('Unknown error');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('应该识别网络错误', () => {
      const error = new Error('Network request failed');
      const result = ErrorHandler.fromError(error);
      
      expect(result.code).toBe(ErrorCode.NETWORK_ERROR);
    });

    it('应该识别 RPC 错误', () => {
      const error = new Error('RPC error occurred');
      const result = ErrorHandler.fromError(error);
      
      expect(result.code).toBe(ErrorCode.RPC_ERROR);
    });

    it('应该识别 Gas 不足错误', () => {
      const error = new Error('Insufficient gas');
      const result = ErrorHandler.fromError(error);
      
      expect(result.code).toBe(ErrorCode.INSUFFICIENT_GAS);
    });
  });

  describe('handleError', () => {
    it('应该返回用户友好的错误消息', () => {
      const error = new WalletError('Test', ErrorCode.NETWORK_ERROR);
      const message = ErrorHandler.handleError(error);
      
      expect(message).toBe('网络连接失败，请检查网络连接后重试');
    });

    it('应该处理未知错误', () => {
      const error = new Error('Unknown error');
      const message = ErrorHandler.handleError(error);
      
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
  });

  describe('logError', () => {
    it('应该记录错误而不抛出异常', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      
      ErrorHandler.logError(error, 'Test context');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

describe('WalletError', () => {
  describe('toUserMessage', () => {
    it('应该返回网络错误的用户友好消息', () => {
      const error = new WalletError('Network error', ErrorCode.NETWORK_ERROR);
      const message = error.toUserMessage();
      
      expect(message).toBe('网络连接失败，请检查网络连接后重试');
    });

    it('应该返回密码错误的用户友好消息', () => {
      const error = new WalletError('Invalid password', ErrorCode.PASSWORD_INVALID);
      const message = error.toUserMessage();
      
      expect(message).toBe('密码错误，请重新输入');
    });
  });

  describe('isNetworkError', () => {
    it('应该正确识别网络错误', () => {
      const error = new WalletError('Network error', ErrorCode.NETWORK_ERROR);
      expect(error.isNetworkError()).toBe(true);
    });

    it('应该正确识别非网络错误', () => {
      const error = new WalletError('Auth error', ErrorCode.AUTH_ERROR);
      expect(error.isNetworkError()).toBe(false);
    });
  });

  describe('isRetryable', () => {
    it('应该正确识别可重试的错误', () => {
      const error = new WalletError('Network error', ErrorCode.NETWORK_ERROR);
      expect(error.isRetryable()).toBe(true);
    });

    it('应该正确识别不可重试的错误', () => {
      const error = new WalletError('Auth error', ErrorCode.AUTH_ERROR);
      expect(error.isRetryable()).toBe(false);
    });
  });
});

