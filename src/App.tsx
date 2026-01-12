/**
 * 应用主组件
 * 
 * 初始化路由和全局状态
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from '@/stores';
import { MainLayout } from '@/components/Layout/MainLayout';
import { GlobalStyle } from '@/styles/global';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PasswordInputProvider } from '@/components/PasswordInput';

// 懒加载页面组件
const HomePage = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })));
const CreateAccountPage = lazy(() => import('@/pages/CreateAccountPage').then(m => ({ default: m.CreateAccountPage })));
const ImportWalletPage = lazy(() => import('@/pages/ImportWalletPage').then(m => ({ default: m.ImportWalletPage })));
const UnlockWalletPage = lazy(() => import('@/pages/UnlockWalletPage').then(m => ({ default: m.UnlockWalletPage })));
const SendTransactionPage = lazy(() => import('@/pages/SendTransactionPage').then(m => ({ default: m.SendTransactionPage })));
const AssetsPage = lazy(() => import('@/pages/AssetsPage').then(m => ({ default: m.AssetsPage })));
const TransactionHistoryPage = lazy(() => import('@/pages/TransactionHistoryPage').then(m => ({ default: m.TransactionHistoryPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const GuardiansPage = lazy(() => import('@/pages/GuardiansPage').then(m => ({ default: m.GuardiansPage })));
const TwoPhaseCommitPage = lazy(() => import('@/pages/TwoPhaseCommitPage').then(m => ({ default: m.TwoPhaseCommitPage })));
const RecoveryPage = lazy(() => import('@/pages/RecoveryPage').then(m => ({ default: m.RecoveryPage })));
const PluginsPage = lazy(() => import('@/pages/PluginsPage').then(m => ({ default: m.PluginsPage })));

// 加载中组件
const LoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    fontSize: '16px',
    color: '#666'
  }}>
    加载中...
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <GlobalStyle />
        <PasswordInputProvider />
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<HomePage />} />
                <Route path="wallet/create" element={<CreateAccountPage />} />
                <Route path="wallet/import" element={<ImportWalletPage />} />
                <Route path="wallet/unlock" element={<UnlockWalletPage />} />
                <Route path="assets" element={<AssetsPage />} />
                <Route path="send" element={<SendTransactionPage />} />
                <Route path="transactions" element={<TransactionHistoryPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="guardians" element={<GuardiansPage />} />
                <Route path="two-phase-commit" element={<TwoPhaseCommitPage />} />
                <Route path="recovery" element={<RecoveryPage />} />
                <Route path="plugins" element={<PluginsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </StoreProvider>
    </ErrorBoundary>
  );
}

export default App;

