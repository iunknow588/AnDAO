/**
 * 主布局组件
 * 
 * 参考 Keplr 钱包的布局风格，但代码完全独立实现
 */

import styled from 'styled-components';
import { Outlet } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';

const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #f5f5f5;
`;

const MainContent = styled.main`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const Footer = styled.footer`
  padding: 16px 24px;
  background-color: #ffffff;
  border-top: 1px solid #e0e0e0;
  text-align: center;
  font-size: 12px;
  color: #666;
`;

export function MainLayout() {
  return (
    <LayoutContainer>
      <Navigation />
      <MainContent>
        <Outlet />
      </MainContent>
      <Footer>AnDaoWallet - Smart Contract Wallet</Footer>
    </LayoutContainer>
  );
}

