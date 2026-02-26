/**
 * 密码输入字段组件
 * 
 * 增强的密码输入组件，包含：
 * - 显示/隐藏密码功能
 * - 实时密码验证
 * - 密码强度指示器
 * - 密码要求提示
 */

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Input } from '../Input/Input';
import {
  validatePassword,
  getPasswordStrengthText,
  getPasswordStrengthColor,
  getPasswordRequirementsText,
  type PasswordRules,
} from '@/utils/passwordValidation';

export interface PasswordInputFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, errors: string[], warnings: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  showRequirements?: boolean; // 是否显示密码要求提示
  showStrength?: boolean; // 是否显示密码强度指示器
  rules?: Partial<PasswordRules>; // 密码验证规则
  error?: string; // 外部错误（例如：两次密码不一致）
  helperText?: string;
}

const PasswordWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

const RequirementsText = styled.div`
  font-size: 12px;
  color: #868e96;
  margin-top: 4px;
  line-height: 1.5;
`;

const StrengthIndicator = styled.div<{ strength: string; strengthColor: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: ${props => props.strengthColor};
  font-weight: 500;
`;

const StrengthBar = styled.div<{ score: number; color: string }>`
  flex: 1;
  height: 4px;
  background: #e9ecef;
  border-radius: 2px;
  overflow: hidden;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: ${props => props.score}%;
    background: ${props => props.color};
    transition: width 0.3s ease, background-color 0.3s ease;
  }
`;

const WarningsList = styled.ul`
  margin: 4px 0 0 0;
  padding-left: 16px;
  font-size: 12px;
  color: #f59f00;
  list-style-type: disc;
  
  li {
    margin: 2px 0;
  }
`;

export const PasswordInputField: React.FC<PasswordInputFieldProps> = ({
  label = '密码',
  value,
  onChange,
  onValidationChange,
  placeholder = '请输入密码',
  disabled = false,
  autoFocus = false,
  autoComplete = 'new-password',
  showRequirements = true,
  showStrength = true,
  rules = {},
  error: externalError,
  helperText,
}) => {
  const [localError, setLocalError] = useState<string>('');
  
  // 实时验证密码
  const validation = useMemo(() => {
    if (!value) {
      return {
        isValid: true, // 空值时不显示错误
        errors: [],
        warnings: [],
        strength: 'weak' as const,
        strengthScore: 0,
      };
    }
    return validatePassword(value, rules);
  }, [value, rules]);
  
  // 更新外部验证状态
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(validation.isValid, validation.errors, validation.warnings);
    }
  }, [validation.isValid, validation.errors, validation.warnings, onValidationChange]);
  
  // 处理输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // 清除本地错误（如果有外部验证）
    if (localError && !externalError) {
      setLocalError('');
    }
  };
  
  // 决定显示哪个错误
  const displayError = externalError || (value ? validation.errors[0] : '') || localError;
  
  // 决定是否显示警告（只有在没有错误且密码不为空时显示）
  const shouldShowWarnings = value && validation.isValid && validation.warnings.length > 0;
  
  return (
    <PasswordWrapper>
      <Input
        label={label}
        type="password"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        error={displayError}
        helperText={helperText}
      />
      
      {showRequirements && (
        <RequirementsText>
          {getPasswordRequirementsText(rules)}
          <br />
          {'允许的特殊字符：!@#$%^&*()_+-=[]{}|;:,.<>?~`'}
        </RequirementsText>
      )}
      
      {showStrength && value && (
        <StrengthIndicator
          strength={validation.strength}
          strengthColor={getPasswordStrengthColor(validation.strength)}
        >
          <StrengthBar
            score={validation.strengthScore}
            color={getPasswordStrengthColor(validation.strength)}
          />
          <span>{getPasswordStrengthText(validation.strength)}</span>
        </StrengthIndicator>
      )}
      
      {shouldShowWarnings && (
        <WarningsList>
          {validation.warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </WarningsList>
      )}
    </PasswordWrapper>
  );
};
