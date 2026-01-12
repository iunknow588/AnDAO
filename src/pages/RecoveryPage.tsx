/**
 * 恢复流程页面
 * 
 * 社交恢复流程，包括发起恢复请求和守护人投票
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { guardianService } from '@/services/GuardianService';
import { keyManagerService } from '@/services/KeyManagerService';
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

const InfoBox = styled.div`
  background: #e7f5ff;
  border: 1px solid #4c6ef5;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #1a1a1a;
`;

const WarningBox = styled(InfoBox)`
  background: #fff3cd;
  border-color: #ffc107;
`;

export const RecoveryPage = observer(() => {
  const { accountStore } = useStore();
  const [accountAddress, setAccountAddress] = useState('');
  const [newOwnerAddress, setNewOwnerAddress] = useState('');
  const [isInitiating, setIsInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [generatedKeyAddress, setGeneratedKeyAddress] = useState<string | null>(null);

  const currentAccount = accountStore.currentAccount;
  const currentChainId = currentAccount?.chainId || 0;

  const handleInitiateRecovery = async () => {
    if (!accountAddress || !newOwnerAddress) {
      setError('请填写所有字段');
      return;
    }

    if (!accountAddress.startsWith('0x') || !newOwnerAddress.startsWith('0x')) {
      setError('请输入有效的地址');
      return;
    }

    if (!password) {
      setError('请输入密码以解锁私钥');
      return;
    }

    setIsInitiating(true);
    setError(null);
    setSuccess(null);

    try {
      // 从安全存储获取签名者私钥
      // 注意：恢复流程中，可能需要使用守护人的私钥，这里简化处理
      const signerAddress = accountAddress as Address;
      const signerPrivateKey = await keyManagerService.getPrivateKey(signerAddress, password);

      if (!signerPrivateKey) {
        setError('无法获取签名者私钥，请检查密码');
        return;
      }

      const txHash = await guardianService.initiateRecovery(
        accountAddress as Address,
        currentChainId,
        newOwnerAddress as Address,
        signerPrivateKey
      );

      setSuccess(`恢复请求已发起，交易哈希: ${txHash}`);
      setAccountAddress('');
      setNewOwnerAddress('');
    } catch (err) {
      setError(ErrorHandler.handleError(err));
    } finally {
      setIsInitiating(false);
    }
  };

  /**
   * 生成新的所有者密钥并安全保存，便于恢复后立即使用
   */
  const handleGenerateNewKey = async () => {
    setError(null);
    setSuccess(null);

    if (!newOwnerPassword) {
      setError('请设置新密钥的加密密码');
      return;
    }

    setIsGeneratingKey(true);
    try {
      const { address, privateKey } = await keyManagerService.generatePrivateKey();
      await keyManagerService.savePrivateKey(address as Address, privateKey, newOwnerPassword);
      setNewOwnerAddress(address);
      setGeneratedKeyAddress(address);
      setSuccess(`已生成新的所有者密钥，地址：${address}`);
    } catch (err) {
      setError(ErrorHandler.handleError(err));
    } finally {
      setIsGeneratingKey(false);
    }
  };

  return (
    <Container>
      <Title>账户恢复</Title>

      <WarningBox>
        <strong>重要提示：</strong>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>账户恢复需要守护人投票确认</li>
          <li>请确保新所有者地址正确，恢复后原所有者将失去控制权</li>
          <li>恢复过程可能需要一些时间，请耐心等待</li>
        </ul>
      </WarningBox>

      <Card>
        <SectionTitle>发起恢复请求</SectionTitle>
        <InfoBox>
          如果您丢失了账户的私钥，可以通过守护人投票来恢复账户控制权。
          恢复后，账户的所有权将转移给新的所有者地址。
        </InfoBox>

        <Input
          type="text"
          placeholder="要恢复的账户地址 (0x...)"
          value={accountAddress}
          onChange={(e) => setAccountAddress(e.target.value)}
          disabled={isInitiating}
        />

        <Input
          type="text"
          placeholder="新所有者地址 (0x...)"
          value={newOwnerAddress}
          onChange={(e) => setNewOwnerAddress(e.target.value)}
          disabled={isInitiating}
        />

        <Input
          type="password"
          placeholder="请输入密码以解锁私钥"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isInitiating}
        />

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {success && <SuccessMessage>{success}</SuccessMessage>}

        <Button
          onClick={handleInitiateRecovery}
          disabled={isInitiating || !accountAddress || !newOwnerAddress || !password}
        >
          {isInitiating ? '发起中...' : '发起恢复请求'}
        </Button>
      </Card>

      <Card>
        <SectionTitle>生成新的所有者密钥</SectionTitle>
        <InfoBox>
          建议在恢复前生成新的所有者密钥并加密保存，确保恢复完成后立即拥有可用的控制密钥。
        </InfoBox>

        <Input
          type="password"
          placeholder="设置新密钥的保存密码"
          value={newOwnerPassword}
          onChange={(e) => setNewOwnerPassword(e.target.value)}
          disabled={isGeneratingKey}
        />

        {generatedKeyAddress && (
          <SuccessMessage>新密钥已保存，地址：{generatedKeyAddress}</SuccessMessage>
        )}

        <Button onClick={handleGenerateNewKey} disabled={isGeneratingKey}>
          {isGeneratingKey ? '生成中...' : '生成并保存新密钥'}
        </Button>
      </Card>

      <Card>
        <SectionTitle>守护人投票</SectionTitle>
        <InfoBox>
          如果您是账户的守护人，可以在此投票支持或反对恢复请求。
          需要足够的守护人投票才能完成恢复。
        </InfoBox>
        <InfoBox style={{ background: '#f8f9fa', borderColor: '#dee2e6' }}>
          守护人投票功能正在开发中，敬请期待。
        </InfoBox>
      </Card>
    </Container>
  );
});

