/**
 * Stores 入口文件
 * 
 * 导出所有 Store 实例，并提供 StoreProvider 组件
 */

// Store Provider 组件
import React, { createContext, useContext, ReactNode } from 'react';
import { accountStore, AccountStore } from './AccountStore';
import { interactionStore, InteractionStore } from './InteractionStore';

// 统一导出 Store 类型和实例，供外部使用
export { AccountStore, accountStore } from './AccountStore';
export { InteractionStore, interactionStore } from './InteractionStore';

interface StoreContextValue {
  accountStore: AccountStore;
  interactionStore: InteractionStore;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  // 注意：此文件为 .ts 扩展名，不能直接使用 JSX
  // 使用 React.createElement 以避免 TypeScript 对 JSX 的解析错误
  return React.createElement(
    StoreContext.Provider,
    { value: { accountStore, interactionStore } },
    children
  );
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}

