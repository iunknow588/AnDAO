/**
 * 密码输入组件
 * 
 * 用于在需要私钥时提示用户输入密码
 * 监听 wallet:request-password 事件，显示密码输入对话框
 * 
 * @module components/PasswordInput
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import styled from 'styled-components';

/**
 * 密码请求事件详情
 */
interface PasswordRequestDetail {
  requestId: string;
  address: string;
  purpose: string; // 用途说明，如 'sign_transaction', 'unlock_wallet' 等
}

/**
 * 密码输入组件属性
 */
export interface PasswordInputProps {
  /**
   * 是否自动监听事件（默认true）
   * 如果为false，需要手动调用show方法
   */
  autoListen?: boolean;
}

const PasswordForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const PurposeText = styled.p`
  margin: 0;
  font-size: 14px;
  color: #868e96;
  line-height: 1.5;
`;

const ErrorMessage = styled.div`
  padding: 12px;
  background: #fff5f5;
  border: 1px solid #ffc9c9;
  border-radius: 8px;
  color: #e03131;
  font-size: 14px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

/**
 * 密码输入组件
 * 
 * 功能：
 * 1. 监听 wallet:request-password 事件
 * 2. 显示密码输入对话框
 * 3. 验证密码（可选）
 * 4. 触发 wallet:password-input 或 wallet:password-cancel 事件
 */
export const PasswordInput: React.FC<PasswordInputProps> = ({ autoListen = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentRequest, setCurrentRequest] = useState<PasswordRequestDetail | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * 显示密码输入对话框
   */
  const show = (request: PasswordRequestDetail) => {
    setCurrentRequest(request);
    setPassword('');
    setError(null);
    setIsOpen(true);
  };

  /**
   * 关闭对话框
   */
  const close = () => {
    if (currentRequest && !isSubmitting) {
      // 触发取消事件
      window.dispatchEvent(
        new CustomEvent('wallet:password-cancel', {
          detail: {
            requestId: currentRequest.requestId,
          },
        })
      );
    }
    setIsOpen(false);
    setCurrentRequest(null);
    setPassword('');
    setError(null);
  };

  /**
   * 提交密码
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentRequest) {
      return;
    }

    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 触发密码输入完成事件
      window.dispatchEvent(
        new CustomEvent('wallet:password-input', {
          detail: {
            requestId: currentRequest.requestId,
            password: password.trim(),
          },
        })
      );

      // 关闭对话框
      setIsOpen(false);
      setCurrentRequest(null);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 监听密码请求事件
   */
  useEffect(() => {
    if (!autoListen) {
      return;
    }

    const handlePasswordRequest = (event: CustomEvent<PasswordRequestDetail>) => {
      show(event.detail);
    };

    window.addEventListener('wallet:request-password', handlePasswordRequest as EventListener);

    return () => {
      window.removeEventListener('wallet:request-password', handlePasswordRequest as EventListener);
    };
  }, [autoListen]);

  /**
   * 处理ESC键关闭
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
    // close 依赖包含 currentRequest，若加入依赖将导致每次请求变更都重复绑定事件
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 生成用途说明文本
  const getPurposeText = (purpose: string): string => {
    const purposeMap: Record<string, string> = {
      sign_transaction: '需要密码以签名交易',
      sign_message: '需要密码以签名消息',
      unlock_wallet: '需要密码以解锁钱包',
      export_private_key: '需要密码以导出私钥',
      change_password: '需要密码以修改密码',
    };
    return purposeMap[purpose] || '需要密码以继续操作';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="输入密码"
      size="small"
    >
      <PasswordForm onSubmit={handleSubmit}>
        {currentRequest && (
          <PurposeText>
            {getPurposeText(currentRequest.purpose)}
            {currentRequest.address && (
              <>
                <br />
                <strong>地址:</strong> {currentRequest.address.slice(0, 6)}...{currentRequest.address.slice(-4)}
              </>
            )}
          </PurposeText>
        )}

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <Input
          type="password"
          label="密码"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          placeholder="请输入密码"
          autoFocus
          disabled={isSubmitting}
          error={error || undefined}
        />

        <ButtonGroup>
          <Button
            type="button"
            variant="secondary"
            onClick={close}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !password.trim()}
          >
            {isSubmitting ? '验证中...' : '确认'}
          </Button>
        </ButtonGroup>
      </PasswordForm>
    </Modal>
  );
};

/**
 * 导出单例组件（用于全局使用）
 */
export const PasswordInputProvider: React.FC = () => {
  return <PasswordInput autoListen={true} />;
};
