/**
 * 守护人管理页面
 * 
 * 管理社交恢复的守护人列表
 * 参考 Keplr 设置页面风格
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { useNavigate } from 'react-router-dom';
import { guardianService } from '@/services/GuardianService';
import { keyManagerService } from '@/services/KeyManagerService';
import { authService } from '@/services/AuthService';
import { Guardian } from '@/types';
import { ErrorHandler } from '@/utils/errors';
import type { Address } from 'viem';

const Container = styled.div`
  max-width: 600px;
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

const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
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
  margin-bottom: 12px;

  &:hover {
    background: #3b5bdb;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const DangerButton = styled(Button)`
  background: #e03131;

  &:hover {
    background: #c92a2a;
  }
`;

const GuardianList = styled.div`
  margin-top: 16px;
`;

const GuardianItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 8px;
`;

const GuardianAddress = styled.div`
  font-family: monospace;
  font-size: 14px;
  color: #666;
  word-break: break-all;
`;

const GuardianDate = styled.div`
  font-size: 12px;
  color: #999;
  margin-top: 4px;
`;

const RemoveButton = styled.button`
  background: #e03131;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #c92a2a;
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

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #999;
`;

export const GuardiansPage = observer(() => {
  const { accountStore } = useStore();
  const navigate = useNavigate();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [newGuardianAddress, setNewGuardianAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const currentAccount = accountStore.currentAccount;
  const currentChainId = currentAccount?.chainId || 0;

  useEffect(() => {
    if (currentAccount) {
      loadGuardians();
    }
  }, [currentAccount]);

  const loadGuardians = async () => {
    if (!currentAccount) return;

    setIsLoading(true);
    setError(null);

    try {
      const list = await guardianService.getGuardians(
        currentAccount.address as Address,
        currentChainId
      );
      setGuardians(list);
    } catch (err) {
      setError(ErrorHandler.handleError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddGuardian = async () => {
    if (!currentAccount) {
      setError('请先选择账户');
      return;
    }

    if (!newGuardianAddress || !newGuardianAddress.startsWith('0x')) {
      setError('请输入有效的地址');
      return;
    }

    if (!password) {
      setShowPasswordInput(true);
      setError('请输入密码以解锁私钥');
      return;
    }

    setIsAdding(true);
    setError(null);
    setSuccess(null);

    try {
      // 从安全存储获取签名者私钥
      const ownerAddress = currentAccount.owner as Address;
      const signerPrivateKey = await keyManagerService.getPrivateKey(ownerAddress, password);

      if (!signerPrivateKey) {
        setError('无法获取签名者私钥，请检查密码');
        setShowPasswordInput(true);
        return;
      }

      const txHash = await guardianService.addGuardian(
        currentAccount.address as Address,
        currentChainId,
        newGuardianAddress as Address,
        signerPrivateKey
      );

      setSuccess(`守护人添加成功，交易哈希: ${txHash}`);
      setNewGuardianAddress('');
      setPassword('');
      setShowPasswordInput(false);
      await loadGuardians();
    } catch (err) {
      setError(ErrorHandler.handleError(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveGuardian = async (guardianAddress: string) => {
    if (!currentAccount) {
      setError('请先选择账户');
      return;
    }

    if (!password) {
      setShowPasswordInput(true);
      setError('请输入密码以解锁私钥');
      return;
    }

    setIsRemoving(guardianAddress);
    setError(null);
    setSuccess(null);

    try {
      // 从安全存储获取签名者私钥
      const ownerAddress = currentAccount.owner as Address;
      const signerPrivateKey = await keyManagerService.getPrivateKey(ownerAddress, password);

      if (!signerPrivateKey) {
        setError('无法获取签名者私钥，请检查密码');
        setShowPasswordInput(true);
        return;
      }

      const txHash = await guardianService.removeGuardian(
        currentAccount.address as Address,
        currentChainId,
        guardianAddress as Address,
        signerPrivateKey
      );

      setSuccess(`守护人移除成功，交易哈希: ${txHash}`);
      await loadGuardians();
    } catch (err) {
      setError(ErrorHandler.handleError(err));
    } finally {
      setIsRemoving(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  if (!currentAccount) {
    return (
      <Container>
        <Title>守护人管理</Title>
        <Card>
          <EmptyState>请先创建或导入账户</EmptyState>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Title>守护人管理</Title>

      <Card>
        <SectionTitle>添加守护人</SectionTitle>
        {showPasswordInput && (
          <Input
            type="password"
            placeholder="请输入密码以解锁私钥"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isAdding || !!isRemoving}
          />
        )}
        <Input
          type="text"
          placeholder="守护人地址 (0x...)"
          value={newGuardianAddress}
          onChange={(e) => setNewGuardianAddress(e.target.value)}
          disabled={isAdding}
        />
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {success && <SuccessMessage>{success}</SuccessMessage>}
        <Button onClick={handleAddGuardian} disabled={isAdding || !newGuardianAddress}>
          {isAdding ? '添加中...' : '添加守护人'}
        </Button>
      </Card>

      <Card>
        <SectionTitle>守护人列表</SectionTitle>
        {isLoading ? (
          <EmptyState>加载中...</EmptyState>
        ) : guardians.length === 0 ? (
          <EmptyState>暂无守护人</EmptyState>
        ) : (
          <GuardianList>
            {guardians.map((guardian) => (
              <GuardianItem key={guardian.address}>
                <div>
                  <GuardianAddress>{guardian.address}</GuardianAddress>
                  <GuardianDate>添加时间: {formatDate(guardian.addedAt)}</GuardianDate>
                </div>
                <RemoveButton
                  onClick={() => handleRemoveGuardian(guardian.address)}
                  disabled={isRemoving === guardian.address}
                >
                  {isRemoving === guardian.address ? '移除中...' : '移除'}
                </RemoveButton>
              </GuardianItem>
            ))}
          </GuardianList>
        )}
      </Card>
    </Container>
  );
});

