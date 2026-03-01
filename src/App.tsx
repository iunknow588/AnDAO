/**
 * 应用主组件
 * 
 * 初始化路由和全局状态
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from '@/stores';
import { MainLayout } from '@/components/Layout/MainLayout';
import { GlobalStyle } from '@/styles/global';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PasswordInputProvider } from '@/components/PasswordInput';
import { GlobalMessage } from '@/components/GlobalMessage';
import { RequireAuth } from '@/components/Auth/RequireAuth';

// 懒加载页面组件
const WelcomePage = lazy(() => import('@/pages/WelcomePage').then(m => ({ default: m.WelcomePage })));
const HomePage = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })));
const CreateAccountPage = lazy(() => import('@/pages/CreateAccountPage').then(m => ({ default: m.CreateAccountPage })));
const CreateAccountPathAPage = lazy(() => import('@/pages/CreateAccountPathAPage').then(m => ({ default: m.CreateAccountPathAPage })));
const CreateAccountPathBPage = lazy(() => import('@/pages/CreateAccountPathBPage').then(m => ({ default: m.CreateAccountPathBPage })));
const CreateAccountPathCPage = lazy(() => import('@/pages/CreateAccountPathCPage').then(m => ({ default: m.CreateAccountPathCPage })));
const ImportWalletPage = lazy(() => import('@/pages/ImportWalletPage').then(m => ({ default: m.ImportWalletPage })));
const UnlockWalletPage = lazy(() => import('@/pages/UnlockWalletPage').then(m => ({ default: m.UnlockWalletPage })));
const SendTransactionPage = lazy(() => import('@/pages/SendTransactionPage').then(m => ({ default: m.SendTransactionPage })));
const AssetsPage = lazy(() => import('@/pages/AssetsPage').then(m => ({ default: m.AssetsPage })));
const TransactionHistoryPage = lazy(() => import('@/pages/TransactionHistoryPage').then(m => ({ default: m.TransactionHistoryPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const GuardiansPage = lazy(() => import('@/pages/GuardiansPage').then(m => ({ default: m.GuardiansPage })));
const GuardianProposalsPage = lazy(() => import('@/pages/GuardianProposalsPage').then(m => ({ default: m.GuardianProposalsPage })));
const TwoPhaseCommitPage = lazy(() => import('@/pages/TwoPhaseCommitPage').then(m => ({ default: m.TwoPhaseCommitPage })));
const RecoveryPage = lazy(() => import('@/pages/RecoveryPage').then(m => ({ default: m.RecoveryPage })));
const PluginsPage = lazy(() => import('@/pages/PluginsPage').then(m => ({ default: m.PluginsPage })));
const SponsorDashboardPage = lazy(() => import('@/pages/SponsorDashboardPage').then(m => ({ default: m.SponsorDashboardPage })));
const PathConversionPage = lazy(() => import('@/pages/PathConversionPage').then(m => ({ default: m.PathConversionPage })));

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
        <GlobalMessage />
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<RequireAuth><HomePage /></RequireAuth>} />
                <Route path="welcome" element={<WelcomePage />} />
                <Route path="wallet/create" element={<CreateAccountPage />} />
                <Route path="wallet/create/path-a" element={<CreateAccountPathAPage />} />
                <Route path="wallet/create/path-b" element={<CreateAccountPathBPage />} />
                <Route path="wallet/create/path-c" element={<CreateAccountPathCPage />} />
                <Route path="wallet/import" element={<ImportWalletPage />} />
                <Route path="wallet/unlock" element={<UnlockWalletPage />} />
                <Route path="assets" element={<RequireAuth><AssetsPage /></RequireAuth>} />
                <Route path="send" element={<RequireAuth><SendTransactionPage /></RequireAuth>} />
                <Route path="transactions" element={<RequireAuth><TransactionHistoryPage /></RequireAuth>} />
                <Route path="settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
                <Route path="guardians" element={<RequireAuth><GuardiansPage /></RequireAuth>} />
                <Route path="guardians/proposals" element={<RequireAuth><GuardianProposalsPage /></RequireAuth>} />
                <Route path="two-phase-commit" element={<RequireAuth><TwoPhaseCommitPage /></RequireAuth>} />
                <Route path="recovery" element={<RequireAuth><RecoveryPage /></RequireAuth>} />
                <Route path="plugins" element={<RequireAuth><PluginsPage /></RequireAuth>} />
                <Route path="sponsor/dashboard" element={<RequireAuth><SponsorDashboardPage /></RequireAuth>} />
                <Route path="path-conversion" element={<RequireAuth><PathConversionPage /></RequireAuth>} />
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
