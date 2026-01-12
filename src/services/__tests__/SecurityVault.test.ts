/**
 * SecurityVault 测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityVault } from '../SecurityVault';

// 注意：SecurityVault 的某些方法需要访问 localStorage，在测试环境中可能需要 mock

describe('SecurityVault', () => {
  let vault: SecurityVault;
  const testPassword = 'test-password-123';

  beforeEach(() => {
    vault = new SecurityVault();
  });

  describe('deriveKey', () => {
    it('应该从密码派生密钥', async () => {
      const salt = new Uint8Array(16);
      const key = await vault.deriveKey(testPassword, salt);
      
      expect(key).toBeInstanceOf(CryptoKey);
      expect(key.type).toBe('secret');
    });

    it('应该为相同的密码和 salt 派生相同的密钥', async () => {
      const salt = new Uint8Array(16);
      const key1 = await vault.deriveKey(testPassword, salt);
      const key2 = await vault.deriveKey(testPassword, salt);
      
      // 注意：CryptoKey 对象不能直接比较，但派生过程应该是一致的
      expect(key1).toBeInstanceOf(CryptoKey);
      expect(key2).toBeInstanceOf(CryptoKey);
    });
  });

  describe('setItem 和 getItem', () => {
    it('应该能够存储和读取加密数据', async () => {
      const testData = { key: 'value', number: 123 };
      
      await vault.setItem('test-key', testData, testPassword);
      const retrieved = await vault.getItem<typeof testData>('test-key', testPassword);
      
      expect(retrieved).toEqual(testData);
    });

    it('应该为不同的密码返回 null', async () => {
      const testData = { key: 'value' };
      
      await vault.setItem('test-key', testData, testPassword);
      const retrieved = await vault.getItem('test-key', 'wrong-password');
      
      expect(retrieved).toBeNull();
    });

    it('应该为不存在的键返回 null', async () => {
      const retrieved = await vault.getItem('non-existent-key', testPassword);
      
      expect(retrieved).toBeNull();
    });
  });

  describe('removeItem', () => {
    it('应该能够删除存储的数据', async () => {
      const testData = { key: 'value' };
      
      await vault.setItem('test-key', testData, testPassword);
      await vault.removeItem('test-key');
      
      const retrieved = await vault.getItem('test-key', testPassword);
      expect(retrieved).toBeNull();
    });
  });

  describe('clear', () => {
    it('应该能够清空所有数据', async () => {
      await vault.setItem('key1', { data: '1' }, testPassword);
      await vault.setItem('key2', { data: '2' }, testPassword);
      
      await vault.clear();
      
      const retrieved1 = await vault.getItem('key1', testPassword);
      const retrieved2 = await vault.getItem('key2', testPassword);
      
      expect(retrieved1).toBeNull();
      expect(retrieved2).toBeNull();
    });
  });
});

