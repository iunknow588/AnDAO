/**
 * 交易历史页面
 * 
 * 显示交易历史记录
 */

import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { transactionHistoryService, TransactionHistory } from '@/services/TransactionHistoryService';
import { formatUnits } from 'viem';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #1a1a1a;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 16px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const TableHeader = styled.thead`
  background: #f8f9fa;
`;

const TableRow = styled.tr`
  border-bottom: 1px solid #e0e0e0;

  &:hover {
    background: #f8f9fa;
  }
`;

const TableHeaderCell = styled.th`
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #666;
  font-size: 14px;
`;

const TableCell = styled.td`
  padding: 12px;
  font-size: 14px;
  color: #1a1a1a;
`;

const StatusBadge = styled.span<{ status: TransactionHistory['status'] }>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'success':
        return '#d3f9d8';
      case 'pending':
        return '#fff3bf';
      case 'failed':
        return '#ffe3e3';
      default:
        return '#e0e0e0';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'success':
        return '#2f9e44';
      case 'pending':
        return '#f59f00';
      case 'failed':
        return '#e03131';
      default:
        return '#666';
    }
  }};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px;
  color: #666;
`;

export const TransactionHistoryPage = observer(() => {
  const { accountStore } = useStore();
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
    // 仅在账户切换时刷新交易历史
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountStore.currentAccount]);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const txs = await transactionHistoryService.getTransactions({
        accountAddress: accountStore.currentAccountAddress || undefined,
        chainId: accountStore.currentAccount?.chainId,
        limit: 100,
      });
      setTransactions(txs);
    } catch (error) {
      console.error('加载交易记录失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <Container>
        <Title>交易历史</Title>
        <Card>
          <EmptyState>加载中...</EmptyState>
        </Card>
      </Container>
    );
  }

  if (transactions.length === 0) {
    return (
      <Container>
        <Title>交易历史</Title>
        <Card>
          <EmptyState>暂无交易记录</EmptyState>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Title>交易历史</Title>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>交易哈希</TableHeaderCell>
              <TableHeaderCell>状态</TableHeaderCell>
              <TableHeaderCell>发送方</TableHeaderCell>
              <TableHeaderCell>接收方</TableHeaderCell>
              <TableHeaderCell>金额</TableHeaderCell>
              <TableHeaderCell>时间</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <tbody>
            {transactions.map((tx) => (
              <TableRow key={tx.hash}>
                <TableCell>
                  <a
                    href={`https://explorer.mantle.xyz/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#4c6ef5', textDecoration: 'none' }}
                  >
                    {formatAddress(tx.hash)}
                  </a>
                </TableCell>
                <TableCell>
                  <StatusBadge status={tx.status}>
                    {tx.status === 'success' ? '成功' : tx.status === 'pending' ? '待确认' : '失败'}
                  </StatusBadge>
                </TableCell>
                <TableCell>{formatAddress(tx.from)}</TableCell>
                <TableCell>{formatAddress(tx.to)}</TableCell>
                <TableCell>{formatUnits(tx.value, 18)} ETH</TableCell>
                <TableCell>{formatDate(tx.timestamp)}</TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      </Card>
    </Container>
  );
});
