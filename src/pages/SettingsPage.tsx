/**
 * 设置页面
 * 
 * 钱包设置和配置
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/AuthService';
import { settingsService } from '@/services/SettingsService';
import { paymasterService, type PaymasterUsageRecord } from '@/services/PaymasterService';
import { validateRequiredFields } from '@/utils/formValidation';

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

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #495057;
  margin-bottom: 8px;
`;

const Select = styled.select`
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  margin-bottom: 16px;
  background: #ffffff;

  &:focus {
    outline: none;
    border-color: #4c6ef5;
  }
`;

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  width: 20px;
  height: 20px;
  margin-right: 8px;
  cursor: pointer;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #495057;
  margin-bottom: 16px;
  cursor: pointer;
`;

const Description = styled.p`
  font-size: 12px;
  color: #868e96;
  margin-top: -8px;
  margin-bottom: 16px;
`;

export const SettingsPage = observer(() => {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 自动锁定设置
  const [autoLockDelay, setAutoLockDelay] = useState(5);
  const [isSavingAutoLock, setIsSavingAutoLock] = useState(false);

  // Gas代付设置
  const [paymasterEnabled, setPaymasterEnabled] = useState(true);
  const [paymasterStrategy, setPaymasterStrategy] = useState<'auto' | 'always' | 'never'>('auto');
  const [isSavingPaymaster, setIsSavingPaymaster] = useState(false);

  // 安全提示设置
  const [showSecurityTips, setShowSecurityTips] = useState(true);
  const [securityTipLevel, setSecurityTipLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSavingSecurityTips, setIsSavingSecurityTips] = useState(false);
  // Paymaster 历史
  const [paymasterHistory, setPaymasterHistory] = useState<PaymasterUsageRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsService.getSettings();
        setAutoLockDelay(settings.autoLockDelay);
        setPaymasterEnabled(settings.paymasterEnabled);
        setPaymasterStrategy(settings.paymasterStrategy);
        setShowSecurityTips(settings.showSecurityTips);
        setSecurityTipLevel(settings.securityTipLevel);
      } catch (err) {
        console.error('加载设置失败:', err);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    refreshPaymasterHistory();
  }, []);

  const refreshPaymasterHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const history = await paymasterService.getUsageHistory(20);
      setPaymasterHistory(history);
    } catch (error) {
      console.error('加载 Paymaster 历史失败:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleChangePassword = async () => {
    const requiredError = validateRequiredFields(
      [
        { value: oldPassword, label: '当前密码' },
        { value: newPassword, label: '新密码' },
        { value: confirmPassword, label: '确认新密码' },
      ],
      '请填写所有字段'
    );
    if (requiredError) {
      setError(requiredError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('新密码与确认密码不一致');
      return;
    }

    if (newPassword.length < 8) {
      setError('密码至少需要8个字符');
      return;
    }

    setIsChangingPassword(true);
    setError(null);
    setSuccess(null);

    try {
      const success = await authService.changePassword(oldPassword, newPassword);
      if (success) {
        setSuccess('密码修改成功');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError('修改密码失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改密码失败');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate('/wallet/unlock');
  };

  // 保存自动锁定设置
  const handleSaveAutoLock = async () => {
    if (autoLockDelay < 1 || autoLockDelay > 1440) {
      setError('自动锁定时间必须在1-1440分钟之间');
      return;
    }

    setIsSavingAutoLock(true);
    setError(null);
    setSuccess(null);

    try {
      await settingsService.setAutoLockDelay(autoLockDelay);
      await authService.updateAutoLockDelay();
      setSuccess('自动锁定时间已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSavingAutoLock(false);
    }
  };

  // 保存Gas代付设置
  const handleSavePaymaster = async () => {
    setIsSavingPaymaster(true);
    setError(null);
    setSuccess(null);

    try {
      await settingsService.setPaymasterSettings(paymasterEnabled, paymasterStrategy);
      setSuccess('Gas 代付设置已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSavingPaymaster(false);
    }
  };

  // 保存安全提示设置
  const handleSaveSecurityTips = async () => {
    setIsSavingSecurityTips(true);
    setError(null);
    setSuccess(null);

    try {
      await settingsService.setSecurityTipSettings(showSecurityTips, securityTipLevel);
      setSuccess('安全提示设置已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSavingSecurityTips(false);
    }
  };

  return (
    <Container>
      <Title>设置</Title>

      <Card>
        <SectionTitle>修改密码</SectionTitle>
        <Input
          type="password"
          placeholder="当前密码"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          disabled={isChangingPassword}
        />
        <Input
          type="password"
          placeholder="新密码"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={isChangingPassword}
        />
        <Input
          type="password"
          placeholder="确认新密码"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isChangingPassword}
        />
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {success && <SuccessMessage>{success}</SuccessMessage>}
        <Button onClick={handleChangePassword} disabled={isChangingPassword}>
          {isChangingPassword ? '修改中...' : '修改密码'}
        </Button>
      </Card>

      <Card>
        <SectionTitle>自动锁定</SectionTitle>
        <Label>自动锁定时间（分钟）</Label>
        <Input
          type="number"
          min="1"
          max="1440"
          value={autoLockDelay}
          onChange={(e) => setAutoLockDelay(Number(e.target.value))}
          disabled={isSavingAutoLock}
        />
        <Description>设置钱包在无活动后自动锁定的时间（1-1440分钟）</Description>
        <Button onClick={handleSaveAutoLock} disabled={isSavingAutoLock}>
          {isSavingAutoLock ? '保存中...' : '保存设置'}
        </Button>
      </Card>

      <Card>
        <SectionTitle>Gas代付设置</SectionTitle>
        <CheckboxLabel>
          <Checkbox
            checked={paymasterEnabled}
            onChange={(e) => setPaymasterEnabled(e.target.checked)}
            disabled={isSavingPaymaster}
          />
          启用Gas代付
        </CheckboxLabel>
        <Description>启用后，符合条件的交易可以使用Paymaster代付Gas费用</Description>
        
        <Label>Gas代付策略</Label>
        <Select
          value={paymasterStrategy}
          onChange={(e) => setPaymasterStrategy(e.target.value as 'auto' | 'always' | 'never')}
          disabled={isSavingPaymaster || !paymasterEnabled}
        >
          <option value="auto">自动（推荐）</option>
          <option value="always">总是使用</option>
          <option value="never">从不使用</option>
        </Select>
        <Description>自动：系统自动判断是否使用；总是：符合条件的交易都使用；从不：不使用Gas代付</Description>
        
        <Button onClick={handleSavePaymaster} disabled={isSavingPaymaster}>
          {isSavingPaymaster ? '保存中...' : '保存设置'}
        </Button>
      </Card>

      <Card>
        <SectionTitle>安全提示</SectionTitle>
        <CheckboxLabel>
          <Checkbox
            checked={showSecurityTips}
            onChange={(e) => setShowSecurityTips(e.target.checked)}
            disabled={isSavingSecurityTips}
          />
          显示安全提示
        </CheckboxLabel>
        <Description>启用后，在关键操作时会显示安全提示信息</Description>
        
        <Label>安全提示级别</Label>
        <Select
          value={securityTipLevel}
          onChange={(e) => setSecurityTipLevel(e.target.value as 'low' | 'medium' | 'high')}
          disabled={isSavingSecurityTips || !showSecurityTips}
        >
          <option value="low">低（仅关键操作）</option>
          <option value="medium">中（推荐）</option>
          <option value="high">高（所有操作）</option>
        </Select>
        <Description>设置安全提示的显示频率和详细程度</Description>
        
        <Button onClick={handleSaveSecurityTips} disabled={isSavingSecurityTips}>
          {isSavingSecurityTips ? '保存中...' : '保存设置'}
        </Button>
      </Card>

      <Card>
        <SectionTitle>Gas 代付历史</SectionTitle>
        <Description>展示最近的 Paymaster 使用记录，便于审计与调试。</Description>
        <Button onClick={refreshPaymasterHistory} disabled={isLoadingHistory}>
          {isLoadingHistory ? '刷新中...' : '刷新记录'}
        </Button>

        {paymasterHistory.length === 0 && (
          <Description style={{ marginTop: '12px' }}>暂无代付记录</Description>
        )}

        {paymasterHistory.map((item) => (
          <div
            key={item.txHash}
            style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '12px',
              fontSize: '13px',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>{item.txHash}</div>
            <div>状态：{item.status}</div>
            <div>链：{item.chainId}</div>
            <div>Paymaster：{item.paymasterAddress}</div>
            <div>时间：{new Date(item.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </Card>

      <Card>
        <SectionTitle>账户</SectionTitle>
        <DangerButton onClick={handleLogout}>登出</DangerButton>
      </Card>
    </Container>
  );
});
