/**
 * 性能优化工具
 * 
 * 提供性能监控、缓存、防抖节流等功能
 * 
 * 注意：请求缓存使用统一的缓存实现（memoryCache），避免代码重复
 */

import { memoryCache } from './cache';

type AnyFn = (...args: unknown[]) => unknown;

/**
 * 防抖函数
 */
export function debounce<T extends AnyFn>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends AnyFn>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * 带缓存的请求
 * 
 * 使用统一的 memoryCache 实现，避免代码重复
 * 
 * @param key 缓存键
 * @param requestFn 请求函数
 * @param ttl 缓存时间（毫秒），默认 60 秒
 * @returns 请求结果（从缓存或实际请求）
 */
export async function cachedRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  ttl: number = 60000
): Promise<T> {
  const cached = memoryCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await requestFn();
  memoryCache.set(key, data, ttl);
  return data;
}

/**
 * 性能监控
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  /**
   * 开始计时
   */
  start(label: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      const times = this.metrics.get(label) || [];
      times.push(duration);
      this.metrics.set(label, times);
    };
  }

  /**
   * 获取指标
   */
  getMetrics(label?: string): Record<string, { avg: number; min: number; max: number; count: number }> {
    if (label) {
      const times = this.metrics.get(label);
      if (!times || times.length === 0) {
        return {};
      }

      return {
        [label]: {
          avg: times.reduce((a, b) => a + b, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          count: times.length,
        },
      };
    }

    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    for (const [key, times] of this.metrics.entries()) {
      result[key] = {
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        count: times.length,
      };
    }
    return result;
  }

  /**
   * 清除指标
   */
  clear(): void {
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * 批量请求
 */
export async function batchRequest<T, R>(
  items: T[],
  requestFn: (item: T) => Promise<R>,
  batchSize: number = 5
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(requestFn));
    results.push(...batchResults);
  }

  return results;
}

/**
 * 延迟加载
 */
export function lazyLoad<T>(
  importFn: () => Promise<{ default: T }>
): () => Promise<T> {
  let promise: Promise<T> | null = null;

  return async () => {
    if (!promise) {
      promise = importFn().then((module) => module.default);
    }
    return promise;
  };
}
