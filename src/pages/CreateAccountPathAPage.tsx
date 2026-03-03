/**
 * 路径A：极简体验账户创建页面
 * 
 * 无EOA用户的账户创建流程：
 * 1. 自动生成智能账户密钥对
 * 2. 备份助记词
 * 3. 选择赞助商
 * 4. 提交注册申请
 * 5. 等待审批
 * 6. 创建成功
 * 
 * @module pages/CreateAccountPathAPage
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { accountManager } from '@/services/AccountManager';
import { keyManagerService } from '@/services/KeyManagerService';
import { sponsorService } from '@/services/SponsorService';
import { guardianService } from '@/services/GuardianService';
import { Sponsor, Application, ApplicationStatus } from '@/types/sponsor';
import { UserType, ExtendedAccountInfo, AccountInfo } from '@/types';
import { Address } from 'viem';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { PasswordInputField } from '@/components/PasswordInput/PasswordInputField';
import { MnemonicDisplay } from '@/components/MnemonicDisplay/MnemonicDisplay';
import { MnemonicVerification } from '@/components/MnemonicVerification/MnemonicVerification';
import { ErrorHandler } from '@/utils/errors';
import { validatePasswordPair } from '@/utils/pathFlowValidation';
import { trimInputValue } from '@/utils/formValidation';
import { requireChainConfig } from '@/utils/chainConfigValidation';
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

const Step = styled.div<{ $active?: boolean; $completed?: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  background: ${props => 
    props.$completed ? '#4c6ef5' : 
    props.$active ? '#4c6ef5' : '#e9ecef'};
  color: ${props => 
    props.$completed || props.$active ? '#ffffff' : '#666'};
  transition: all 0.3s ease;
`;

const StepLine = styled.div<{ $completed?: boolean }>`
  width: 60px;
  height: 2px;
  background: ${props => props.$completed ? '#4c6ef5' : '#e9ecef'};
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

const SponsorCard = styled(Card)<{ $selected?: boolean }>`
  cursor: pointer;
  margin-bottom: 16px;
  border: 2px solid ${props => props.$selected ? '#4c6ef5' : 'transparent'};
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

const AddressDisplay = styled.div`
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
  const [mnemonicWords, setMnemonicWords] = useState<string[]>([]);
  const [, setMnemonicConfirmed] = useState(false);
  const [mnemonicVerified, setMnemonicVerified] = useState(false);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [selectedSponsor, setSelectedSponsor] = useState<string>();
  const [inviteCode, setInviteCode] = useState('');
  const [applicationRemark, setApplicationRemark] = useState('');
  const [application, setApplication] = useState<Application | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [predictedAddress, setPredictedAddress] = useState<Address | null>(null);
  const [ownerAddress, setOwnerAddress] = useState<Address | null>(null);
  
  // 步骤1: 设置密码和生成密钥
  useEffect(() => {
    if (step === 1) {
      // 自动生成密钥对
      generateKeyPair();
    }
  }, [step]);
  
  // 步骤2: 自动预测地址（进入步骤2时自动触发）
  useEffect(() => {
    if (step === 2 && ownerAddress && !predictedAddress && !isLoading) {
      // 自动触发预测地址，无需用户点击按钮
      handlePredictAddress().catch(error => {
        // 错误已在 handlePredictAddress 中处理，这里仅防止未捕获的 Promise rejection
        console.error('[CreateAccountPathAPage] 自动预测失败:', error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ownerAddress]);
  
  // 步骤4: 轮询注册申请状态
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
            ErrorHandler.showError('注册申请被拒绝，请重新选择赞助商');
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
      // 将助记词拆分为单词数组，用于验证
      setMnemonicWords(phrase.trim().split(/\s+/));
    } catch (error) {
      ErrorHandler.handleAndShow(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * 处理步骤1：设置密码
   */
  const handleSetPassword = () => {
    const passwordValue = trimInputValue(password);
    const confirmPasswordValue = trimInputValue(confirmPassword);

    if (!passwordValue) {
      ErrorHandler.showError('请输入密码');
      return;
    }
    
    const passwordError = validatePasswordPair(passwordValue, confirmPasswordValue);
    if (passwordError) {
      ErrorHandler.showError(passwordError);
      return;
    }
    
    if (!mnemonicVerified) {
      ErrorHandler.showError('请先完成助记词验证');
      return;
    }
    
    // 保存私钥（加密存储）
    if (ownerAddress) {
      // 从助记词恢复私钥（用于保存）
      keyManagerService.recoverFromMnemonic(mnemonic)
        .then(({ privateKey }) => {
          return keyManagerService.savePrivateKey(ownerAddress, privateKey, passwordValue);
        })
        .then(() => {
          setStep(2);
        })
        .catch(error => {
          ErrorHandler.handleAndShow(error);
        });
    }
  };
  
  /**
   * 处理步骤2：预测地址
   * 
   * 优化：
   * - 添加详细的错误提示
   * - 提供重试建议
   * - 显示加载状态
   */
  const handlePredictAddress = async () => {
    if (!ownerAddress) {
      ErrorHandler.showError('密钥生成失败，请重试');
      return;
    }
    let rpcUrlHint = '未知';
    
    try {
      setIsLoading(true);
      // 使用用户选择的网络（通过右上角网络选择器）
      const chainId = accountStore.currentChainId;
      const chainConfig = requireChainConfig(chainId, [
        'kernelFactoryAddress',
        'rpcUrl',
        'multiChainValidatorAddress',
      ]);
      rpcUrlHint = chainConfig.rpcUrl;
      
      // 调用预测地址（已包含超时和重试机制）
      const address = await accountManager.predictAccountAddress(ownerAddress, chainId);
      setPredictedAddress(address);
      
      // 预测成功后自动进入下一步（仅在自动触发时）
      // 如果用户手动点击"重新预测"，不自动跳转
      if (step === 2) {
        // 延迟一小段时间让用户看到结果
        setTimeout(() => {
          setStep(3);
        }, 500);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ErrorHandler.showError(
        `预测账户地址失败：${errorMessage}\n\n` +
        `建议：\n` +
        `1. 检查网络连接是否正常\n` +
        `2. 确认 RPC 节点是否可用（${rpcUrlHint}）\n` +
        `3. 如果问题持续，请尝试刷新页面或联系支持`
      );
      // 预测失败时不自动跳转，让用户可以选择重试
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
          ErrorHandler.handleAndShow(error);
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
        ErrorHandler.handleAndShow(error);
        return;
      } finally {
        setIsLoading(false);
      }
    }
    
    if (!sponsorId) {
      ErrorHandler.showError('请选择赞助商或输入邀请码');
      return;
    }
    
    // 创建简易用户注册申请
    try {
      setIsLoading(true);
      const chainId = accountStore.currentChainId;
      
      if (!predictedAddress || !ownerAddress) {
        ErrorHandler.showError('地址预测失败，请重试');
        return;
      }
      
      const app = await sponsorService.createApplication({
        accountAddress: predictedAddress,
        ownerAddress,
        sponsorId,
        chainId,
        password: trimInputValue(password),
        inviteCode: inviteCode || undefined,
        details: applicationRemark
          ? {
              remark: applicationRemark,
            }
          : undefined,
      });
      
      setApplication(app);
      setStep(4);
    } catch (error) {
      ErrorHandler.handleAndShow(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * 处理创建成功
   */
  const handleSuccess = async () => {
    // 保存账户信息到AccountStore
    if (predictedAddress && ownerAddress) {
      try {
        const chainId = accountStore.currentChainId;
        const accountInfo: ExtendedAccountInfo = {
          address: predictedAddress,
          chainId,
          owner: ownerAddress,
          userType: UserType.SIMPLE,
          status: 'deployed',
          createdAt: Date.now(),
          deployedAt: Date.now(),
          sponsorId: application?.sponsorId,
        };
        
        // 1) 先保存账户信息，确保后续流程可基于该账户继续
        await accountManager.importAccount(accountInfo as AccountInfo);

        // 2) 路径A初始化守护人：默认将赞助商地址作为首个守护人
        try {
          const sponsorGuardianAddress = application?.sponsorAddress;
          if (sponsorGuardianAddress) {
            const ownerPrivateKey = await keyManagerService.getPrivateKey(ownerAddress, trimInputValue(password));
            if (ownerPrivateKey) {
              await guardianService.addGuardian(
                predictedAddress,
                chainId,
                sponsorGuardianAddress,
                ownerPrivateKey
              );
            } else {
              ErrorHandler.showError('账户已创建成功，但无法解锁私钥初始化守护人，请稍后在守护人页面手动添加。');
            }
          } else {
            ErrorHandler.showError('账户已创建成功，但未解析到赞助商守护人地址，请稍后在守护人页面手动添加。');
          }
        } catch (guardianError) {
          ErrorHandler.showError(
            `账户已创建成功，但守护人初始化失败：${guardianError instanceof Error ? guardianError.message : String(guardianError)}`
          );
        }

        // 导航到主页面
        navigate('/assets');
      } catch (error) {
        ErrorHandler.handleAndShow(error);
      }
    }
  };
  
  const steps = [
    { number: 1, label: '生成密钥' },
    { number: 2, label: '预测地址' },
    { number: 3, label: '选择赞助商' },
    { number: 4, label: '等待审批' },
    { number: 5, label: '完成' },
  ];
  
  return (
    <Container>
      <StepIndicator>
        {steps.map((s, index) => (
          <React.Fragment key={s.number}>
            <Step
              $active={step === s.number}
              $completed={step > s.number}
            >
              {step > s.number ? '✓' : s.number}
            </Step>
            {index < steps.length - 1 && (
              <StepLine $completed={step > s.number} />
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
              <MnemonicDisplay 
                mnemonic={mnemonic}
                showWarning={true}
                autoHideSeconds={0}
              />
              
              {mnemonicWords.length > 0 && !mnemonicVerified && (
                <MnemonicVerification
                  mnemonicWords={mnemonicWords}
                  onVerified={() => {
                    setMnemonicVerified(true);
                    setMnemonicConfirmed(true);
                  }}
                  verificationCount={3}
                />
              )}
              
              {mnemonicVerified && (
                <div style={{ 
                  marginBottom: '16px', 
                  padding: '12px',
                  background: '#e7f5ff',
                  borderRadius: '8px',
                  color: '#2f9e44',
                  fontSize: '14px'
                }}>
                  ✅ 助记词验证通过
                </div>
              )}
            </>
          )}
          
          <PasswordInputField
            label="设置密码"
            value={password}
            onChange={(value) => setPassword(value)}
            placeholder="至少8个字符"
            showRequirements={true}
            showStrength={true}
          />
          
          <Input
            label="确认密码"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再次输入密码"
            error={
              confirmPassword && password !== confirmPassword
                ? '两次输入的密码不一致'
                : undefined
            }
          />
          
          <ButtonGroup>
            <Button
              onClick={handleSetPassword}
              disabled={isLoading || !mnemonicVerified || !password || password.length < 8 || password !== confirmPassword}
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
            {isLoading 
              ? '系统正在预测您的智能合约账户地址，请稍候...'
              : predictedAddress 
                ? '账户地址预测完成'
                : '准备预测账户地址...'}
          </Description>
          
          {isLoading && !predictedAddress && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <LoadingSpinner style={{ margin: '0 auto', display: 'block' }} />
              <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
                正在连接区块链网络，预测账户地址...
              </p>
            </div>
          )}
          
          {predictedAddress && (
            <StatusCard>
              <StatusText>账户地址</StatusText>
              <AddressDisplay>{predictedAddress}</AddressDisplay>
              <Description>
                此地址将在账户创建后生效
              </Description>
            </StatusCard>
          )}
          
          <ButtonGroup>
            <Button onClick={() => setStep(1)} variant="secondary">
              上一步
            </Button>
            <Button
              onClick={handlePredictAddress}
              disabled={isLoading || !!predictedAddress}
            >
              {isLoading ? <LoadingSpinner /> : predictedAddress ? '下一步' : '重新预测'}
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

          <Input
            label="备注（可选，供赞助商审批）"
            value={applicationRemark}
            onChange={(e) => setApplicationRemark(e.target.value)}
            placeholder="可填写邀请码来源、注册说明等"
          />
          
          <div style={{ marginTop: '24px', marginBottom: '16px' }}>
            <strong>推荐赞助商：</strong>
          </div>
          
          {sponsors.map(sponsor => (
            <SponsorCard
              key={sponsor.id}
              $selected={selectedSponsor === sponsor.id}
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
            <Button onClick={() => setStep(2)} variant="secondary">
              上一步
            </Button>
            <Button
              onClick={handleSelectSponsor}
              disabled={isLoading || (!selectedSponsor && !inviteCode)}
            >
              {isLoading ? <LoadingSpinner /> : '提交注册'}
            </Button>
          </ButtonGroup>
        </Card>
      )}
      
      {/* 步骤4: 等待审批 */}
      {step === 4 && application && (
        <StatusCard>
          <StatusIcon>
            {applicationStatus === 'pending' ? '⏳' :
             applicationStatus === 'approved' ? '✅' :
             applicationStatus === 'rejected' ? '❌' : '🚀'}
          </StatusIcon>
          <StatusText>
            {applicationStatus === 'pending' ? '等待审批' :
             applicationStatus === 'approved' ? '审批通过' :
             applicationStatus === 'rejected' ? '审批被拒绝' : '账户创建中'}
          </StatusText>
          <StatusDescription>
            {applicationStatus === 'pending' && '您的简易用户注册申请已提交，正在等待赞助商审批...'}
            {applicationStatus === 'approved' && '赞助商已批准您的注册申请，正在创建账户...'}
            {applicationStatus === 'rejected' && '很抱歉，您的注册申请被拒绝了'}
            {applicationStatus === 'deployed' && '账户创建成功！'}
          </StatusDescription>
          {predictedAddress && (
            <AddressDisplay>{predictedAddress}</AddressDisplay>
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
            <AddressDisplay>{predictedAddress}</AddressDisplay>
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
