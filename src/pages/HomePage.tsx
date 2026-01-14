/**
 * 首页
 * 
 * 显示账户概览和快速操作
 */

import React from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { useNavigate } from 'react-router-dom';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #1a1a1a;
`;

const Button = styled.button`
  background: #4c6ef5;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #3b5bdb;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const AddressDisplay = styled.div`
  font-family: monospace;
  font-size: 14px;
  color: #666;
  word-break: break-all;
  margin: 16px 0;
`;

export const HomePage = observer(() => {
  const { accountStore } = useStore();
  const navigate = useNavigate();

  const handleCreateAccount = () => {
    // 跳转到三路径账户创建统一入口，而不是旧的单一路径创建页面
    navigate('/welcome');
  };

  const handleSendTransaction = () => {
    navigate('/send');
  };

  return (
    <Container>
      <Title>AnDaoWallet</Title>

      {accountStore.currentAccount ? (
        <>
          <Card>
            <h2>账户信息</h2>
            <AddressDisplay>
              <strong>地址:</strong> {accountStore.currentAccountAddress}
            </AddressDisplay>
            <AddressDisplay>
              <strong>链 ID:</strong> {accountStore.currentAccount.chainId}
            </AddressDisplay>
          </Card>

          <Card>
            <h2>快速操作</h2>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <Button onClick={handleSendTransaction}>发送交易</Button>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <h2>欢迎使用 AnDaoWallet</h2>
          <p>创建一个智能合约账户开始使用</p>
          <Button onClick={handleCreateAccount} style={{ marginTop: '16px' }}>
            创建账户
          </Button>
        </Card>
      )}
    </Container>
  );
});

