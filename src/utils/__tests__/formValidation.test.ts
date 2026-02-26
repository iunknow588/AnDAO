import { describe, expect, it } from 'vitest';
import { trimInputFields, trimInputValue, validateRequiredFields } from '@/utils/formValidation';

describe('formValidation', () => {
  describe('trimInputValue', () => {
    it('should trim leading and trailing whitespace', () => {
      expect(trimInputValue('  abc  ')).toBe('abc');
    });
  });

  describe('trimInputFields', () => {
    it('should trim every field in object', () => {
      expect(
        trimInputFields({
          account: ' 0xabc ',
          chainId: '  5001  ',
        })
      ).toEqual({
        account: '0xabc',
        chainId: '5001',
      });
    });
  });

  describe('validateRequiredFields', () => {
    it('should return null when all fields have values', () => {
      expect(
        validateRequiredFields([
          { value: 'alice', label: '用户名' },
          { value: '12345678', label: '密码' },
        ])
      ).toBeNull();
    });

    it('should return label-based error when field is empty', () => {
      expect(
        validateRequiredFields([
          { value: 'alice', label: '用户名' },
          { value: '   ', label: '密码' },
        ])
      ).toBe('请输入密码');
    });

    it('should return fallback message when label is missing', () => {
      expect(validateRequiredFields([{ value: '' }], '请填写所有字段')).toBe('请填写所有字段');
    });
  });
});
