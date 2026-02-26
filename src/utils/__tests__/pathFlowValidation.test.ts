import { describe, expect, it } from 'vitest';
import {
  normalizePrivateKeyInput,
  parsePositiveAmountToUnits,
  validateEvmAddress,
  validatePassword,
  validatePasswordPair,
  validatePrivateKeyFormat,
} from '@/utils/pathFlowValidation';

describe('pathFlowValidation', () => {
  describe('validatePasswordPair', () => {
    it('should fail when password is too short', () => {
      expect(validatePasswordPair('1234567', '1234567')).toBe('密码至少需要8个字符');
    });

    it('should fail when password does not match confirm password', () => {
      expect(validatePasswordPair('12345678', '87654321')).toBe('两次输入的密码不一致');
    });

    it('should pass when password is valid and matched', () => {
      expect(validatePasswordPair('12345678', '12345678')).toBeNull();
    });
  });

  describe('normalizePrivateKeyInput', () => {
    it('should keep 0x-prefixed private key unchanged', () => {
      const key = '0x' + '1'.repeat(64);
      expect(normalizePrivateKeyInput(key)).toBe(key);
    });

    it('should add 0x prefix to plain hex private key', () => {
      const key = '2'.repeat(64);
      expect(normalizePrivateKeyInput(key)).toBe(`0x${key}`);
    });
  });

  describe('validatePassword', () => {
    it('should fail when password is too short', () => {
      expect(validatePassword('1234567')).toBe('密码至少需要8个字符');
    });

    it('should pass when password length is valid', () => {
      expect(validatePassword('12345678')).toBeNull();
    });
  });

  describe('validatePrivateKeyFormat', () => {
    it('should pass for valid private key with 0x prefix', () => {
      expect(validatePrivateKeyFormat(`0x${'a'.repeat(64)}`, 'EOA私钥')).toBeNull();
    });

    it('should pass for valid private key without 0x prefix', () => {
      expect(validatePrivateKeyFormat('b'.repeat(64), 'Gas账户私钥')).toBeNull();
    });

    it('should fail for invalid private key length', () => {
      expect(validatePrivateKeyFormat('1234', 'EOA私钥')).toContain('EOA私钥格式错误');
    });
  });

  describe('validateEvmAddress', () => {
    it('should pass for valid address', () => {
      expect(validateEvmAddress(`0x${'a'.repeat(40)}`)).toBeNull();
    });

    it('should fail for invalid address', () => {
      expect(validateEvmAddress('0x1234', '账户地址')).toBe('请输入有效的账户地址');
    });
  });

  describe('parsePositiveAmountToUnits', () => {
    it('should parse amount to units', () => {
      expect(parsePositiveAmountToUnits('1.5', 18)).toBe(1500000000000000000n);
    });

    it('should fail for zero amount', () => {
      expect(() => parsePositiveAmountToUnits('0', 18)).toThrow('金额必须大于0');
    });

    it('should fail for invalid amount', () => {
      expect(() => parsePositiveAmountToUnits('abc', 18, '转账金额')).toThrow('转账金额格式不正确');
    });
  });
});
