/**
 * 记忆化值 Hook
 * 
 * 提供 useMemo 和 useCallback 的便捷封装
 */

import { useMemo, useCallback, DependencyList } from 'react';

type AnyFn = (...args: unknown[]) => unknown;

/**
 * 记忆化值（useMemo 的便捷封装）
 */
export function useMemoizedValue<T>(
  factory: () => T,
  deps: DependencyList
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}

/**
 * 记忆化回调（useCallback 的便捷封装）
 */
export function useMemoizedCallback<T extends AnyFn>(
  callback: T,
  deps: DependencyList
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(callback, deps) as T;
}

/**
 * 深度比较依赖的 useMemo
 * 
 * 注意：此实现使用 JSON.stringify 进行深度比较，
 * 仅适用于简单的对象结构，复杂对象建议使用专门的深度比较库
 */
export function useDeepMemo<T>(
  factory: () => T,
  deps: unknown[]
): T {
  const serializedDeps = useMemo(
    () => JSON.stringify(deps),
    [deps]
  );

  return useMemo(factory, [factory, serializedDeps]);
}
