/**
 * 密码验证工具
 * 
 * 提供密码强度验证和提示功能
 */

/**
 * 密码验证结果
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  strengthScore: number; // 0-100
}

/**
 * 密码验证规则配置
 */
export interface PasswordRules {
  minLength: number; // 最小长度（默认8）
  maxLength: number; // 最大长度（默认128）
  requireUppercase: boolean; // 是否需要大写字母（默认false，建议）
  requireLowercase: boolean; // 是否需要小写字母（默认false，建议）
  requireNumbers: boolean; // 是否需要数字（默认false，建议）
  requireSpecialChars: boolean; // 是否需要特殊字符（默认false，建议）
  forbiddenChars?: string[]; // 禁止使用的字符（控制字符等）
  allowedSpecialChars?: string; // 允许的特殊字符（默认：!@#$%^&*()_+-=[]{}|;:,.<>?~`）
}

/**
 * 默认密码规则
 */
const DEFAULT_RULES: PasswordRules = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: false, // 建议但不强制
  requireLowercase: false, // 建议但不强制
  requireNumbers: false, // 建议但不强制
  requireSpecialChars: false, // 建议但不强制
  // 禁止使用控制字符（0x00-0x1F, 0x7F）和一些问题字符
  forbiddenChars: [],
  // 允许的常见特殊字符
  allowedSpecialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?~`',
};

/**
 * 验证密码
 * 
 * @param password 密码
 * @param rules 验证规则（可选，使用默认规则）
 * @returns 验证结果
 */
export function validatePassword(
  password: string,
  rules: Partial<PasswordRules> = {}
): PasswordValidationResult {
  const config = { ...DEFAULT_RULES, ...rules };
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 检查长度
  if (password.length < config.minLength) {
    errors.push(`密码长度至少需要 ${config.minLength} 个字符`);
  }
  
  if (password.length > config.maxLength) {
    errors.push(`密码长度不能超过 ${config.maxLength} 个字符`);
  }
  
  // 检查禁止的字符（控制字符等）
  const hasControlChars = Array.from(password).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (hasControlChars) {
    errors.push('密码不能包含控制字符');
  }
  
  // 检查必需字符类型（如果配置为必需）
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChars = new RegExp(`[${config.allowedSpecialChars!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`).test(password);
  
  if (config.requireUppercase && !hasUppercase) {
    errors.push('密码必须包含至少一个大写字母');
  }
  
  if (config.requireLowercase && !hasLowercase) {
    errors.push('密码必须包含至少一个小写字母');
  }
  
  if (config.requireNumbers && !hasNumbers) {
    errors.push('密码必须包含至少一个数字');
  }
  
  if (config.requireSpecialChars && !hasSpecialChars) {
    errors.push(`密码必须包含至少一个特殊字符（${config.allowedSpecialChars}）`);
  }
  
  // 建议但不强制：密码强度提示
  if (!config.requireUppercase && !hasUppercase && password.length > 0) {
    warnings.push('建议包含大写字母以提高安全性');
  }
  
  if (!config.requireLowercase && !hasLowercase && password.length > 0) {
    warnings.push('建议包含小写字母以提高安全性');
  }
  
  if (!config.requireNumbers && !hasNumbers && password.length > 0) {
    warnings.push('建议包含数字以提高安全性');
  }
  
  if (!config.requireSpecialChars && !hasSpecialChars && password.length > 0) {
    warnings.push(`建议包含特殊字符（${config.allowedSpecialChars}）以提高安全性`);
  }
  
  // 计算密码强度
  let strengthScore = 0;
  
  // 长度得分（0-30分）
  if (password.length >= config.minLength) {
    strengthScore += 10;
  }
  if (password.length >= 12) {
    strengthScore += 10;
  }
  if (password.length >= 16) {
    strengthScore += 10;
  }
  
  // 字符类型得分（0-40分）
  const typeCount = [hasUppercase, hasLowercase, hasNumbers, hasSpecialChars].filter(Boolean).length;
  strengthScore += typeCount * 10;
  
  // 复杂度得分（0-30分）
  // 检查是否有重复字符模式
  const hasRepeatingChars = /(.)\1{2,}/.test(password);
  if (!hasRepeatingChars) {
    strengthScore += 10;
  }
  
  // 检查是否有常见模式（如 "123", "abc"）
  const hasCommonPattern = /123|abc|qwe|asd|password|admin/i.test(password);
  if (!hasCommonPattern) {
    strengthScore += 10;
  }
  
  // 检查字符多样性
  const uniqueChars = new Set(password).size;
  const diversityRatio = uniqueChars / password.length;
  if (diversityRatio > 0.7) {
    strengthScore += 10;
  }
  
  // 确定强度等级
  let strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  if (strengthScore < 40) {
    strength = 'weak';
  } else if (strengthScore < 60) {
    strength = 'medium';
  } else if (strengthScore < 80) {
    strength = 'strong';
  } else {
    strength = 'very-strong';
  }
  
  const isValid = errors.length === 0;
  
  return {
    isValid,
    errors,
    warnings,
    strength,
    strengthScore: Math.min(strengthScore, 100),
  };
}

/**
 * 获取密码强度提示文本
 */
export function getPasswordStrengthText(strength: PasswordValidationResult['strength']): string {
  switch (strength) {
    case 'weak':
      return '密码强度：弱';
    case 'medium':
      return '密码强度：中等';
    case 'strong':
      return '密码强度：强';
    case 'very-strong':
      return '密码强度：非常强';
    default:
      return '';
  }
}

/**
 * 获取密码强度颜色
 */
export function getPasswordStrengthColor(strength: PasswordValidationResult['strength']): string {
  switch (strength) {
    case 'weak':
      return '#e03131'; // 红色
    case 'medium':
      return '#f59f00'; // 橙色
    case 'strong':
      return '#4c6ef5'; // 蓝色
    case 'very-strong':
      return '#37b24d'; // 绿色
    default:
      return '#868e96'; // 灰色
  }
}

/**
 * 获取密码要求提示文本
 */
export function getPasswordRequirementsText(rules: Partial<PasswordRules> = {}): string {
  const config = { ...DEFAULT_RULES, ...rules };
  const requirements: string[] = [];
  
  requirements.push(`至少 ${config.minLength} 个字符`);
  
  if (config.requireUppercase) {
    requirements.push('包含大写字母');
  }
  if (config.requireLowercase) {
    requirements.push('包含小写字母');
  }
  if (config.requireNumbers) {
    requirements.push('包含数字');
  }
  if (config.requireSpecialChars) {
    requirements.push(`包含特殊字符（${config.allowedSpecialChars}）`);
  }
  
  if (requirements.length === 1) {
    return `密码要求：${requirements[0]}`;
  }
  
  return `密码要求：${requirements.join('、')}`;
}

/**
 * 获取密码建议文本
 */
export function getPasswordSuggestionsText(): string {
  return `密码建议：
• 使用8-128个字符
• 组合使用大小写字母、数字和特殊字符（!@#$%^&*()_+-=[]{}|;:,.<>?~\`）
• 避免使用常见的单词或模式（如 "123"、"password"）
• 不要使用个人信息（如姓名、生日）
• 定期更换密码`;
}
