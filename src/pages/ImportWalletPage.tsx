/**
 * 导入钱包页面
 * 
 * 允许用户导入已有的智能合约账户
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { useNavigate } from 'react-router-dom';
import { accountManager } from '@/services/AccountManager';
import { DEFAULT_CHAIN_CONFIG } from '@/config/chains';

const Container = styled.div`
  max-width: 600px;
  margin: 0 auto;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #1a1a1a;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  margin-bottom: 16px;

  &:focus {
    outline: none;
    border-color: #4c6ef5;
  }
`;

const Button = styled.button`
  width: 100%;
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

const ErrorMessage = styled.div`
  color: #e03131;
  font-size: 14px;
  margin-top: 8px;
`;

const SuccessMessage = styled.div`
  color: #2f9e44;
  font-size: 14px;
  margin-top: 8px;
`;

export const ImportWalletPage = observer(() => {
  const { accountStore } = useStore();
  const navigate = useNavigate();
  const [accountAddress, setAccountAddress] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');
  const [chainId, setChainId] = useState(DEFAULT_CHAIN_CONFIG.chainId.toString());
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleImport = async () => {
    if (!accountAddress || !accountAddress.startsWith('0x') || accountAddress.length !== 42) {
      setError('Invalid account address');
      return;
    }

    if (!ownerAddress || !ownerAddress.startsWith('0x') || ownerAddress.length !== 42) {
      setError('Invalid owner address');
      return;
    }

    const chainIdNum = parseInt(chainId, 10);
    if (isNaN(chainIdNum)) {
      setError('Invalid chain ID');
      return;
    }

    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      // 检查账户是否存在
      const exists = await accountManager.accountExists(accountAddress as `0x${string}`, chainIdNum);
      if (!exists) {
        setError('Account does not exist on chain');
        setIsImporting(false);
        return;
      }

      // 创建账户信息（不实际创建，只是导入）
      const accountInfo: AccountInfo = {
        address: accountAddress,
        chainId: chainIdNum,
        owner: ownerAddress,
        createdAt: Date.now(),
      };

      // 手动保存到 AccountManager（因为这是导入，不是创建）
      // 需要直接操作 AccountManager 的内部存储
      const { storageAdapter } = await import('@/adapters/StorageAdapter');
      const { StorageKey } = await import('@/types');
      const storedAccounts = await storageAdapter.get<AccountInfo[]>(StorageKey.ACCOUNTS) || [];
      storedAccounts.push(accountInfo);
      await storageAdapter.set(StorageKey.ACCOUNTS, storedAccounts);

      // 添加到 AccountStore
      await accountStore.addAccount(accountInfo);
      
      setSuccess('Account imported successfully');
      
      // 延迟跳转
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import account');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Container>
      <Card>
        <Title>导入智能合约账户</Title>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          导入已有的智能合约账户。请提供账户地址和所有者地址。
        </p>

        <Input
          type="text"
          placeholder="账户地址 (0x...)"
          value={accountAddress}
          onChange={(e) => setAccountAddress(e.target.value)}
          disabled={isImporting}
        />

        <Input
          type="text"
          placeholder="所有者地址 (0x...)"
          value={ownerAddress}
          onChange={(e) => setOwnerAddress(e.target.value)}
          disabled={isImporting}
        />

        <Input
          type="text"
          placeholder="链 ID"
          value={chainId}
          onChange={(e) => setChainId(e.target.value)}
          disabled={isImporting}
        />

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {success && <SuccessMessage>{success}</SuccessMessage>}

        <Button onClick={handleImport} disabled={isImporting || !accountAddress || !ownerAddress}>
          {isImporting ? '导入中...' : '导入账户'}
        </Button>
      </Card>
    </Container>
  );
});

