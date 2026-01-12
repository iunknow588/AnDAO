/**
 * KeyManagerService 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeyManagerService } from '../KeyManagerService';
import { securityVault } from '../SecurityVault';
import { authService } from '../AuthService';
import type { Address, Hex } from 'viem';

// Mock security vault
vi.mock('../SecurityVault', () => ({
  securityVault: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Mock auth service
vi.mock('../AuthService', () => ({
  authService: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    getSession: vi.fn().mockReturnValue({
      userId: 'test',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    }),
  },
}));

// Mock viem
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn().mockReturnValue({
    address: '0x1234567890123456789012345678901234567890',
  }),
  generatePrivateKey: vi.fn().mockReturnValue('0x1234567890123456789012345678901234567890123456789012345678901234'),
}));

describe('KeyManagerService', () => {
  let keyManagerService: KeyManagerService;
  const testPassword = 'test-password-123';

  beforeEach(() => {
    keyManagerService = new KeyManagerService();
    vi.clearAllMocks();
  });

  describe('savePrivateKey', () => {
    it('应该保存私钥到安全存储', async () => {
      const address = '0x1234567890123456789012345678901234567890' as Address;
      const privateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as Hex;

      vi.mocked(securityVault.setItem).mockResolvedValue();

      await keyManagerService.savePrivateKey(address, privateKey, testPassword);

      expect(securityVault.setItem).toHaveBeenCalled();
    });
  });

  describe('getPrivateKey', () => {
    it('应该从安全存储获取私钥', async () => {
      const address = '0x1234567890123456789012345678901234567890' as Address;
      const privateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as Hex;

      vi.mocked(securityVault.getItem).mockResolvedValue({
        address,
        privateKey,
        createdAt: Date.now(),
      });

      const retrieved = await keyManagerService.getPrivateKey(address, testPassword);

      expect(retrieved).toBe(privateKey);
    });

    it('应该在未认证时抛出错误', async () => {
      const address = '0x1234567890123456789012345678901234567890' as Address;

      vi.mocked(authService.isAuthenticated).mockReturnValue(false);

      await expect(keyManagerService.getPrivateKey(address, testPassword)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('应该在私钥不存在时返回 null', async () => {
      const address = '0x1234567890123456789012345678901234567890' as Address;

      vi.mocked(securityVault.getItem).mockResolvedValue(null);

      const retrieved = await keyManagerService.getPrivateKey(address, testPassword);

      expect(retrieved).toBeNull();
    });
  });

  describe('generatePrivateKey', () => {
    it('应该生成新的私钥和地址', async () => {
      const result = await keyManagerService.generatePrivateKey();

      expect(result.privateKey).toBeDefined();
      expect(result.address).toBeDefined();
      expect(result.privateKey).toMatch(/^0x/);
      expect(result.address).toMatch(/^0x/);
    });
  });

  describe('getAddressFromPrivateKey', () => {
    it('应该从私钥获取地址', () => {
      const privateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as Hex;

      const address = keyManagerService.getAddressFromPrivateKey(privateKey);

      expect(address).toBeDefined();
      expect(address).toMatch(/^0x/);
    });
  });

  describe('removePrivateKey', () => {
    it('应该删除私钥', async () => {
      const address = '0x1234567890123456789012345678901234567890' as Address;

      vi.mocked(securityVault.removeItem).mockResolvedValue();

      await keyManagerService.removePrivateKey(address);

      expect(securityVault.removeItem).toHaveBeenCalled();
    });
  });
});

