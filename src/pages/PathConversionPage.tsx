/**
 * 路径转换页面
 * 
 * 允许用户在不同账户路径之间转换
 * 
 * 支持的转换：
 * - 路径A → 路径B：添加EOA账户，升级为标准模式
 * - 路径A → 路径C：注册成为赞助商
 * - 路径B → 路径C：注册成为赞助商
 * 
 * @module pages/PathConversionPage
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { useNavigate } from 'react-router-dom';
import { accountManager } from '@/services/AccountManager';
import { sponsorService } from '@/services/SponsorService';
import { keyManagerService } from '@/services/KeyManagerService';
import { ErrorHandler } from '@/utils/errors';
import {
  normalizePrivateKeyInput,
  validatePassword,
  validatePrivateKeyFormat,
} from '@/utils/pathFlowValidation';
import { UserType } from '@/types';
import type { Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { StorageProviderType } from '@/interfaces/IStorageProvider';

type ConversionPath = 'a-to-b' | 'a-to-c' | 'b-to-c';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
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
  margin-bottom: 8px;
  color: #1a1a1a;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
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
  width: 100%;

  &:hover {
    background: #3b5bdb;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;

  &:focus {
    outline: none;
    border-color: #4c6ef5;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #333;
`;

const InfoBox = styled.div`
  background: #f8f9fa;
  border-left: 4px solid #4c6ef5;
  padding: 16px;
  margin-bottom: 24px;
  border-radius: 4px;
`;

const InfoText = styled.p`
  font-size: 14px;
  color: #666;
  margin: 0;
  line-height: 1.6;
`;

const ErrorText = styled.p`
  color: #e03131;
  font-size: 14px;
  margin-top: 8px;
`;

const SuccessText = styled.p`
  color: #2f9e44;
  font-size: 14px;
  margin-top: 8px;
`;

/**
 * 路径转换页面组件
 */
export const PathConversionPage: React.FC = observer(() => {
  const { accountStore } = useStore();
  const navigate = useNavigate();
  
  const [currentUserType, setCurrentUserType] = useState<UserType | undefined>();
  const [conversionPath, setConversionPath] = useState<ConversionPath | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 路径A → B 状态
  const [eoaPrivateKey, setEoaPrivateKey] = useState('');
  const [eoaPassword, setEoaPassword] = useState('');
  
  // 路径A/B → C 状态
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorDescription, setSponsorDescription] = useState('');
  const [gasAccountPrivateKey, setGasAccountPrivateKey] = useState('');
  const [gasAccountPassword, setGasAccountPassword] = useState('');

  /**
   * 初始化：获取当前账户的用户类型
   */
  useEffect(() => {
    const loadAccountInfo = async () => {
      if (!accountStore.currentAccount) {
        navigate('/');
        return;
      }

      try {
        const account = await accountManager.getAccountByAddress(
          accountStore.currentAccount.address as Address,
          accountStore.currentAccount.chainId
        );
        
        if (account) {
          const userType = account.userType;
          const creationPath = account.creationPath;
          
          setCurrentUserType(userType);
          
          // 根据当前用户类型，确定可用的转换路径
          if (userType === 'simple' || creationPath === 'path_a_simple') {
            // 路径A可以转换为路径B或路径C
            // 这里不自动设置，让用户选择
          } else if (userType === 'standard' || creationPath === 'path_b_standard') {
            // 路径B可以转换为路径C
            // 这里不自动设置，让用户选择
          }
        }
      } catch (error) {
        ErrorHandler.handleAndShow(error);
        setError('无法获取账户信息');
      }
    };

    loadAccountInfo();
  }, [accountStore.currentAccount, navigate]);

  /**
   * 处理路径A → 路径B转换
   */
  const handlePathAToB = async () => {
    if (!accountStore.currentAccount) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const privateKeyError = validatePrivateKeyFormat(eoaPrivateKey, 'EOA私钥');
      if (privateKeyError) {
        throw new Error(privateKeyError);
      }

      const passwordError = validatePassword(eoaPassword);
      if (passwordError) {
        throw new Error(passwordError);
      }
      const normalizedEoaPrivateKey = normalizePrivateKeyInput(eoaPrivateKey);

      // 加密保存EOA私钥
      const eoaAccount = privateKeyToAccount(normalizedEoaPrivateKey);
      await keyManagerService.savePrivateKey(
        eoaAccount.address as Address,
        normalizedEoaPrivateKey,
        eoaPassword
      );

      // 执行路径转换
      const convertedAccount = await accountManager.convertPathAToB(
        accountStore.currentAccount.address as Address,
        accountStore.currentAccount.chainId,
        normalizedEoaPrivateKey
      );

      // 更新Store
      accountStore.setCurrentAccount(convertedAccount);
      
      setSuccess('路径转换成功！已升级为标准模式。');
      setTimeout(() => {
        navigate('/assets');
      }, 2000);
    } catch (error) {
      const errorMessage = ErrorHandler.handleAndShow(error);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 处理路径A/B → 路径C转换
   */
  const handlePathToC = async () => {
    if (!accountStore.currentAccount) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 验证输入
      if (!sponsorName.trim()) {
        throw new Error('请输入赞助商名称');
      }

      const gasPrivateKeyError = validatePrivateKeyFormat(gasAccountPrivateKey, 'Gas账户私钥');
      if (gasPrivateKeyError) {
        throw new Error(gasPrivateKeyError);
      }

      const gasPasswordError = validatePassword(gasAccountPassword);
      if (gasPasswordError) {
        throw new Error(gasPasswordError);
      }
      const normalizedGasAccountPrivateKey = normalizePrivateKeyInput(gasAccountPrivateKey);

      // 加密保存Gas账户私钥
      const gasAccount = privateKeyToAccount(normalizedGasAccountPrivateKey);
      await keyManagerService.savePrivateKey(
        gasAccount.address as Address,
        normalizedGasAccountPrivateKey,
        gasAccountPassword
      );

      // 执行赞助商注册
      const sponsorId = await sponsorService.registerOnChain({
        sponsorAddress: (accountStore.currentAccount.owner ||
          accountStore.currentAccount.address) as Address,
        gasAccountAddress: gasAccount.address as Address,
        sponsorInfo: {
          name: sponsorName,
          description: sponsorDescription || undefined,
        },
        rules: {
          dailyLimit: 100,
          maxGasPerAccount: BigInt('1000000000000000'), // 0.001 MNT
          autoApprove: false,
        },
        storageConfig: {
          type: StorageProviderType.IPFS,
          name: 'Default IPFS',
        },
      });

      // 执行路径转换
      if (currentUserType === 'simple') {
        await accountManager.convertPathAToC(
          accountStore.currentAccount.address as Address,
          accountStore.currentAccount.chainId,
          sponsorId,
          normalizedGasAccountPrivateKey
        );
      } else if (currentUserType === 'standard') {
        await accountManager.convertPathBToC(
          accountStore.currentAccount.address as Address,
          accountStore.currentAccount.chainId,
          sponsorId,
          normalizedGasAccountPrivateKey
        );
      }

      setSuccess('路径转换成功！您已成为赞助商。');
      setTimeout(() => {
        navigate('/sponsor/dashboard');
      }, 2000);
    } catch (error) {
      const errorMessage = ErrorHandler.handleAndShow(error);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 根据当前用户类型确定可用的转换选项
   */
  const getAvailableConversions = () => {
    if (!currentUserType) return [];

    const options: Array<{ value: ConversionPath; label: string; description: string }> = [];
    
    if (currentUserType === 'simple') {
      options.push(
        {
          value: 'a-to-b',
          label: '路径A → 路径B（添加EOA账户）',
          description: '添加EOA账户，升级为标准模式，可以使用自己的EOA支付Gas',
        },
        {
          value: 'a-to-c',
          label: '路径A → 路径C（成为赞助商）',
          description: '注册成为赞助商，可以帮助他人创建账户并代付Gas',
        }
      );
    } else if (currentUserType === 'standard') {
      options.push({
        value: 'b-to-c',
        label: '路径B → 路径C（成为赞助商）',
        description: '注册成为赞助商，可以帮助他人创建账户并代付Gas',
      });
    }

    return options;
  };

  const availableConversions = getAvailableConversions();

  if (!accountStore.currentAccount) {
    return (
      <Container>
        <Card>
          <Title>路径转换</Title>
          <InfoText>请先创建或导入账户</InfoText>
        </Card>
      </Container>
    );
  }

  if (availableConversions.length === 0) {
    return (
      <Container>
        <Card>
          <Title>路径转换</Title>
          <InfoText>当前账户类型不支持路径转换</InfoText>
          {currentUserType === 'sponsor' && (
            <InfoText style={{ marginTop: '8px' }}>
              您已经是赞助商，无需转换。
            </InfoText>
          )}
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Title>路径转换</Title>
      <Subtitle>将当前账户转换为其他路径类型</Subtitle>

      <Card>
        <h2>当前账户信息</h2>
        <InfoText>
          <strong>地址：</strong>{accountStore.currentAccount.address}
        </InfoText>
        <InfoText>
          <strong>用户类型：</strong>{currentUserType || '未知'}
        </InfoText>
      </Card>

      <Card>
        <h2>选择转换路径</h2>
        {availableConversions.map((option) => (
          <Card
            key={option.value}
            style={{ marginBottom: '16px', cursor: 'pointer' }}
            onClick={() => setConversionPath(option.value)}
          >
            <h3>{option.label}</h3>
            <InfoText>{option.description}</InfoText>
          </Card>
        ))}
      </Card>

      {/* 路径A → 路径B表单 */}
      {conversionPath === 'a-to-b' && (
        <Card>
          <h2>路径A → 路径B：添加EOA账户</h2>
          <InfoBox>
            <InfoText>
              <strong>转换说明：</strong>
              <br />
              • 需要提供一个EOA（外部拥有账户）私钥
              <br />
              • 转换后，您可以使用该EOA账户支付Gas费用
              <br />
              • 智能合约账户地址保持不变
              <br />
              • 转换后，您的账户类型将变为"标准模式"
            </InfoText>
          </InfoBox>

          <Label>EOA私钥（0x开头的66字符）</Label>
          <Input
            type="password"
            value={eoaPrivateKey}
            onChange={(e) => setEoaPrivateKey(e.target.value)}
            placeholder="0x..."
          />

          <Label>密码（用于加密保存EOA私钥）</Label>
          <Input
            type="password"
            value={eoaPassword}
            onChange={(e) => setEoaPassword(e.target.value)}
            placeholder="至少8个字符"
          />

          {error && <ErrorText>{error}</ErrorText>}
          {success && <SuccessText>{success}</SuccessText>}

          <Button
            onClick={handlePathAToB}
            disabled={isLoading || !eoaPrivateKey || !eoaPassword}
          >
            {isLoading ? '转换中...' : '确认转换'}
          </Button>
        </Card>
      )}

      {/* 路径A/B → 路径C表单 */}
      {(conversionPath === 'a-to-c' || conversionPath === 'b-to-c') && (
        <Card>
          <h2>
            {conversionPath === 'a-to-c' ? '路径A → 路径C' : '路径B → 路径C'}：成为赞助商
          </h2>
          <InfoBox>
            <InfoText>
              <strong>转换说明：</strong>
              <br />
              • 需要设置赞助商资料和Gas支付账户
              <br />
              • 转换后，您可以帮助他人创建账户并代付Gas
              <br />
              • 智能合约账户地址保持不变
              <br />
              • 转换后，您的账户类型将变为"赞助商"
            </InfoText>
          </InfoBox>

          <Label>赞助商名称 *</Label>
          <Input
            type="text"
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
            placeholder="输入赞助商名称"
          />

          <Label>赞助商描述（可选）</Label>
          <Input
            type="text"
            value={sponsorDescription}
            onChange={(e) => setSponsorDescription(e.target.value)}
            placeholder="简短介绍您的赞助商"
          />

          <Label>Gas支付账户私钥（0x开头的66字符） *</Label>
          <Input
            type="password"
            value={gasAccountPrivateKey}
            onChange={(e) => setGasAccountPrivateKey(e.target.value)}
            placeholder="0x..."
          />

          <Label>密码（用于加密保存Gas账户私钥） *</Label>
          <Input
            type="password"
            value={gasAccountPassword}
            onChange={(e) => setGasAccountPassword(e.target.value)}
            placeholder="至少8个字符"
          />

          {error && <ErrorText>{error}</ErrorText>}
          {success && <SuccessText>{success}</SuccessText>}

          <Button
            onClick={handlePathToC}
            disabled={isLoading || !sponsorName || !gasAccountPrivateKey || !gasAccountPassword}
          >
            {isLoading ? '转换中...' : '确认转换'}
          </Button>
        </Card>
      )}
    </Container>
  );
});
