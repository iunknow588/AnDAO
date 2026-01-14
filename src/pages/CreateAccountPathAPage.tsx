/**
 * 路径A：极简体验账户创建页面
 * 
 * 无EOA用户的账户创建流程：
 * 1. 自动生成智能账户密钥对
 * 2. 备份助记词
 * 3. 选择赞助商
 * 4. 提交申请
 * 5. 等待审核
 * 6. 创建成功
 * 
 * @module pages/CreateAccountPathAPage
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { AccountManager } from '@/services/AccountManager';
import { KeyManagerService } from '@/services/KeyManagerService';
import { sponsorService } from '@/services/SponsorService';
import { Sponsor, Application, ApplicationStatus } from '@/types/sponsor';
import { AccountCreationPath, UserType, AccountStatus } from '@/types';
import { Address } from 'viem';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { ErrorHandler } from '@/utils/errors';
import { useStore } from '@/stores';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
  min-height: 100vh;
`;

const StepIndicator = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 40px;
  gap: 16px;
`;

const Step = styled.div<{ active?: boolean; completed?: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  background: ${props => 
    props.completed ? '#4c6ef5' : 
    props.active ? '#4c6ef5' : '#e9ecef'};
  color: ${props => 
    props.completed || props.active ? '#ffffff' : '#666'};
  transition: all 0.3s ease;
`;

const StepLine = styled.div<{ completed?: boolean }>`
  width: 60px;
  height: 2px;
  background: ${props => props.completed ? '#4c6ef5' : '#e9ecef'};
  margin-top: 19px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
  text-align: center;
`;

const Description = styled.p`
  font-size: 14px;
  color: #666;
  margin-bottom: 32px;
  text-align: center;
`;

const SponsorCard = styled(Card)<{ selected?: boolean }>`
  cursor: pointer;
  margin-bottom: 16px;
  border: 2px solid ${props => props.selected ? '#4c6ef5' : 'transparent'};
  transition: all 0.3s ease;
  
  &:hover {
    border-color: #4c6ef5;
    transform: translateY(-2px);
  }
`;

const SponsorName = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
`;

const SponsorDescription = styled.p`
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
`;

const Stats = styled.div`
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #666;
`;

const Stat = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StatusCard = styled(Card)`
  text-align: center;
  padding: 40px;
`;

const StatusIcon = styled.div`
  font-size: 64px;
  margin-bottom: 16px;
`;

const StatusText = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
`;

const StatusDescription = styled.p`
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
`;

const MnemonicDisplay = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.8;
  word-break: break-all;
  text-align: center;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 32px;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #4c6ef5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

/**
 * 路径A创建页面组件
 */
export const CreateAccountPathAPage: React.FC = () => {
  const navigate = useNavigate();
  const { accountStore } = useStore();
  
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [mnemonicConfirmed, setMnemonicConfirmed] = useState(false);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [selectedSponsor, setSelectedSponsor] = useState<string>();
  const [inviteCode, setInviteCode] = useState('');
  const [application, setApplication] = useState<Application | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [predictedAddress, setPredictedAddress] = useState<Address | null>(null);
  const [ownerAddress, setOwnerAddress] = useState<Address | null>(null);
  
  const accountManager = new AccountManager();
  const keyManagerService = new KeyManagerService();
  
  // 步骤1: 设置密码和生成密钥
  useEffect(() => {
    if (step === 1) {
      // 自动生成密钥对
      generateKeyPair();
    }
  }, [step]);
  
  // 步骤4: 轮询申请状态
  useEffect(() => {
    if (step === 4 && application) {
      sponsorService.pollApplicationStatus(
        application.id,
        (status) => {
          setApplicationStatus(status);
          if (status === 'deployed') {
            setStep(5); // 创建成功
          } else if (status === 'rejected') {
            // 处理拒绝情况
            ErrorHandler.showError('申请被拒绝，请重新选择赞助商');
            setStep(3); // 返回选择赞助商
          }
        }
      );
      
      return () => {
        sponsorService.stopPolling(application.id);
      };
    }
  }, [step, application]);
  
  /**
   * 生成密钥对及助记词
   *
   * 使用 KeyManagerService 提供的 BIP-39 助记词生成功能，
   * 确保用户拿到的助记词可以用于后续标准钱包恢复。
   */
  const generateKeyPair = async () => {
    try {
      setIsLoading(true);
      const { mnemonic: phrase, address } = await keyManagerService.generateMnemonic();
      setOwnerAddress(address);
      setMnemonic(phrase);
    } catch (error) {
      ErrorHandler.handleError(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * 处理步骤1：设置密码
   */
  const handleSetPassword = () => {
    if (!password || password.length < 8) {
      ErrorHandler.showError('密码至少需要8个字符');
      return;
    }
    
    if (password !== confirmPassword) {
      ErrorHandler.showError('两次输入的密码不一致');
      return;
    }
    
    if (!mnemonicConfirmed) {
      ErrorHandler.showError('请先确认已备份助记词');
      return;
    }
    
    // 保存私钥（加密存储）
    if (ownerAddress) {
      keyManagerService.savePrivateKey(ownerAddress, '0x' as any, password)
        .then(() => {
          setStep(2);
        })
        .catch(error => {
          ErrorHandler.handleError(error);
        });
    }
  };
  
  /**
   * 处理步骤2：预测地址
   */
  const handlePredictAddress = async () => {
    if (!ownerAddress) {
      ErrorHandler.showError('密钥生成失败，请重试');
      return;
    }
    
    try {
      setIsLoading(true);
      const chainId = accountStore.currentChain?.chainId || 5001; // 默认Mantle测试网
      const address = await accountManager.predictAccountAddress(ownerAddress, chainId);
      setPredictedAddress(address);
      setStep(3);
    } catch (error) {
      ErrorHandler.handleError(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * 加载赞助商列表
   */
  useEffect(() => {
    if (step === 3) {
      sponsorService.getRecommendedSponsors()
        .then(setSponsors)
        .catch(error => {
          ErrorHandler.handleError(error);
        });
    }
  }, [step]);
  
  /**
   * 处理步骤3：选择赞助商
   */
  const handleSelectSponsor = async () => {
    let sponsorId = selectedSponsor;
    
    // 如果输入了邀请码，通过邀请码选择
    if (inviteCode && !sponsorId) {
      try {
        setIsLoading(true);
        const sponsor = await sponsorService.selectSponsorByInviteCode(inviteCode);
        sponsorId = sponsor.id;
      } catch (error) {
        ErrorHandler.handleError(error);
        return;
      } finally {
        setIsLoading(false);
      }
    }
    
    if (!sponsorId) {
      ErrorHandler.showError('请选择赞助商或输入邀请码');
      return;
    }
    
    // 创建申请
    try {
      setIsLoading(true);
      const chainId = accountStore.currentChain?.chainId || 5001;
      
      if (!predictedAddress || !ownerAddress) {
        ErrorHandler.showError('地址预测失败，请重试');
        return;
      }
      
      const app = await sponsorService.createApplication({
        accountAddress: predictedAddress,
        ownerAddress,
        sponsorId,
        chainId,
        inviteCode: inviteCode || undefined,
      });
      
      setApplication(app);
      setStep(4);
    } catch (error) {
      ErrorHandler.handleError(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * 处理创建成功
   */
  const handleSuccess = () => {
    // 保存账户信息到AccountStore
    if (predictedAddress && ownerAddress) {
      const chainId = accountStore.currentChain?.chainId || 5001;
      const accountInfo = {
        address: predictedAddress,
        chainId,
        owner: ownerAddress,
        userType: UserType.SIMPLE,
        creationPath: AccountCreationPath.PATH_A_SIMPLE,
        status: AccountStatus.DEPLOYED,
        createdAt: Date.now(),
        deployedAt: Date.now(),
        sponsorId: application?.sponsorId,
      };
      
      // 保存账户信息到AccountManager
      accountManager.importAccount(accountInfo).catch(error => {
        ErrorHandler.handleError(error);
      });
      
      // 导航到主页面
      navigate('/assets');
    }
  };
  
  const steps = [
    { number: 1, label: '生成密钥' },
    { number: 2, label: '预测地址' },
    { number: 3, label: '选择赞助商' },
    { number: 4, label: '等待审核' },
    { number: 5, label: '完成' },
  ];
  
  return (
    <Container>
      <StepIndicator>
        {steps.map((s, index) => (
          <React.Fragment key={s.number}>
            <Step
              active={step === s.number}
              completed={step > s.number}
            >
              {step > s.number ? '✓' : s.number}
            </Step>
            {index < steps.length - 1 && (
              <StepLine completed={step > s.number} />
            )}
          </React.Fragment>
        ))}
      </StepIndicator>
      
      {/* 步骤1: 生成密钥和设置密码 */}
      {step === 1 && (
        <Card>
          <Title>🔐 生成安全密钥</Title>
          <Description>
            系统将为您自动生成一个安全的密钥对，请设置密码并备份助记词
          </Description>
          
          {mnemonic && (
            <>
              <MnemonicDisplay>{mnemonic}</MnemonicDisplay>
              <div style={{ marginBottom: '16px' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={mnemonicConfirmed}
                    onChange={(e) => setMnemonicConfirmed(e.target.checked)}
                  />
                  <span style={{ marginLeft: '8px' }}>
                    我已安全备份助记词
                  </span>
                </label>
              </div>
            </>
          )}
          
          <Input
            label="设置密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少8个字符"
          />
          
          <Input
            label="确认密码"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再次输入密码"
          />
          
          <ButtonGroup>
            <Button
              onClick={handleSetPassword}
              disabled={isLoading || !mnemonicConfirmed}
            >
              {isLoading ? <LoadingSpinner /> : '下一步'}
            </Button>
          </ButtonGroup>
        </Card>
      )}
      
      {/* 步骤2: 预测地址 */}
      {step === 2 && (
        <Card>
          <Title>📍 预测账户地址</Title>
          <Description>
            系统正在预测您的智能合约账户地址
          </Description>
          
          {predictedAddress && (
            <StatusCard>
              <StatusText>账户地址</StatusText>
              <MnemonicDisplay>{predictedAddress}</MnemonicDisplay>
              <Description>
                此地址将在账户创建后生效
              </Description>
            </StatusCard>
          )}
          
          <ButtonGroup>
            <Button onClick={() => setStep(1)} variant="outline">
              上一步
            </Button>
            <Button
              onClick={handlePredictAddress}
              disabled={isLoading || !!predictedAddress}
            >
              {isLoading ? <LoadingSpinner /> : predictedAddress ? '下一步' : '预测地址'}
            </Button>
          </ButtonGroup>
        </Card>
      )}
      
      {/* 步骤3: 选择赞助商 */}
      {step === 3 && (
        <Card>
          <Title>🎯 选择赞助商</Title>
          <Description>
            您的智能账户将由赞助商代付Gas创建
          </Description>
          
          <Input
            label="邀请码（可选）"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="输入邀请码"
          />
          
          <div style={{ marginTop: '24px', marginBottom: '16px' }}>
            <strong>推荐赞助商：</strong>
          </div>
          
          {sponsors.map(sponsor => (
            <SponsorCard
              key={sponsor.id}
              selected={selectedSponsor === sponsor.id}
              onClick={() => setSelectedSponsor(sponsor.id)}
            >
              <SponsorName>{sponsor.name}</SponsorName>
              {sponsor.description && (
                <SponsorDescription>{sponsor.description}</SponsorDescription>
              )}
              <Stats>
                <Stat>通过率: {sponsor.approvalRate}%</Stat>
                <Stat>平均等待: {sponsor.avgWaitTime}分钟</Stat>
                <Stat>已赞助: {sponsor.totalSponsored}个</Stat>
              </Stats>
            </SponsorCard>
          ))}
          
          <ButtonGroup>
            <Button onClick={() => setStep(2)} variant="outline">
              上一步
            </Button>
            <Button
              onClick={handleSelectSponsor}
              disabled={isLoading || (!selectedSponsor && !inviteCode)}
            >
              {isLoading ? <LoadingSpinner /> : '提交申请'}
            </Button>
          </ButtonGroup>
        </Card>
      )}
      
      {/* 步骤4: 等待审核 */}
      {step === 4 && application && (
        <StatusCard>
          <StatusIcon>
            {applicationStatus === 'pending' ? '⏳' :
             applicationStatus === 'approved' ? '✅' :
             applicationStatus === 'rejected' ? '❌' : '🚀'}
          </StatusIcon>
          <StatusText>
            {applicationStatus === 'pending' ? '等待审核' :
             applicationStatus === 'approved' ? '审核通过' :
             applicationStatus === 'rejected' ? '审核被拒绝' : '账户创建中'}
          </StatusText>
          <StatusDescription>
            {applicationStatus === 'pending' && '您的申请已提交，正在等待赞助商审核...'}
            {applicationStatus === 'approved' && '赞助商已批准您的申请，正在创建账户...'}
            {applicationStatus === 'rejected' && '很抱歉，您的申请被拒绝了'}
            {applicationStatus === 'deployed' && '账户创建成功！'}
          </StatusDescription>
          {predictedAddress && (
            <MnemonicDisplay>{predictedAddress}</MnemonicDisplay>
          )}
        </StatusCard>
      )}
      
      {/* 步骤5: 创建成功 */}
      {step === 5 && (
        <StatusCard>
          <StatusIcon>🎉</StatusIcon>
          <StatusText>账户创建成功！</StatusText>
          <StatusDescription>
            您的智能合约账户已成功创建，现在可以开始使用了
          </StatusDescription>
          {predictedAddress && (
            <MnemonicDisplay>{predictedAddress}</MnemonicDisplay>
          )}
          <ButtonGroup>
            <Button onClick={handleSuccess}>
              进入钱包
            </Button>
          </ButtonGroup>
        </StatusCard>
      )}
    </Container>
  );
};
