/**
 * 按钮组件
 * 
 * 参考 Keplr 钱包的按钮设计风格，但代码完全独立实现
 */

import React from 'react';
import styled from 'styled-components';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

const StyledButton = styled.button<ButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;

  ${(props) => {
    switch (props.variant) {
      case 'primary':
        return `
          background: #4c6ef5;
          color: #ffffff;
          &:hover:not(:disabled) {
            background: #3b5bdb;
          }
        `;
      case 'secondary':
        return `
          background: #f1f3f5;
          color: #1a1a1a;
          &:hover:not(:disabled) {
            background: #e9ecef;
          }
        `;
      case 'danger':
        return `
          background: #e03131;
          color: #ffffff;
          &:hover:not(:disabled) {
            background: #c92a2a;
          }
        `;
      default:
        return `
          background: #4c6ef5;
          color: #ffffff;
          &:hover:not(:disabled) {
            background: #3b5bdb;
          }
        `;
    }
  }}

  ${(props) => {
    switch (props.size) {
      case 'small':
        return `
          padding: 8px 16px;
          font-size: 14px;
        `;
      case 'large':
        return `
          padding: 16px 32px;
          font-size: 18px;
        `;
      default:
        return `
          padding: 12px 24px;
          font-size: 16px;
        `;
    }
  }}

  ${(props) => props.fullWidth && 'width: 100%;'}

  &:disabled {
    background: #ccc;
    color: #666;
    cursor: not-allowed;
  }

  &:focus {
    outline: 2px solid #4c6ef5;
    outline-offset: 2px;
  }
`;

export const Button: React.FC<ButtonProps> = ({ children, ...props }) => {
  return <StyledButton {...props}>{children}</StyledButton>;
};

