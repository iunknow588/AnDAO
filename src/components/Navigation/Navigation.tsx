/**
 * 导航组件
 * 
 * 参考 Keplr 钱包的导航设计，但代码完全独立实现
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { CHAIN_GROUPS } from '@/config/chains';

const Nav = styled.nav`
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
`;

const NavLinks = styled.div`
  display: flex;
  gap: 32px;
  align-items: center;
`;

const NavLink = styled(Link)<{ $active?: boolean }>`
  color: ${props => props.$active ? '#4c6ef5' : '#666'};
  text-decoration: none;
  font-size: 16px;
  font-weight: ${props => props.$active ? '600' : '400'};
  padding: 8px 0;
  border-bottom: 2px solid ${props => props.$active ? '#4c6ef5' : 'transparent'};
  transition: all 0.2s;

  &:hover {
    color: #4c6ef5;
  }
`;

const AccountInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const AddressDisplay = styled.div`
  font-size: 14px;
  color: #666;
  font-family: monospace;
`;

const ChainSelector = styled.select`
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  background: #ffffff;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #4c6ef5;
  }
`;

export const Navigation = observer(() => {
  const { accountStore } = useStore();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleChainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chainId = parseInt(e.target.value);
    accountStore.setCurrentChain(chainId);
  };

  return (
    <Nav>
      <NavLinks>
        <NavLink to="/" $active={isActive('/')}>
          首页
        </NavLink>
        <NavLink to="/assets" $active={isActive('/assets')}>
          资产
        </NavLink>
        <NavLink to="/send" $active={isActive('/send')}>
          发送
        </NavLink>
        <NavLink to="/wallet/create" $active={isActive('/wallet')}>
          钱包
        </NavLink>
      </NavLinks>

      <AccountInfo>
        <ChainSelector
          value={accountStore.currentChainId}
          onChange={handleChainChange}
        >
          {CHAIN_GROUPS.map((group) => (
            <optgroup key={group.key} label={group.label}>
              {group.networks.map((network) => (
                <option key={network.chainId} value={network.chainId}>
                  {network.name}
                </option>
              ))}
            </optgroup>
          ))}
        </ChainSelector>

        {accountStore.currentAccount && (
          <AddressDisplay>
            {accountStore.currentAccount.address.slice(0, 6)}...
            {accountStore.currentAccount.address.slice(-4)}
          </AddressDisplay>
        )}
      </AccountInfo>
    </Nav>
  );
});
