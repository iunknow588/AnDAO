/**
 * 创建账户页面
 * 
 * 参考 Keplr 钱包的创建账户流程，但代码完全独立实现
 */

import { useState } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_CHAIN_CONFIG } from '@/config/chains';
import {
  normalizePrivateKeyInput,
  validateEvmAddress,
  validatePrivateKeyFormat,
} from '@/utils/pathFlowValidation';

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

export const CreateAccountPage = observer(() => {
  const { accountStore } = useStore();
  const navigate = useNavigate();
  const [ownerAddress, setOwnerAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [useExistingKey, setUseExistingKey] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const ownerAddressError = validateEvmAddress(ownerAddress, '所有者地址');
    if (ownerAddressError) {
      setError(ownerAddressError);
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      let signerPrivateKey: `0x${string}`;

      if (useExistingKey) {
        // 尝试从 KeyManagerService 获取私钥
        const { keyManagerService } = await import('@/services/KeyManagerService');
        const { authService } = await import('@/services/AuthService');
        
        if (!authService.isAuthenticated()) {
          throw new Error('请先登录后再使用已保存私钥');
        }

        const privateKeyFromSession = await keyManagerService.getPrivateKeyFromSession(
          ownerAddress as `0x${string}`
        );
        
        if (!privateKeyFromSession) {
          throw new Error('未找到私钥，请先导入私钥或手动输入');
        }

        signerPrivateKey = privateKeyFromSession;
      } else {
        // 使用用户输入的私钥
        const privateKeyError = validatePrivateKeyFormat(privateKey, '私钥');
        if (privateKeyError) {
          setError(privateKeyError);
          setIsCreating(false);
          return;
        }
        const normalizedPrivateKey = normalizePrivateKeyInput(privateKey);

        // 验证私钥对应的地址是否匹配
        const { keyManagerService } = await import('@/services/KeyManagerService');
        const addressFromKey = keyManagerService.getAddressFromPrivateKey(normalizedPrivateKey);
        
        if (addressFromKey.toLowerCase() !== ownerAddress.toLowerCase()) {
          setError('私钥与所有者地址不匹配');
          setIsCreating(false);
          return;
        }

        signerPrivateKey = normalizedPrivateKey;
      }

      await accountStore.createAccount(
        ownerAddress, 
        DEFAULT_CHAIN_CONFIG.chainId,
        signerPrivateKey
      );
      navigate('/');
    } catch (error) {
      console.error('创建账户失败:', error);
      setError(error instanceof Error ? error.message : '创建账户失败');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Container>
      <Card>
        <Title>创建智能合约账户</Title>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          输入所有者地址（EOA）来创建智能合约账户
        </p>

        <Input
          type="text"
          placeholder="0x..."
          value={ownerAddress}
          onChange={(e) => setOwnerAddress(e.target.value)}
          disabled={isCreating}
        />

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useExistingKey}
              onChange={(e) => setUseExistingKey(e.target.checked)}
              disabled={isCreating}
              style={{ marginRight: '8px' }}
            />
            <span style={{ fontSize: '14px', color: '#666' }}>
              使用已保存的私钥（需要先登录）
            </span>
          </label>
        </div>

        {!useExistingKey && (
          <Input
            type="password"
            placeholder="私钥 (0x...)"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            disabled={isCreating}
            style={{ marginBottom: '16px' }}
          />
        )}

        {(error || accountStore.error) && (
          <ErrorMessage>{error || accountStore.error}</ErrorMessage>
        )}

        <Button 
          onClick={handleCreate} 
          disabled={isCreating || !ownerAddress || (!useExistingKey && !privateKey)}
        >
          {isCreating ? '创建中...' : '创建账户'}
        </Button>
      </Card>
    </Container>
  );
});
