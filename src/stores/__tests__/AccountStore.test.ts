/**
 * AccountStore 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountStore } from '../AccountStore';
import { accountManager } from '@/services/AccountManager';
import { AccountInfo } from '@/types';

// Mock AccountManager
vi.mock('@/services/AccountManager', () => ({
  accountManager: {
    init: vi.fn().mockResolvedValue(undefined),
    getAllAccounts: vi.fn().mockResolvedValue([]),
    createAndDeployAccount: vi.fn(),
  },
}));

// Mock chain config
vi.mock('@/config/chains', () => ({
  DEFAULT_CHAIN: 'mantle',
}));

describe('AccountStore', () => {
  let accountStore: AccountStore;

  beforeEach(() => {
    accountStore = new AccountStore();
    vi.clearAllMocks();
  });

  describe('init', () => {
    it('应该初始化账户列表', async () => {
      const mockAccounts: AccountInfo[] = [
        {
          address: '0x1234567890123456789012345678901234567890',
          chainId: 5000,
          owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          createdAt: Date.now(),
        },
      ];

      vi.mocked(accountManager.getAllAccounts).mockResolvedValue(mockAccounts);

      await accountStore.init();

      expect(accountStore.accounts).toHaveLength(1);
      expect(accountStore.accounts[0].address).toBe(mockAccounts[0].address);
    });

    it('应该设置第一个账户为当前账户', async () => {
      const mockAccounts: AccountInfo[] = [
        {
          address: '0x1234567890123456789012345678901234567890',
          chainId: 5000,
          owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          createdAt: Date.now(),
        },
      ];

      vi.mocked(accountManager.getAllAccounts).mockResolvedValue(mockAccounts);

      await accountStore.init();

      expect(accountStore.currentAccount).toBeDefined();
      expect(accountStore.currentAccount?.address).toBe(mockAccounts[0].address);
    });
  });

  describe('createAccount', () => {
    it('应该创建新账户并添加到列表', async () => {
      const owner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const chainId = 5000;
      const signerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;
      const newAddress = '0x1234567890123456789012345678901234567890';

      const mockAccount: AccountInfo = {
        address: newAddress,
        chainId,
        owner,
        createdAt: Date.now(),
        status: 'deployed' as const,
        deployedAt: Date.now(),
      };

      vi.mocked(accountManager.createAndDeployAccount).mockResolvedValue(newAddress as any);
      vi.mocked(accountManager.getAllAccounts).mockResolvedValue([mockAccount]);

      await accountStore.init();
      await accountStore.createAccount(owner, chainId, signerPrivateKey);

      expect(accountStore.accounts).toHaveLength(1);
      expect(accountStore.currentAccount?.address).toBe(newAddress);
    });

    it('应该处理创建账户错误', async () => {
      const owner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const chainId = 5000;
      const signerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

      vi.mocked(accountManager.createAndDeployAccount).mockRejectedValue(new Error('Failed to create account'));
      vi.mocked(accountManager.getAllAccounts).mockResolvedValue([]);

      await accountStore.init();

      await expect(accountStore.createAccount(owner, chainId, signerPrivateKey)).rejects.toThrow();
      expect(accountStore.error).toBeDefined();
    });
  });

  describe('setCurrentAccount', () => {
    it('应该设置当前账户', () => {
      const account: AccountInfo = {
        address: '0x1234567890123456789012345678901234567890',
        chainId: 5000,
        owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        createdAt: Date.now(),
        status: 'deployed' as const,
        deployedAt: Date.now(),
      };

      accountStore.setCurrentAccount(account);

      expect(accountStore.currentAccount).toBe(account);
      expect(accountStore.currentChain).toBe(5000);
    });
  });

  describe('setCurrentChain', () => {
    it('应该切换链并更新当前账户', () => {
      const account1: AccountInfo = {
        address: '0x1111111111111111111111111111111111111111',
        chainId: 5000,
        owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        createdAt: Date.now(),
      };

      const account2: AccountInfo = {
        address: '0x2222222222222222222222222222222222222222',
        chainId: 888,
        owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        createdAt: Date.now(),
      };

      accountStore.accounts = [account1, account2];
      accountStore.setCurrentChain(888 as any);

      expect(accountStore.currentChain).toBe(888);
      expect(accountStore.currentAccount?.chainId).toBe(888);
    });
  });

  describe('addAccount', () => {
    it('应该添加账户到列表', async () => {
      const account: AccountInfo = {
        address: '0x1234567890123456789012345678901234567890',
        chainId: 5000,
        owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        createdAt: Date.now(),
        status: 'deployed' as const,
        deployedAt: Date.now(),
      };

      vi.mocked(accountManager.getAllAccounts).mockResolvedValue([]);

      await accountStore.init();
      await accountStore.addAccount(account);

      expect(accountStore.accounts).toContain(account);
      expect(accountStore.currentAccount).toBe(account);
    });

    it('应该拒绝添加重复账户', async () => {
      const account: AccountInfo = {
        address: '0x1234567890123456789012345678901234567890',
        chainId: 5000,
        owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        createdAt: Date.now(),
        status: 'deployed' as const,
        deployedAt: Date.now(),
      };

      accountStore.accounts = [account];
      vi.mocked(accountManager.getAllAccounts).mockResolvedValue([account]);

      await accountStore.init();

      await expect(accountStore.addAccount(account)).rejects.toThrow('Account already exists');
    });
  });

  describe('currentAccountAddress', () => {
    it('应该返回当前账户地址', () => {
      const account: AccountInfo = {
        address: '0x1234567890123456789012345678901234567890',
        chainId: 5000,
        owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        createdAt: Date.now(),
        status: 'deployed' as const,
        deployedAt: Date.now(),
      };

      accountStore.currentAccount = account;

      expect(accountStore.currentAccountAddress).toBe(account.address);
    });

    it('应该在没有当前账户时返回 null', () => {
      accountStore.currentAccount = null;

      expect(accountStore.currentAccountAddress).toBeNull();
    });
  });
});

