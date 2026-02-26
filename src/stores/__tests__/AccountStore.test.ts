/**
 * AccountStore 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { accountManager } from '@/services/AccountManager';
import { AccountInfo, SupportedChain } from '@/types';

// Mock AccountManager
vi.mock('@/services/AccountManager', () => ({
  accountManager: {
    init: vi.fn().mockResolvedValue(undefined),
    getAllAccounts: vi.fn().mockResolvedValue([]),
    createAndDeployAccount: vi.fn(),
    importAccount: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock chain config（保持与实际实现的类型一致）
vi.mock('@/config/chains', () => ({
  DEFAULT_CHAIN: SupportedChain.MANTLE,
  CHAIN_CONFIGS: {
    [SupportedChain.MANTLE]: { chainId: 5000 },
    [SupportedChain.INJECTIVE]: { chainId: 1776 },
    [SupportedChain.AVALANCHE]: { chainId: 43114 },
  },
  MANTLE_CHAIN: { chainId: 5000 },
  MANTLE_TESTNET_CHAIN: { chainId: 5003 },
  INJECTIVE_CHAIN: { chainId: 1776 },
  INJECTIVE_TESTNET_CHAIN: { chainId: 1439 },
  getChainConfig: vi.fn().mockImplementation((chain: SupportedChain) => {
    if (chain === SupportedChain.MANTLE) {
      return { chainId: 5000 };
    }
    if (chain === SupportedChain.INJECTIVE) {
      return { chainId: 1776 };
    }
    if (chain === SupportedChain.AVALANCHE) {
      return { chainId: 43114 };
    }
    return { chainId: 5000 };
  }),
  getSupportedChainByChainId: vi.fn().mockImplementation((chainId: number) => {
    if ([5000, 5003].includes(chainId)) return SupportedChain.MANTLE;
    if ([1776, 1439].includes(chainId)) return SupportedChain.INJECTIVE;
    if ([43114, 43113].includes(chainId)) return SupportedChain.AVALANCHE;
    return undefined;
  }),
  getChainConfigByChainId: vi.fn().mockImplementation((chainId: number) => {
    if ([5000, 5003].includes(chainId)) return { chainId };
    if ([1776, 1439].includes(chainId)) return { chainId };
    if ([43114, 43113].includes(chainId)) return { chainId };
    return undefined;
  }),
}));

describe('AccountStore', () => {
  let AccountStoreClass: typeof import('../AccountStore').AccountStore;
  let accountStore: import('../AccountStore').AccountStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    // 动态导入，确保 mocks 生效
    const mod = await import('../AccountStore');
    AccountStoreClass = mod.AccountStore;
    accountStore = new AccountStoreClass();
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

      vi.mocked(accountManager.createAndDeployAccount).mockResolvedValue(newAddress as `0x${string}`);
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

      // 使用深度相等判断，避免 MobX 包装导致引用不一致
      expect(accountStore.currentAccount).toStrictEqual(account);
      expect(accountStore.currentChain).toBe(SupportedChain.MANTLE);
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
        chainId: 1439,
        owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        createdAt: Date.now(),
        status: 'deployed' as const,
      };

      accountStore.accounts = [account1, account2];
      accountStore.setCurrentChain(1439);

      expect(accountStore.currentChain).toBe('injective');
      expect(accountStore.currentAccount?.chainId).toBe(1439);
    });
  });

  describe('getAccount', () => {
    it('同链族场景下，传入枚举值应优先匹配当前激活 network 的 chainId', () => {
      const mantleMainnet: AccountInfo = {
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        chainId: 5000,
        owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        createdAt: Date.now(),
      };

      const mantleTestnet: AccountInfo = {
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        chainId: 5003,
        owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        createdAt: Date.now(),
      };

      accountStore.accounts = [mantleMainnet, mantleTestnet];
      accountStore.currentChain = SupportedChain.MANTLE;
      accountStore.currentChainId = 5003;

      const account = accountStore.getAccount(SupportedChain.MANTLE);
      expect(account?.chainId).toBe(5003);
    });

    it('当前 chainId 为自定义链时，不应把枚举查询误映射到自定义链账户', () => {
      const mantleMainnet: AccountInfo = {
        address: '0xcccccccccccccccccccccccccccccccccccccccc',
        chainId: 5000,
        owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        createdAt: Date.now(),
      };

      const customChainAccount: AccountInfo = {
        address: '0xdddddddddddddddddddddddddddddddddddddddd',
        chainId: 999999,
        owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        createdAt: Date.now(),
      };

      accountStore.accounts = [mantleMainnet, customChainAccount];
      accountStore.currentChain = SupportedChain.MANTLE;
      accountStore.currentChainId = 999999;

      const account = accountStore.getAccount(SupportedChain.MANTLE);
      expect(account?.chainId).toBe(5000);
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

      // 第一次调用（init）返回空列表，第二次调用（addAccount 后）返回包含新账户的列表
      vi.mocked(accountManager.getAllAccounts)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([account]);

      await accountStore.init();
      await accountStore.addAccount(account);

      expect(accountStore.accounts).toStrictEqual([account]);
      expect(accountStore.currentAccount).toStrictEqual(account);
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
