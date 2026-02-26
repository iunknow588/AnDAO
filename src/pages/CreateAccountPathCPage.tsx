/**
 * 路径C：成为赞助商注册页面
 * 
 * 赞助商注册流程：
 * 1. 设置赞助商资料
 * 2. 配置Gas支付EOA账户
 * 3. 设置审核规则和渠道
 * 4. 完成链上注册
 * 5. 进入赞助商仪表板
 * 
 * @module pages/CreateAccountPathCPage
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { keyManagerService } from '@/services/KeyManagerService';
import { sponsorService } from '@/services/SponsorService';
import { StorageProviderType, StorageProviderConfig } from '@/interfaces/IStorageProvider';
import { SponsorRules, ChannelInfo } from '@/types/sponsor';
import { Address, formatEther, parseEther } from 'viem';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { PasswordInputField } from '@/components/PasswordInput/PasswordInputField';
import { ErrorHandler } from '@/utils/errors';
import { normalizePrivateKeyInput, validatePasswordPair } from '@/utils/pathFlowValidation';
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

const InfoBox = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
`;

const InfoTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
`;

const InfoText = styled.div`
  font-size: 14px;
  color: #666;
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
 * 路径C创建页面组件
 */
export const CreateAccountPathCPage: React.FC = () => {
  const navigate = useNavigate();
  const { accountStore } = useStore();
  
  const [step, setStep] = useState(1);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorDescription, setSponsorDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactWechat, setContactWechat] = useState('');
  const [contactX, setContactX] = useState('');
  const [contactWebsite, setContactWebsite] = useState('');
  
  const [gasAccountMethod, setGasAccountMethod] = useState<'create' | 'import'>('create');
  const [gasAccountPrivateKey, setGasAccountPrivateKey] = useState('');
  const [gasAccountAddress, setGasAccountAddress] = useState<Address | null>(null);
  const [gasAccountBalance, setGasAccountBalance] = useState<bigint>(BigInt(0));
  const [acknowledgePrivateKeyRisk, setAcknowledgePrivateKeyRisk] = useState(false);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [dailyLimit, setDailyLimit] = useState('100');
  const [maxGasPerAccount, setMaxGasPerAccount] = useState('0.001');
  const [autoApprove, setAutoApprove] = useState(false);
  
  const [storageType, setStorageType] = useState<StorageProviderType>(StorageProviderType.IPFS);
  const [customStorageEndpoint, setCustomStorageEndpoint] = useState('');
  
  const [channelName, setChannelName] = useState('');
  const [channelInviteCode, setChannelInviteCode] = useState('');
  
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const chainId = accountStore.currentChainId;
  
  // 步骤2: 加载Gas账户余额
  useEffect(() => {
    if (step === 2 && gasAccountAddress) {
      loadGasAccountBalance();
    }
    // 仅在进入步骤2且 Gas 账户存在时刷新余额
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, gasAccountAddress]);
  
  /**
   * 加载Gas账户余额
   */
  const loadGasAccountBalance = async (address?: Address): Promise<bigint | null> => {
    const targetAddress = address ?? gasAccountAddress;
    if (!targetAddress) return null;
    
    try {
      console.log('[CreateAccountPathCPage] 加载 Gas 账户余额:', {
        gasAccountAddress: targetAddress,
        chainId,
      });

      const chainConfig = requireChainConfig(chainId, ['rpcUrl']);
      
      console.log('[CreateAccountPathCPage] 使用链配置:', {
        chainId: chainConfig.chainId,
        name: chainConfig.name,
        rpcUrl: chainConfig.rpcUrl,
      });

      const publicClient = createPublicClient({
        transport: http(chainConfig.rpcUrl),
      });
      
      console.log('[CreateAccountPathCPage] 从 RPC 查询余额:', chainConfig.rpcUrl);
      const balance = await publicClient.getBalance({ address: targetAddress });
      
      console.log('[CreateAccountPathCPage] 余额查询结果:', {
        balanceWei: balance.toString(),
        balanceEther: formatEther(balance),
      });
      
      setGasAccountBalance(balance);
      return balance;
    } catch (error) {
      console.error('[CreateAccountPathCPage] 加载 Gas 账户余额失败:', error);
      ErrorHandler.handleAndShow(error);
      return null;
    }
  };
  
  /**
   * 处理步骤1：设置赞助商资料
   */
  const handleSetSponsorInfo = () => {
    if (!sponsorName.trim()) {
      ErrorHandler.showError('请输入赞助商名称');
      return;
    }
    
    setStep(2);
  };
  
  /**
   * 处理步骤2：配置Gas账户
   */
  const handleSetGasAccount = async () => {
    try {
      setIsLoading(true);
      let privateKey: `0x${string}`;
      let resolvedGasAccountAddress: Address;
      
      if (gasAccountMethod === 'create') {
        // 创建新Gas账户
        const { address, privateKey: pk } = await keyManagerService.generatePrivateKey();
        privateKey = pk;
        resolvedGasAccountAddress = address;
      } else {
        // 导入现有Gas账户
        if (!acknowledgePrivateKeyRisk) {
          ErrorHandler.showError('请先确认您已理解私钥安全风险，并仅在可信环境中输入私钥');
          return;
        }
        if (!gasAccountPrivateKey) {
          ErrorHandler.showError('请输入Gas账户私钥');
          return;
        }
        
        const normalizedPrivateKey = normalizePrivateKeyInput(gasAccountPrivateKey);
        if (normalizedPrivateKey !== gasAccountPrivateKey) {
          setGasAccountPrivateKey(normalizedPrivateKey);
        }
        privateKey = normalizedPrivateKey;
        const address = keyManagerService.getAddressFromPrivateKey(privateKey);
        resolvedGasAccountAddress = address;
      }
      
      // 保存Gas账户私钥
      const passwordError = validatePasswordPair(password, confirmPassword);
      if (passwordError) {
        ErrorHandler.showError(passwordError);
        return;
      }
      
      setGasAccountAddress(resolvedGasAccountAddress);
      await keyManagerService.savePrivateKey(resolvedGasAccountAddress, privateKey, password);
      
      // 检查余额
      const latestBalance = await loadGasAccountBalance(resolvedGasAccountAddress);
      
      if (latestBalance === null || latestBalance < parseEther('0.5')) {
        ErrorHandler.showError('Gas账户余额不足，至少需要0.5 MNT');
        return;
      }
      
      setStep(3);
    } catch (error) {
      ErrorHandler.handleAndShow(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * 处理步骤3：设置审核规则和渠道
   */
  const handleSetRules = () => {
    if (!channelName.trim()) {
      ErrorHandler.showError('请输入渠道名称');
      return;
    }
    
    setStep(4);
  };
  
  /**
   * 处理步骤4：完成注册
   */
  const handleCompleteRegistration = async () => {
    if (!gasAccountAddress) {
      ErrorHandler.showError('Gas账户未设置');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 构建审核规则
      const rules: SponsorRules = {
        dailyLimit: parseInt(dailyLimit) || undefined,
        maxGasPerAccount: parseEther(maxGasPerAccount),
        autoApprove,
      };
      
      // 构建存储配置
      let storageConfig: StorageProviderConfig | undefined;
      if (storageType === StorageProviderType.CUSTOM && customStorageEndpoint) {
        storageConfig = {
          type: StorageProviderType.CUSTOM,
          name: 'Custom Storage',
          endpoint: customStorageEndpoint,
        };
      } else {
        storageConfig = {
          type: storageType,
          name: storageType === StorageProviderType.IPFS ? 'IPFS (Default)' : 'Arweave',
        };
      }
      
      // 注册赞助商
      const id = await sponsorService.registerOnChain({
        sponsorAddress: gasAccountAddress, // 简化：使用Gas账户作为赞助商地址
        gasAccountAddress,
        sponsorInfo: {
          name: sponsorName,
          description: sponsorDescription || undefined,
          contact: {
            email: contactEmail || undefined,
            wechat: contactWechat || undefined,
            x: contactX || undefined,
            website: contactWebsite || undefined,
          },
        },
        rules,
        storageConfig,
      });
      
      setSponsorId(id);
      
      // 创建渠道
      if (channelName) {
        const channelInfo: ChannelInfo = {
          name: channelName,
          inviteCode: channelInviteCode || undefined,
        };
        await sponsorService.createChannel(id, channelInfo);
      }
      
      setStep(5);
    } catch (error) {
      ErrorHandler.handleAndShow(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * 处理完成
   */
  const handleSuccess = () => {
    // 导航到赞助商仪表板
    navigate('/sponsor/dashboard');
  };
  
  const steps = [
    { number: 1, label: '设置资料' },
    { number: 2, label: 'Gas账户' },
    { number: 3, label: '审核规则' },
    { number: 4, label: '完成注册' },
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
      
      {/* 步骤1: 设置赞助商资料 */}
      {step === 1 && (
        <Card>
          <Title>💎 成为赞助商</Title>
          <Description>
            设置您的赞助商资料，帮助新手用户创建账户
          </Description>
          
          <InfoBox>
            <InfoTitle>作为赞助商，您将：</InfoTitle>
            <InfoText>
              • 为新手用户代付Gas创建账户<br />
              • 设置审核规则防止滥用<br />
              • 获得社区声誉和可能的收益<br />
              • 管理自己的推广渠道
            </InfoText>
          </InfoBox>
          
          <Input
            label="赞助商名称 *"
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
            placeholder="输入赞助商名称"
            required
          />
          
          <Input
            label="赞助商描述"
            value={sponsorDescription}
            onChange={(e) => setSponsorDescription(e.target.value)}
            placeholder="简短介绍您的赞助商"
          />
          
          <Input
            label="联系邮箱（可选）"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="例如：name@example.com"
          />
          
          <Input
            label="微信（可选）"
            value={contactWechat}
            onChange={(e) => setContactWechat(e.target.value)}
            placeholder="请输入微信号"
          />
          
          <Input
            label="X（推特）（可选）"
            value={contactX}
            onChange={(e) => setContactX(e.target.value)}
            placeholder="例如：@your_handle"
          />
          
          <Input
            label="网站（可选）"
            value={contactWebsite}
            onChange={(e) => setContactWebsite(e.target.value)}
            placeholder="例如：https://example.com"
          />
          
          <ButtonGroup>
            <Button onClick={() => navigate('/welcome')} variant="secondary">
              返回
            </Button>
            <Button
              onClick={handleSetSponsorInfo}
              disabled={!sponsorName.trim()}
            >
              下一步
            </Button>
          </ButtonGroup>
        </Card>
      )}
      
      {/* 步骤2: 配置Gas账户 */}
      {step === 2 && (
        <Card>
          <Title>💰 配置Gas支付账户</Title>
          <Description>
            设置用于支付Gas费用的EOA账户
          </Description>
          
          <InfoBox>
            <InfoTitle>要求：</InfoTitle>
            <InfoText>
              • 至少需要0.5 MNT作为初始Gas资金<br />
              • 推荐使用专用账户，与个人资产隔离<br />
              • 确保账户有足够的余额支持赞助
            </InfoText>
          </InfoBox>
          
          <Tabs>
            <Tab $active={gasAccountMethod === 'create'} onClick={() => setGasAccountMethod('create')}>
              创建新账户
            </Tab>
            <Tab $active={gasAccountMethod === 'import'} onClick={() => setGasAccountMethod('import')}>
              导入现有账户
            </Tab>
          </Tabs>
          
          {gasAccountMethod === 'create' ? (
            <>
              <Description>
                系统将为您生成一个专用的Gas支付账户
              </Description>
              
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
                autoComplete="new-password"
              />
            </>
          ) : (
            <>
              <Input
                label="Gas账户私钥"
                type="password"
                value={gasAccountPrivateKey}
                onChange={(e) => setGasAccountPrivateKey(e.target.value)}
                placeholder="输入EOA私钥（0x开头）"
                autoComplete="off"
                spellCheck={false}
              />

              <SecurityWarning>
                私钥是您资产的唯一凭证。请仅在可信设备/可信环境中输入，且不要截图、复制到聊天软件或云笔记中。
                <br />
                重要提示：本钱包为纯前端应用，**没有后台服务程序保护或托管您的私钥**，也不会替您保管私钥；
                私钥一旦泄露，资产可能被立即转走且无法追回。
              </SecurityWarning>

              <div style={{ marginTop: '8px', marginBottom: '16px', fontSize: 12, color: '#e03131' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={acknowledgePrivateKeyRisk}
                    onChange={(e) => setAcknowledgePrivateKeyRisk(e.target.checked)}
                  />
                  <span>我已理解风险：本钱包不托管私钥，因私钥泄露/丢失造成的损失由我自行承担。</span>
                </label>
              </div>
              
              <PasswordInputField
                label="设置密码"
                value={password}
                onChange={(value) => setPassword(value)}
                placeholder="至少8个字符"
                showRequirements={true}
                showStrength={true}
                autoComplete="new-password"
              />
              
              <Input
                label="确认密码"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                autoComplete="new-password"
                error={
                  confirmPassword && password !== confirmPassword
                    ? '两次输入的密码不一致'
                    : undefined
                }
              />
            </>
          )}
          
          {gasAccountAddress && (
            <>
              <AddressDisplay>
                Gas账户地址：{gasAccountAddress}
              </AddressDisplay>
              
              <BalanceDisplay>
                <BalanceLabel>账户余额</BalanceLabel>
                <BalanceValue>{formatEther(gasAccountBalance)} MNT</BalanceValue>
              </BalanceDisplay>
            </>
          )}
          
          <ButtonGroup>
            <Button onClick={() => setStep(1)} variant="secondary">
              上一步
            </Button>
            <Button
              onClick={handleSetGasAccount}
              disabled={
                isLoading ||
                (!!gasAccountAddress && gasAccountBalance < parseEther('0.5')) ||
                (gasAccountMethod === 'import' && !acknowledgePrivateKeyRisk)
              }
            >
              {isLoading ? <LoadingSpinner /> : gasAccountAddress ? '下一步' : '设置账户'}
            </Button>
          </ButtonGroup>
        </Card>
      )}
      
      {/* 步骤3: 设置审核规则和渠道 */}
      {step === 3 && (
        <Card>
          <Title>⚙️ 设置审核规则和渠道</Title>
          <Description>
            配置审核规则和推广渠道
          </Description>
          
          <InfoTitle style={{ marginBottom: '16px' }}>审核规则：</InfoTitle>
          
          <Input
            label="每日赞助限额（账户数）"
            type="number"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            placeholder="100"
          />
          
          <Input
            label="单账户最大Gas（MNT）"
            type="number"
            step="0.001"
            value={maxGasPerAccount}
            onChange={(e) => setMaxGasPerAccount(e.target.value)}
            placeholder="0.001"
          />
          
          <div style={{ marginBottom: '16px' }}>
            <label>
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              自动审核（自动批准符合条件的申请）
            </label>
          </div>
          
          <InfoTitle style={{ marginTop: '32px', marginBottom: '16px' }}>存储方案：</InfoTitle>
          
          <RadioGroup>
            <RadioOption
              selected={storageType === StorageProviderType.IPFS}
              onClick={() => setStorageType(StorageProviderType.IPFS)}
            >
              <RadioTitle>IPFS（默认）</RadioTitle>
              <RadioDescription>
                使用公共IPFS网络存储申请数据
              </RadioDescription>
            </RadioOption>
            
            <RadioOption
              selected={storageType === StorageProviderType.CUSTOM}
              onClick={() => setStorageType(StorageProviderType.CUSTOM)}
            >
              <RadioTitle>自定义存储</RadioTitle>
              <RadioDescription>
                使用您自己的存储服务
              </RadioDescription>
            </RadioOption>
          </RadioGroup>
          
          {storageType === StorageProviderType.CUSTOM && (
            <Input
              label="自定义存储端点"
              value={customStorageEndpoint}
              onChange={(e) => setCustomStorageEndpoint(e.target.value)}
              placeholder="例如：https://storage.example.com"
            />
          )}
          
          <InfoTitle style={{ marginTop: '32px', marginBottom: '16px' }}>渠道管理：</InfoTitle>
          
          <Input
            label="渠道名称 *"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder="例如：社群推广渠道"
            required
          />
          
          <Input
            label="邀请码（可选）"
            value={channelInviteCode}
            onChange={(e) => setChannelInviteCode(e.target.value)}
            placeholder="自定义邀请码，留空自动生成"
          />
          
          <ButtonGroup>
            <Button onClick={() => setStep(2)} variant="secondary">
              上一步
            </Button>
            <Button
              onClick={handleSetRules}
              disabled={!channelName.trim()}
            >
              下一步
            </Button>
          </ButtonGroup>
        </Card>
      )}
      
      {/* 步骤4: 完成注册 */}
      {step === 4 && (
        <Card>
          <Title>📝 确认注册信息</Title>
          <Description>
            请确认您的注册信息，然后完成链上注册
          </Description>
          
          <InfoBox>
            <InfoTitle>赞助商信息：</InfoTitle>
            <InfoText>
              名称：{sponsorName}<br />
              描述：{sponsorDescription || '无'}<br />
              Gas账户：{gasAccountAddress}<br />
              余额：{formatEther(gasAccountBalance)} MNT
            </InfoText>
          </InfoBox>
          
          <InfoBox>
            <InfoTitle>审核规则：</InfoTitle>
            <InfoText>
              每日限额：{dailyLimit}个账户<br />
              单账户最大Gas：{maxGasPerAccount} MNT<br />
              自动审核：{autoApprove ? '开启' : '关闭'}
            </InfoText>
          </InfoBox>
          
          <InfoBox>
            <InfoTitle>渠道信息：</InfoTitle>
            <InfoText>
              渠道名称：{channelName}<br />
              邀请码：{channelInviteCode || '自动生成'}
            </InfoText>
          </InfoBox>
          
          <ButtonGroup>
            <Button onClick={() => setStep(3)} variant="secondary">
              上一步
            </Button>
            <Button
              onClick={handleCompleteRegistration}
              disabled={isLoading}
            >
              {isLoading ? <LoadingSpinner /> : '完成注册'}
            </Button>
          </ButtonGroup>
        </Card>
      )}
      
      {/* 步骤5: 注册成功 */}
      {step === 5 && sponsorId && (
        <StatusCard>
          <StatusIcon>🎉</StatusIcon>
          <StatusText>赞助商注册成功！</StatusText>
          <StatusDescription>
            欢迎加入AnDao赞助商网络！
            <br />
            您的赞助商ID：{sponsorId}
          </StatusDescription>
          
          <InfoBox style={{ marginTop: '24px' }}>
            <InfoTitle>接下来您可以：</InfoTitle>
            <InfoText>
              • 进入赞助商仪表板查看待处理申请<br />
              • 分享您的邀请码开始推广<br />
              • 管理审核规则和渠道设置
            </InfoText>
          </InfoBox>
          
          <ButtonGroup>
            <Button onClick={handleSuccess}>
              进入仪表板
            </Button>
          </ButtonGroup>
        </StatusCard>
      )}
    </Container>
  );
};
