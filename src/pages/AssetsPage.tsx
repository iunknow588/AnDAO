/**
 * 资产管理页面
 * 
 * 参考 Keplr 钱包的资产展示设计，但代码完全独立实现
 */

import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { createPublicClient, http, formatEther } from 'viem';
import { CHAIN_GROUPS } from '@/config/chains';
import { getChainNativeSymbol, requireChainConfig } from '@/utils/chainConfigValidation';
import { ErrorHandler } from '@/utils/errors';

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
    // 这里仅在账户切换时刷新余额，避免 loadBalance 引用变化导致重复请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountStore.currentAccount]);

  const loadBalance = async () => {
    if (!accountStore.currentAccount) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const account = accountStore.currentAccount;
      const chainId = account.chainId;
      const address = account.address as `0x${string}`;
      
      console.log('[AssetsPage] 加载余额:', {
        chainId,
        address,
        accountChainId: account.chainId,
      });

      const chainConfig = requireChainConfig(chainId, ['rpcUrl']);

      console.log('[AssetsPage] 使用链配置:', {
        chainId: chainConfig.chainId,
        name: chainConfig.name,
        rpcUrl: chainConfig.rpcUrl,
      });

      const publicClient = createPublicClient({
        transport: http(chainConfig.rpcUrl),
      });

      console.log('[AssetsPage] 从 RPC 查询余额:', chainConfig.rpcUrl);
      const balanceWei = await publicClient.getBalance({
        address: address,
      });

      console.log('[AssetsPage] 余额查询结果:', {
        balanceWei: balanceWei.toString(),
        balanceEther: formatEther(balanceWei),
      });

      setBalance(formatEther(balanceWei));
    } catch (err) {
      console.error('[AssetsPage] 加载余额失败:', err);
      setError(ErrorHandler.handleAndShow(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (!accountStore.currentAccount) {
    return (
      <Container>
        <Card>
          <Title>未选择账户</Title>
          <p>请先创建或导入账户</p>
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
            accountStore.setCurrentChain(chainId);
            // 切换链后重新加载余额
            setTimeout(() => {
              loadBalance();
            }, 100);
          }}
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
                {getChainNativeSymbol(accountStore.currentAccount.chainId)}
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
