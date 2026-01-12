/**
 * 节流 Hook
 * 
 * 用于限制函数执行频率，常用于滚动、窗口调整等场景
 */

import { useRef, useCallback } from 'react';

/**
 * 节流回调 Hook
 * 
 * @param callback 回调函数
 * @param delay 节流延迟时间（毫秒）
 * @returns 节流后的回调函数
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRun.current;

      if (timeSinceLastRun >= delay) {
        lastRun.current = now;
        callback(...args);
      } else {
        // 清除之前的定时器
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // 设置新的定时器，确保最后一次调用也会执行
        timeoutRef.current = setTimeout(() => {
          lastRun.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastRun);
      }
    },
    [callback, delay]
  ) as T;

  return throttledCallback;
}

