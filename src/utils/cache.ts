/**
 * 缓存管理
 * 
 * 提供统一的缓存接口，支持内存缓存和持久化缓存
 */

/**
 * 缓存接口
 */
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * 内存缓存
 */
class MemoryCache {
  private cache: Map<string, CacheItem<any>> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl: number = 60000): void {
    // 如果缓存已满，删除最旧的项
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * 持久化缓存（使用 localStorage）
 */
class PersistentCache {
  private prefix: string;

  constructor(prefix: string = 'cache_') {
    this.prefix = prefix;
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl: number = 60000): void {
    try {
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(`${this.prefix}${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to set cache:', error);
    }
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    try {
      const itemStr = localStorage.getItem(`${this.prefix}${key}`);
      if (!itemStr) {
        return null;
      }

      const item: CacheItem<T> = JSON.parse(itemStr);

      // 检查是否过期
      if (Date.now() - item.timestamp > item.ttl) {
        localStorage.removeItem(`${this.prefix}${key}`);
        return null;
      }

      return item.data;
    } catch (error) {
      console.warn('Failed to get cache:', error);
      return null;
    }
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    try {
      localStorage.removeItem(`${this.prefix}${key}`);
    } catch (error) {
      console.warn('Failed to delete cache:', error);
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }
}

// 导出缓存实例
export const memoryCache = new MemoryCache(100);
export const persistentCache = new PersistentCache('andaowallet_cache_');

/**
 * 统一缓存接口
 */
export class UnifiedCache {
  /**
   * 设置缓存（同时设置内存和持久化缓存）
   */
  set<T>(key: string, data: T, ttl: number = 60000, persistent: boolean = false): void {
    memoryCache.set(key, data, ttl);
    if (persistent) {
      persistentCache.set(key, data, ttl);
    }
  }

  /**
   * 获取缓存（优先从内存缓存获取）
   */
  get<T>(key: string, persistent: boolean = false): T | null {
    const memoryData = memoryCache.get<T>(key);
    if (memoryData !== null) {
      return memoryData;
    }

    if (persistent) {
      const persistentData = persistentCache.get<T>(key);
      if (persistentData !== null) {
        // 将持久化缓存的数据加载到内存缓存
        memoryCache.set(key, persistentData, 60000);
        return persistentData;
      }
    }

    return null;
  }

  /**
   * 删除缓存
   */
  delete(key: string, persistent: boolean = false): void {
    memoryCache.delete(key);
    if (persistent) {
      persistentCache.delete(key);
    }
  }

  /**
   * 清除所有缓存
   */
  clear(persistent: boolean = false): void {
    memoryCache.clear();
    if (persistent) {
      persistentCache.clear();
    }
  }
}

export const unifiedCache = new UnifiedCache();

