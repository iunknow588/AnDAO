/**
 * 输入框组件
 * 
 * 参考 Keplr 钱包的输入框设计风格，但代码完全独立实现
 * 
 * 功能增强：
 * - 密码输入框支持显示/隐藏密码功能（眼睛图标按钮）
 */

import React, { useState } from 'react';
import styled from 'styled-components';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
`;

const InputContainer = styled.div`
  position: relative;
  width: 100%;
`;

const StyledInput = styled.input<{ $hasError?: boolean; $hasPasswordToggle?: boolean }>`
  width: 100%;
  padding: 12px ${(props) => (props.$hasPasswordToggle ? '48px' : '16px')} 12px 16px;
  border: 1px solid ${(props) => (props.$hasError ? '#e03131' : '#dee2e6')};
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  background: #ffffff;
  color: #1a1a1a;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: ${(props) => (props.$hasError ? '#e03131' : '#4c6ef5')};
    box-shadow: 0 0 0 3px ${(props) => (props.$hasError ? 'rgba(224, 49, 49, 0.1)' : 'rgba(76, 110, 245, 0.1)')};
  }

  &:disabled {
    background: #f1f3f5;
    color: #868e96;
    cursor: not-allowed;
  }

  &::placeholder {
    color: #868e96;
  }
`;

const PasswordToggleButton = styled.button`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #868e96;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
  
  &:hover {
    color: #4c6ef5;
  }
  
  &:focus {
    outline: none;
    color: #4c6ef5;
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const EyeIcon = styled.svg`
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
`;

const ErrorText = styled.span`
  font-size: 12px;
  color: #e03131;
`;

const HelperText = styled.span`
  font-size: 12px;
  color: #868e96;
`;

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  type,
  disabled,
  ...props
}) => {
  const isPassword = type === 'password';
  const [showPassword, setShowPassword] = useState(false);
  
  // 如果是密码输入框，根据showPassword状态切换type
  const inputType = isPassword && showPassword ? 'text' : type;
  
  const handleTogglePassword = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPassword(!showPassword);
  };

  return (
    <InputWrapper>
      {label && <Label>{label}</Label>}
      <InputContainer>
        <StyledInput
          $hasError={!!error}
          $hasPasswordToggle={isPassword}
          type={inputType}
          disabled={disabled}
          {...props}
        />
        {isPassword && (
          <PasswordToggleButton
            type="button"
            onClick={handleTogglePassword}
            disabled={disabled}
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeIcon viewBox="0 0 24 24">
                {/* 眼睛睁开图标 - 显示密码时显示带斜线的眼睛 */}
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </EyeIcon>
            ) : (
              <EyeIcon viewBox="0 0 24 24">
                {/* 眼睛图标 - 隐藏密码时显示普通眼睛 */}
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </EyeIcon>
            )}
          </PasswordToggleButton>
        )}
      </InputContainer>
      {error && <ErrorText>{error}</ErrorText>}
      {!error && helperText && <HelperText>{helperText}</HelperText>}
    </InputWrapper>
  );
};

