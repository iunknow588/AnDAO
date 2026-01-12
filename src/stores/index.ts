/**
 * Stores 入口文件
 * 
 * 导出所有 Store 实例
 */

import { AccountStore } from './AccountStore';
import { InteractionStore } from './InteractionStore';

export { AccountStore, accountStore } from './AccountStore';
export { InteractionStore, interactionStore } from './InteractionStore';

// Store Provider 组件
import React, { createContext, useContext, ReactNode } from 'react';
import { accountStore, AccountStore } from './AccountStore';
import { interactionStore, InteractionStore } from './InteractionStore';

interface StoreContextValue {
  accountStore: AccountStore;
  interactionStore: InteractionStore;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  return (
    <StoreContext.Provider value={{ accountStore, interactionStore }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}

