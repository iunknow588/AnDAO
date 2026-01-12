/**
 * 卡片组件
 * 
 * 参考 Keplr 钱包的卡片设计风格，但代码完全独立实现
 */

import React from 'react';
import styled from 'styled-components';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'small' | 'medium' | 'large';
}

const StyledCard = styled.div<CardProps>`
  background: #ffffff;
  border-radius: 12px;
  transition: all 0.2s;

  ${(props) => {
    switch (props.variant) {
      case 'outlined':
        return `
          border: 1px solid #dee2e6;
        `;
      case 'elevated':
        return `
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        `;
      default:
        return `
          border: 1px solid #e9ecef;
        `;
    }
  }}

  ${(props) => {
    switch (props.padding) {
      case 'none':
        return 'padding: 0;';
      case 'small':
        return 'padding: 12px;';
      case 'large':
        return 'padding: 24px;';
      default:
        return 'padding: 16px;';
    }
  }}
`;

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'medium',
  children,
  ...props
}) => {
  return (
    <StyledCard variant={variant} padding={padding} {...props}>
      {children}
    </StyledCard>
  );
};

