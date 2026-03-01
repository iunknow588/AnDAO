/**
 * 解锁钱包页面
 * 
 * 用户输入密码解锁钱包
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/AuthService';
import { validatePasswordPair } from '@/utils/pathFlowValidation';

const Container = styled.div`
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #1a1a1a;
  text-align: center;
`;

const Subtitle = styled.p`
  color: #666;
  font-size: 14px;
  margin-bottom: 24px;
  text-align: center;
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
  text-align: center;
`;

const SecurityNotice = styled.div`
  border: 1px solid #ffd8a8;
  background: #fff4e6;
  color: #8f4e00;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 1.5;
`;

export const UnlockWalletPage = observer(() => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    // 如果已经登录，跳转到首页
    if (authService.isAuthenticated()) {
      navigate('/');
      return;
    }

    // 检查是否是首次登录
    authService.isFirstLogin().then(setIsFirstLogin);
  }, [navigate]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('请输入密码');
      return;
    }

    // 首次登录需要确认密码
    if (isFirstLogin) {
      if (!confirmPassword) {
        setError('请确认密码');
        return;
      }
      const passwordError = validatePasswordPair(password, confirmPassword);
      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    setIsUnlocking(true);
    setError(null);

    try {
      let success: boolean;
      
      if (isFirstLogin) {
        // 首次登录，创建密码
        success = await authService.firstLogin(password);
      } else {
        // 常规登录，验证密码
        success = await authService.login(password);
      }

      if (success) {
        navigate('/');
      } else {
        setError(isFirstLogin ? '创建密码失败' : '密码错误');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '解锁钱包失败');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <Container>
      <Card>
        <Title>{isFirstLogin ? '创建密码' : '解锁钱包'}</Title>
        <Subtitle>
          {isFirstLogin 
            ? '请设置您的钱包密码（用于加密存储私钥）'
            : '请输入您的密码以解锁钱包'}
        </Subtitle>
        {isFirstLogin && (
          <SecurityNotice>
            重要提醒：请妥善保管密码与私钥。不要截图、不要通过聊天工具发送、不要透露给任何人。
          </SecurityNotice>
        )}

        <form onSubmit={handleUnlock}>
          <Input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isUnlocking}
            autoFocus
          />

          {isFirstLogin && (
            <Input
              type="password"
              placeholder="确认密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isUnlocking}
            />
          )}

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <Button 
            type="submit" 
            disabled={isUnlocking || !password || (isFirstLogin && !confirmPassword)}
          >
            {isUnlocking 
              ? (isFirstLogin ? '创建中...' : '解锁中...')
              : (isFirstLogin ? '创建密码' : '解锁')}
          </Button>
        </form>
      </Card>
    </Container>
  );
});
