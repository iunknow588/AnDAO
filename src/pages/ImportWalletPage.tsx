/**
 * 导入钱包页面
 * 
 * 允许用户导入已有的智能合约账户
 */

import { useState } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { useNavigate } from 'react-router-dom';
import { accountManager } from '@/services/AccountManager';
import type { AccountInfo } from '@/types';
import { DEFAULT_CHAIN_CONFIG } from '@/config/chains';
import { validateEvmAddress } from '@/utils/pathFlowValidation';
import { trimInputFields, validateRequiredFields } from '@/utils/formValidation';

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
    const normalizedFields = trimInputFields({
      accountAddress,
      ownerAddress,
      chainId,
    });
    const accountAddressValue = normalizedFields.accountAddress;
    const ownerAddressValue = normalizedFields.ownerAddress;
    const chainIdValue = normalizedFields.chainId;

    const requiredError = validateRequiredFields(
      [
        { value: accountAddressValue, label: '账户地址' },
        { value: ownerAddressValue, label: '所有者地址' },
        { value: chainIdValue, label: '链ID' },
      ],
      '请填写所有字段'
    );
    if (requiredError) {
      setError(requiredError);
      return;
    }

    const accountAddressError = validateEvmAddress(accountAddressValue, '账户地址');
    if (accountAddressError) {
      setError(accountAddressError);
      return;
    }

    const ownerAddressError = validateEvmAddress(ownerAddressValue, '所有者地址');
    if (ownerAddressError) {
      setError(ownerAddressError);
      return;
    }

    const chainIdNum = parseInt(chainIdValue, 10);
    if (isNaN(chainIdNum)) {
      setError('链ID格式无效');
      return;
    }

    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      // 检查账户是否存在
      const exists = await accountManager.accountExists(
        accountAddressValue as `0x${string}`,
        chainIdNum
      );
      if (!exists) {
        setError('链上不存在该账户');
        setIsImporting(false);
        return;
      }

      // 创建账户信息（不实际创建，只是导入）
      const accountInfo: AccountInfo = {
        address: accountAddressValue,
        chainId: chainIdNum,
        owner: ownerAddressValue,
        createdAt: Date.now(),
        status: 'deployed',
        deployedAt: Date.now(),
      };

      await accountStore.addAccount(accountInfo);
      
      setSuccess('账户导入成功');
      
      // 延迟跳转
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (err) {
      if (err instanceof Error && err.message === 'Account already exists') {
        setError('该账户已存在，无需重复导入');
      } else {
        setError(err instanceof Error ? err.message : '导入账户失败');
      }
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
          placeholder="链ID"
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
