/**
 * AccountManager 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountManager } from '../AccountManager';
import { storageAdapter } from '@/adapters/StorageAdapter';
import { StorageKey } from '@/types';
import type { Address } from 'viem';

// Mock viem before模块加载，避免 hoist 变量未定义问题
vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    createPublicClient: vi.fn().mockReturnValue({
      getBytecode: vi.fn().mockResolvedValue('0x1234'),
    }),
    http: vi.fn(),
  };
});

// Mock kernel utils
vi.mock('@/utils/kernel', () => ({
  predictAccountAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890' as Address),
  createAccount: vi.fn().mockResolvedValue({
    address: '0x1234567890123456789012345678901234567890' as Address,
    txHash: '0x' + '11'.repeat(32),
  }),
}));

// Mock storage adapter
vi.mock('@/adapters/StorageAdapter', () => ({
  storageAdapter: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Mock chain config
vi.mock('@/config/chains', () => ({
  getChainConfigByChainId: vi.fn().mockReturnValue({
    chainId: 5000,
    name: 'Mantle',
    rpcUrl: 'https://rpc.mantle.xyz',
    bundlerUrl: 'https://bundler.mantle.xyz',
    kernelFactoryAddress: '0x0000000000000000000000000000000000000001',
    entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    multiChainValidatorAddress: '0x0000000000000000000000000000000000000002',
    nativeCurrency: {
      name: 'Mantle',
      symbol: 'MNT',
      decimals: 18,
    },
  }),
}));

describe('AccountManager', () => {
  let accountManager: AccountManager;

  beforeEach(() => {
    accountManager = new AccountManager();
    vi.clearAllMocks();
  });

  describe('init', () => {
    it('应该从存储加载账户列表', async () => {
      const mockAccounts = [
        {
          address: '0x1234567890123456789012345678901234567890',
          chainId: 5000,
          owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          createdAt: Date.now(),
          status: 'deployed' as const,
          deployedAt: Date.now(),
        },
      ];

      vi.mocked(storageAdapter.get).mockResolvedValue(mockAccounts);

      await accountManager.init();

      const allAccounts = await accountManager.getAllAccounts();
      expect(allAccounts).toHaveLength(1);
      expect(allAccounts[0].address).toBe(mockAccounts[0].address);
    });

    it('应该处理空存储', async () => {
      vi.mocked(storageAdapter.get).mockResolvedValue(null);

      await accountManager.init();

      const allAccounts = await accountManager.getAllAccounts();
      expect(allAccounts).toHaveLength(0);
    });
  });

  describe('predictAccountAddress', () => {
    it('应该预测账户地址（不保存）', async () => {
      const owner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      const chainId = 5000;

      const address = await accountManager.predictAccountAddress(owner, chainId);

      expect(address).toBeDefined();
      expect(address).toMatch(/^0x/);
      // 预测地址不应该保存到存储
      expect(vi.mocked(storageAdapter.set)).not.toHaveBeenCalled();
    });
  });

  describe('createAndDeployAccount', () => {
    it('应该创建并部署账户', async () => {
      const owner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      const chainId = 5000;
      const signerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

      vi.mocked(storageAdapter.get).mockResolvedValue([]);
      vi.mocked(storageAdapter.set).mockResolvedValue();

      const address = await accountManager.createAndDeployAccount(owner, chainId, signerPrivateKey);

      expect(address).toBeDefined();
      expect(address).toMatch(/^0x/);
      expect(vi.mocked(storageAdapter.set)).toHaveBeenCalled();
    });

    it('应该保存账户状态为 deployed', async () => {
      const owner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      const chainId = 5000;
      const signerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

      vi.mocked(storageAdapter.get).mockResolvedValue([]);
      vi.mocked(storageAdapter.set).mockResolvedValue();

      await accountManager.createAndDeployAccount(owner, chainId, signerPrivateKey);

      // 验证保存的账户信息包含 status 字段
      const setCall = vi.mocked(storageAdapter.set).mock.calls.find(
        call => call[0] === StorageKey.ACCOUNTS
      );
      expect(setCall).toBeDefined();
      if (setCall) {
        const accounts = setCall[1] as any[];
        expect(accounts[0].status).toBe('deployed');
        expect(accounts[0].deployedAt).toBeDefined();
      }
    });
  });

  describe('createAccount', () => {
    it('应该调用 createAndDeployAccount（便捷方法）', async () => {
      const owner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      const chainId = 5000;
      const signerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

      vi.mocked(storageAdapter.get).mockResolvedValue([]);
      vi.mocked(storageAdapter.set).mockResolvedValue();

      const address = await accountManager.createAccount(owner, chainId, signerPrivateKey);

      expect(address).toBeDefined();
      expect(vi.mocked(storageAdapter.set)).toHaveBeenCalled();
    });
  });

  describe('getAccountAddress', () => {
    it('应该从已创建的账户中获取地址', async () => {
      const owner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      const chainId = 5000;
      const expectedAddress = '0x1234567890123456789012345678901234567890' as Address;

      const mockAccounts = [
        {
          address: expectedAddress,
          chainId,
          owner,
          createdAt: Date.now(),
          status: 'deployed' as const,
          deployedAt: Date.now(),
        },
      ];

      vi.mocked(storageAdapter.get).mockResolvedValue(mockAccounts);
      await accountManager.init();

      const address = await accountManager.getAccountAddress(owner, chainId);

      expect(address).toBe(expectedAddress);
    });

    it('应该预测未创建账户的地址', async () => {
      const owner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      const chainId = 5000;

      vi.mocked(storageAdapter.get).mockResolvedValue([]);
      await accountManager.init();

      const address = await accountManager.getAccountAddress(owner, chainId);

      expect(address).toBeDefined();
      expect(address).toMatch(/^0x/);
    });
  });

  describe('getAccount', () => {
    it('应该返回账户信息', async () => {
      const owner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      const chainId = 5000;
      const expectedAddress = '0x1234567890123456789012345678901234567890' as Address;

      const mockAccounts = [
        {
          address: expectedAddress,
          chainId,
          owner,
          createdAt: Date.now(),
          status: 'deployed' as const,
          deployedAt: Date.now(),
        },
      ];

      vi.mocked(storageAdapter.get).mockResolvedValue(mockAccounts);
      await accountManager.init();

      const account = await accountManager.getAccount(owner, chainId);

      expect(account).toBeDefined();
      expect(account?.address).toBe(expectedAddress);
      expect(account?.owner).toBe(owner);
    });

    it('应该返回 null 如果账户不存在', async () => {
      const owner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      const chainId = 5000;

      vi.mocked(storageAdapter.get).mockResolvedValue([]);
      await accountManager.init();

      const account = await accountManager.getAccount(owner, chainId);

      expect(account).toBeNull();
    });
  });

  describe('accountExists', () => {
    it('应该检查账户是否已部署', async () => {
      const address = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 5000;

      const exists = await accountManager.accountExists(address, chainId);

      expect(exists).toBe(true);
    });
  });
});

