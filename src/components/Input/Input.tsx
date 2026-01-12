/**
 * 输入框组件
 * 
 * 参考 Keplr 钱包的输入框设计风格，但代码完全独立实现
 */

import React from 'react';
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

const StyledInput = styled.input<{ hasError?: boolean }>`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid ${(props) => (props.hasError ? '#e03131' : '#dee2e6')};
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  background: #ffffff;
  color: #1a1a1a;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: ${(props) => (props.hasError ? '#e03131' : '#4c6ef5')};
    box-shadow: 0 0 0 3px ${(props) => (props.hasError ? 'rgba(224, 49, 49, 0.1)' : 'rgba(76, 110, 245, 0.1)')};
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
  ...props
}) => {
  return (
    <InputWrapper>
      {label && <Label>{label}</Label>}
      <StyledInput hasError={!!error} {...props} />
      {error && <ErrorText>{error}</ErrorText>}
      {!error && helperText && <HelperText>{helperText}</HelperText>}
    </InputWrapper>
  );
};

