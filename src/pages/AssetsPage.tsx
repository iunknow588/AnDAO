/**
 * 资产管理页面
 * 
 * 参考 Keplr 钱包的资产展示设计，但代码完全独立实现
 */

import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { createPublicClient, http, formatEther } from 'viem';
import { getChainConfigByChainId } from '@/config/chains';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 16px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #1a1a1a;
`;

const AddressDisplay = styled.div`
  background: #f5f5f5;
  border-radius: 8px;
  padding: 12px;
  font-family: monospace;
  font-size: 14px;
  margin-bottom: 16px;
  word-break: break-all;
`;

const BalanceDisplay = styled.div`
  text-align: center;
  margin: 24px 0;
`;

const BalanceAmount = styled.div`
  font-size: 32px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
`;

const BalanceLabel = styled.div`
  font-size: 14px;
  color: #666;
`;

const ChainSelector = styled.select`
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  margin-bottom: 16px;
  background: #ffffff;
  cursor: pointer;

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

const LoadingText = styled.div`
  text-align: center;
  color: #666;
  padding: 24px;
`;

const ErrorText = styled.div`
  color: #e03131;
  font-size: 14px;
  margin-top: 8px;
`;

export const AssetsPage = observer(() => {
  const { accountStore } = useStore();
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accountStore.currentAccount) {
      loadBalance();
    }
  }, [accountStore.currentAccount]);

  const loadBalance = async () => {
    if (!accountStore.currentAccount) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const chainConfig = getChainConfigByChainId(accountStore.currentAccount.chainId);
      if (!chainConfig) {
        throw new Error('Chain config not found');
      }

      const publicClient = createPublicClient({
        transport: http(chainConfig.rpcUrl),
      });

      const balanceWei = await publicClient.getBalance({
        address: accountStore.currentAccount.address as `0x${string}`,
      });

      setBalance(formatEther(balanceWei));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load balance');
    } finally {
      setIsLoading(false);
    }
  };

  if (!accountStore.currentAccount) {
    return (
      <Container>
        <Card>
          <Title>No Account</Title>
          <p>Please create an account first</p>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Card>
        <Title>资产总览</Title>
        
        <ChainSelector
          value={accountStore.currentAccount.chainId}
          onChange={(e) => {
            const chainId = parseInt(e.target.value);
            accountStore.setCurrentChain(chainId as any);
          }}
        >
          <option value={5000}>Mantle</option>
          <option value={5001}>Mantle Testnet</option>
        </ChainSelector>

        <AddressDisplay>
          {accountStore.currentAccount.address}
        </AddressDisplay>

        <BalanceDisplay>
          {isLoading ? (
            <LoadingText>加载中...</LoadingText>
          ) : (
            <>
              <BalanceAmount>{balance}</BalanceAmount>
              <BalanceLabel>
                {getChainConfigByChainId(accountStore.currentAccount.chainId)?.nativeCurrency.symbol || 'ETH'}
              </BalanceLabel>
            </>
          )}
        </BalanceDisplay>

        {error && <ErrorText>{error}</ErrorText>}

        <Button onClick={loadBalance} disabled={isLoading}>
          {isLoading ? '刷新中...' : '刷新余额'}
        </Button>
      </Card>
    </Container>
  );
});

