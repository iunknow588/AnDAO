/**
 * 路径B：标准模式账户创建页面
 * 
 * 有EOA用户的账户创建流程：
 * 1. EOA账户设置（创建新EOA或导入现有）
 * 2. 生成智能账户密钥对
 * 3. 选择Gas支付方式（自付或申请赞助）
 * 4. 创建账户
 * 5. 完成
 * 
 * @module pages/CreateAccountPathBPage
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { accountManager } from '@/services/AccountManager';
import { keyManagerService } from '@/services/KeyManagerService';
import { sponsorService } from '@/services/SponsorService';
import { Sponsor, Application, ApplicationStatus } from '@/types/sponsor';
import { AccountInfo } from '@/types';
import { Address, formatEther, parseEther } from 'viem';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { PasswordInputField } from '@/components/PasswordInput/PasswordInputField';
import { ErrorHandler } from '@/utils/errors';
import { normalizePrivateKeyInput, validatePasswordPair } from '@/utils/pathFlowValidation';
import { trimInputValue } from '@/utils/formValidation';
import { requireChainConfig } from '@/utils/chainConfigValidation';
import { useStore } from '@/stores';
import { createPublicClient, http } from 'viem';

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

const SecurityWarning = styled.p`
  font-size: 12px;
  color: #e03131;
  margin: 8px 0 16px;
  line-height: 1.6;
`;

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
`;

const RadioOption = styled(Card)<{ selected?: boolean }>`
  cursor: pointer;
  border: 2px solid ${props => props.selected ? '#4c6ef5' : 'transparent'};
  transition: all 0.3s ease;
  
  &:hover {
    border-color: #4c6ef5;
  }
`;

const RadioTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
`;

const RadioDescription = styled.p`
  font-size: 14px;
  color: #666;
  margin-bottom: 4px;
`;

const GasEstimate = styled.div`
  font-size: 12px;
  color: #4c6ef5;
  font-weight: 500;
`;

const BalanceDisplay = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: center;
`;

const BalanceLabel = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
`;

const BalanceValue = styled.div`
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
`;

const AddressDisplay = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  word-break: break-all;
  text-align: center;
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

const Tabs = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 2px solid #e9ecef;
`;

const Tab = styled.button<{ $active?: boolean }>`
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 2px solid ${props => props.$active ? '#4c6ef5' : 'transparent'};
  color: ${props => props.$active ? '#4c6ef5' : '#666'};
  font-weight: ${props => props.$active ? '600' : '400'};
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    color: #4c6ef5;
  }
`;

/**
 * 路径B创建页面组件
 */
export const CreateAccountPathBPage: React.FC = () => {
  const navigate = useNavigate();
  const { accountStore } = useStore();
  
  const [step, setStep] = useState(1);
  const [eoaMethod, setEoaMethod] = useState<'create' | 'import'>('create');
  const [eoaPrivateKey, setEoaPrivateKey] = useState('');
  const [eoaMnemonic, setEoaMnemonic] = useState('');
  const [eoaAddress, setEoaAddress] = useState<Address | null>(null);
  const [eoaBalance, setEoaBalance] = useState<bigint>(BigInt(0));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ownerAddress, setOwnerAddress] = useState<Address | null>(null);
  const [predictedAddress, setPredictedAddress] = useState<Address | null>(null);
  const [gasPaymentMethod, setGasPaymentMethod] = useState<'self' | 'sponsor'>('self');
  const [selectedSponsor, setSelectedSponsor] = useState<string>();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [application, setApplication] = useState<Application | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [accountAddress, setAccountAddress] = useState<Address | null>(null);
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);
  
  const chainId = accountStore.currentChainId;
  
  // 步骤1: 加载EOA余额
  useEffect(() => {
    if (step === 2 && eoaAddress) {
      loadEOABalance();
    }
    // 仅在进入步骤2且地址可用时刷新余额
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, eoaAddress]);
  
  // 步骤3: 加载赞助商列表
  useEffect(() => {
    if (step === 3 && gasPaymentMethod === 'sponsor') {
      sponsorService.getRecommendedSponsors()
        .then(setSponsors)
        .catch(error => {
          ErrorHandler.handleAndShow(error);
        });
    }
  }, [step, gasPaymentMethod]);
  
  // 步骤4: 轮询申请状态
  useEffect(() => {
    if (step === 4 && application && gasPaymentMethod === 'sponsor') {
      sponsorService.pollApplicationStatus(
        application.id,
        (status) => {
          setApplicationStatus(status);
          if (status === 'deployed') {
            setStep(5); // 创建成功
          } else if (status === 'rejected') {
            ErrorHandler.showError('申请被拒绝，请重新选择赞助商');
            setStep(3); // 返回选择Gas支付方式
          }
        }
      );
      
      return () => {
        if (application) {
          sponsorService.stopPolling(application.id);
        }
      };
    }
  }, [step, application, gasPaymentMethod]);
  
  /**
   * 加载EOA余额
   */
  const loadEOABalance = async () => {
    if (!eoaAddress) return;
    
    try {
      console.log('[CreateAccountPathBPage] 加载 EOA 余额:', {
        eoaAddress,
        chainId,
      });

      const chainConfig = requireChainConfig(chainId, ['rpcUrl']);
      
      console.log('[CreateAccountPathBPage] 使用链配置:', {
        chainId: chainConfig.chainId,
        name: chainConfig.name,
        rpcUrl: chainConfig.rpcUrl,
      });

      const publicClient = createPublicClient({
        transport: http(chainConfig.rpcUrl),
      });
      
      console.log('[CreateAccountPathBPage] 从 RPC 查询余额:', chainConfig.rpcUrl);
      const balance = await publicClient.getBalance({ address: eoaAddress });
      
      console.log('[CreateAccountPathBPage] 余额查询结果:', {
        balanceWei: balance.toString(),
        balanceEther: formatEther(balance),
      });
      
      setEoaBalance(balance);
    } catch (error) {
      console.error('[CreateAccountPathBPage] 加载 EOA 余额失败:', error);
      ErrorHandler.handleAndShow(error);
    }
  };
  
  /**
   * 处理步骤1：创建或导入EOA
   */
  const handleEOASetup = async () => {
    try {
      setIsLoading(true);
      const passwordValue = trimInputValue(password);
      const confirmPasswordValue = trimInputValue(confirmPassword);
      let privateKey: `0x${string}`;
      let resolvedEoaAddress: Address;
      
      if (eoaMethod === 'create') {
        // 创建新EOA
        const { address, privateKey: pk } = await keyManagerService.generatePrivateKey();
        privateKey = pk;
        resolvedEoaAddress = address;
      } else {
        // 导入现有EOA
        if (eoaPrivateKey) {
          // 从私钥导入
          const normalizedPrivateKey = normalizePrivateKeyInput(eoaPrivateKey);
          if (normalizedPrivateKey !== eoaPrivateKey) {
            setEoaPrivateKey(normalizedPrivateKey);
          }
          privateKey = normalizedPrivateKey;
          const address = keyManagerService.getAddressFromPrivateKey(privateKey);
          resolvedEoaAddress = address;
        } else if (eoaMnemonic) {
          // 从助记词恢复（使用标准 BIP-39 流程）
          const { address, privateKey: recovered } = await keyManagerService.recoverFromMnemonic(
            eoaMnemonic
          );
          privateKey = recovered;
          resolvedEoaAddress = address;
        } else {
          ErrorHandler.showError('请输入私钥或助记词');
          return;
        }
      }
      
      // 保存EOA私钥（加密存储）
      const passwordError = validatePasswordPair(passwordValue, confirmPasswordValue);
      if (passwordError) {
        ErrorHandler.showError(passwordError);
        return;
      }
      
      setEoaAddress(resolvedEoaAddress);
      await keyManagerService.savePrivateKey(resolvedEoaAddress, privateKey, passwordValue);
      setStep(2);
    } catch (error) {
      ErrorHandler.handleAndShow(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * 处理步骤2：生成智能账户密钥
   */
  const handleGenerateSmartAccountKey = async () => {
    try {
      setIsLoading(true);
      const passwordValue = trimInputValue(password);
      const { address, privateKey } = await keyManagerService.generatePrivateKey();
      setOwnerAddress(address);
      
      // 保存智能账户私钥
      await keyManagerService.savePrivateKey(address, privateKey, passwordValue);
      
      // 预测智能账户地址
      const predicted = await accountManager.predictAccountAddress(address, chainId);
      setPredictedAddress(predicted);
      
      setStep(3);
    } catch (error) {
      ErrorHandler.handleAndShow(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * 处理步骤3：选择Gas支付方式并创建账户
   */
  const handleCreateAccount = async () => {
    if (!eoaAddress || !ownerAddress || !predictedAddress) {
      ErrorHandler.showError('请先完成前面的步骤');
      return;
    }
    
    try {
      setIsLoading(true);
      
      if (gasPaymentMethod === 'self') {
        // 自付Gas：直接部署
        if (eoaBalance < parseEther('0.001')) {
          ErrorHandler.showError('EOA账户余额不足，至少需要0.001 MNT');
          return;
        }
        
        // 获取EOA私钥
        const passwordValue = trimInputValue(password);
        const eoaPk = await keyManagerService.getPrivateKey(eoaAddress, passwordValue);
        if (!eoaPk) {
          ErrorHandler.showError('无法获取EOA私钥，请检查密码');
          return;
        }
        
        // 创建账户
        const address = await accountManager.createAndDeployAccount(
          ownerAddress,
          chainId,
          eoaPk
        );
        
        setAccountAddress(address);
        setStep(5); // 直接完成
      } else {
        // 申请赞助商代付
        if (!selectedSponsor) {
          ErrorHandler.showError('请选择赞助商');
          return;
        }
        
        const app = await sponsorService.createApplication({
          accountAddress: predictedAddress,
          ownerAddress,
          eoaAddress,
          sponsorId: selectedSponsor,
          chainId,
        });
        
        setApplication(app);
        setStep(4); // 等待审核
      }
    } catch (error) {
      ErrorHandler.handleAndShow(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * 处理创建成功
   */
  const handleSuccess = () => {
    if (accountAddress || predictedAddress) {
      const finalAddress = accountAddress || predictedAddress!;
      const accountInfo: AccountInfo = {
        address: finalAddress,
        chainId,
        owner: ownerAddress!,
        status: accountAddress ? 'deployed' : 'predicted',
        createdAt: Date.now(),
        deployedAt: accountAddress ? Date.now() : undefined,
      };
      
      // 保存账户信息到AccountManager
      accountManager.importAccount(accountInfo).catch(error => {
        ErrorHandler.handleAndShow(error);
      });
      
      navigate('/assets');
    }
  };
  
  const steps = [
    { number: 1, label: 'EOA设置' },
    { number: 2, label: '生成密钥' },
    { number: 3, label: '选择支付' },
    { number: 4, label: '等待审核' },
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
      
      {/* 步骤1: EOA账户设置 */}
      {step === 1 && (
        <Card>
          <Title>⚡ 设置EOA账户</Title>
          <Description>
            您需要先设置一个EOA账户用于支付Gas费用
          </Description>
          
          <Tabs>
            <Tab $active={eoaMethod === 'create'} onClick={() => setEoaMethod('create')}>
              创建新EOA
            </Tab>
            <Tab $active={eoaMethod === 'import'} onClick={() => setEoaMethod('import')}>
              导入现有EOA
            </Tab>
          </Tabs>
          
          {eoaMethod === 'create' ? (
            <>
              <Description>
                系统将为您生成一个新的EOA账户，请设置密码保护
              </Description>
              
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

              <SecurityWarning>
                本钱包不会为您保存任何助记词或私钥，一旦丢失将无法找回，账户资产可能永久丢失：
                <br />
                - 请务必在安全的环境中备份助记词/私钥；
                <br />
                - 不要将助记词/私钥存放在聊天软件、邮件或云笔记中；
                <br />
                - 所有因助记词/私钥泄露或遗失造成的损失，将由用户自行承担。
              </SecurityWarning>

              <div style={{ marginTop: '8px', marginBottom: '16px', fontSize: 12, color: '#e03131' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={acknowledgeRisk}
                    onChange={(e) => setAcknowledgeRisk(e.target.checked)}
                  />
                  <span>我已阅读并理解以上风险，若因助记词/私钥丢失导致资产损失，将由我本人承担。</span>
                </label>
              </div>
            </>
          ) : (
            <>
              <Input
                label="私钥"
                type="password"
                value={eoaPrivateKey}
                onChange={(e) => setEoaPrivateKey(e.target.value)}
                placeholder="输入EOA私钥（0x开头）"
              />
              
              <div style={{ margin: '16px 0', textAlign: 'center', color: '#666' }}>
                或
              </div>
              
              <Input
                label="助记词"
                value={eoaMnemonic}
                onChange={(e) => setEoaMnemonic(e.target.value)}
                placeholder="输入12或24个单词的助记词"
              />

              <SecurityWarning>
                助记词和私钥是您资产的唯一凭证，请务必妥善保管：
                <br />
                - 不要在不可信的网站或应用中输入助记词/私钥；
                <br />
                - 不要截图、转发或分享给任何人（包括自称官方的人员）；
                <br />
                - 建议使用离线方式（纸质或硬件）备份并妥善保存。
              </SecurityWarning>
              
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
            </>
          )}
          
          <ButtonGroup>
            <Button onClick={() => navigate('/welcome')} variant="secondary">
              返回
            </Button>
            <Button
              onClick={handleEOASetup}
              disabled={
                isLoading ||
                !password ||
                password !== confirmPassword ||
                (eoaMethod === 'create' && !acknowledgeRisk)
              }
            >
              {isLoading ? <LoadingSpinner /> : '下一步'}
            </Button>
          </ButtonGroup>
        </Card>
      )}
      
      {/* 步骤2: 生成智能账户密钥 */}
      {step === 2 && eoaAddress && (
        <Card>
          <Title>🔐 生成智能账户密钥</Title>
          <Description>
            系统将为您生成智能合约账户的密钥对
          </Description>
          
          <BalanceDisplay>
            <BalanceLabel>EOA账户余额</BalanceLabel>
            <BalanceValue>{formatEther(eoaBalance)} MNT</BalanceValue>
          </BalanceDisplay>
          
          <AddressDisplay>
            EOA地址：{eoaAddress}
          </AddressDisplay>
          
          {predictedAddress && (
            <AddressDisplay>
              智能账户地址（预测）：{predictedAddress}
            </AddressDisplay>
          )}
          
          <ButtonGroup>
            <Button onClick={() => setStep(1)} variant="secondary">
              上一步
            </Button>
            <Button
              onClick={handleGenerateSmartAccountKey}
              disabled={isLoading || !!predictedAddress}
            >
              {isLoading ? <LoadingSpinner /> : predictedAddress ? '下一步' : '生成密钥'}
            </Button>
          </ButtonGroup>
        </Card>
      )}
      
      {/* 步骤3: 选择Gas支付方式 */}
      {step === 3 && predictedAddress && (
        <Card>
          <Title>💰 选择创建方式</Title>
          <Description>
            选择如何支付Gas费用来创建智能账户
          </Description>
          
          <BalanceDisplay>
            <BalanceLabel>EOA账户余额</BalanceLabel>
            <BalanceValue>{formatEther(eoaBalance)} MNT</BalanceValue>
          </BalanceDisplay>
          
          <RadioGroup>
            <RadioOption
              selected={gasPaymentMethod === 'self'}
              onClick={() => setGasPaymentMethod('self')}
            >
              <RadioTitle>自己支付Gas（推荐）</RadioTitle>
              <RadioDescription>
                使用EOA账户支付约0.001 MNT
                <br />
                立即创建，无需等待
              </RadioDescription>
              <GasEstimate>预计费用：0.0012 MNT</GasEstimate>
            </RadioOption>
            
            <RadioOption
              selected={gasPaymentMethod === 'sponsor'}
              onClick={() => setGasPaymentMethod('sponsor')}
            >
              <RadioTitle>申请赞助商代付</RadioTitle>
              <RadioDescription>
                免费创建，需要等待审核
                <br />
                适合没有MNT的用户
              </RadioDescription>
            </RadioOption>
          </RadioGroup>
          
          {gasPaymentMethod === 'sponsor' && sponsors.length > 0 && (
            <>
              <div style={{ marginTop: '24px', marginBottom: '16px' }}>
                <strong>选择赞助商：</strong>
              </div>
              {sponsors.map(sponsor => (
                <Card
                  key={sponsor.id}
                  style={{
                    cursor: 'pointer',
                    marginBottom: '16px',
                    border: selectedSponsor === sponsor.id ? '2px solid #4c6ef5' : '2px solid transparent',
                  }}
                  onClick={() => setSelectedSponsor(sponsor.id)}
                >
                  <h3>{sponsor.name}</h3>
                  <p style={{ fontSize: '14px', color: '#666' }}>{sponsor.description}</p>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                    通过率: {sponsor.approvalRate}% | 平均等待: {sponsor.avgWaitTime}分钟
                  </div>
                </Card>
              ))}
            </>
          )}
          
          <ButtonGroup>
            <Button onClick={() => setStep(2)} variant="secondary">
              上一步
            </Button>
            <Button
              onClick={handleCreateAccount}
              disabled={isLoading || (gasPaymentMethod === 'sponsor' && !selectedSponsor)}
            >
              {isLoading ? <LoadingSpinner /> : '创建账户'}
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
          {(accountAddress || predictedAddress) && (
            <AddressDisplay>{accountAddress || predictedAddress}</AddressDisplay>
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
