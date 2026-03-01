import { parseUnits } from 'viem';

/**
 * 路径流程表单校验工具
 *
 * 为路径 A/B/C 共用的输入校验提供一致逻辑，减少页面内重复判断。
 */

/**
 * 校验密码与确认密码
 *
 * @returns 错误消息，校验通过返回 null
 */
export function validatePasswordPair(password: string, confirmPassword: string): string | null {
  const passwordError = validatePassword(password);
  if (passwordError) {
    return passwordError;
  }

  if (password !== confirmPassword) {
    return '两次输入的密码不一致';
  }

  return null;
}

/**
 * 规范化私钥输入（自动补全 0x 前缀）
 */
export function normalizePrivateKeyInput(privateKey: string): `0x${string}` {
  if (privateKey.startsWith('0x')) {
    return privateKey as `0x${string}`;
  }
  return `0x${privateKey}` as `0x${string}`;
}

/**
 * 校验单个密码（无确认密码）
 */
export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return '密码至少需要8个字符';
  }
  if (password.length > 128) {
    return '密码长度不能超过128个字符';
  }
  const hasControlChars = Array.from(password).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (hasControlChars) {
    return '密码不能包含控制字符';
  }
  return null;
}

/**
 * 校验私钥格式（64 字节 hex，支持有/无 0x 前缀输入）
 */
export function validatePrivateKeyFormat(privateKey: string, label: string): string | null {
  const normalized = normalizePrivateKeyInput(privateKey);
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    return `${label}格式错误，应为64字节十六进制字符串（可选0x前缀）`;
  }
  return null;
}

/**
 * 校验 EVM 地址格式
 */
export function validateEvmAddress(address: string, label: string = '地址'): string | null {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return `请输入有效的${label}`;
  }
  return null;
}

/**
 * 将用户输入的金额转换为最小单位
 */
export function parsePositiveAmountToUnits(
  amount: string,
  decimals: number,
  label: string = '金额'
): bigint {
  const normalizedAmount = amount.trim();
  if (!normalizedAmount) {
    throw new Error(`${label}不能为空`);
  }

  try {
    const units = parseUnits(normalizedAmount, decimals);
    if (units <= 0n) {
      throw new Error(`${label}必须大于0`);
    }
    return units;
  } catch (error) {
    if (error instanceof Error && error.message.includes(`${label}`)) {
      throw error;
    }
    throw new Error(`${label}格式不正确`);
  }
}
