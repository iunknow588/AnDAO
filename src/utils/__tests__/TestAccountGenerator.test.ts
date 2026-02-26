/**
 * TestAccountGenerator 单元测试
 * 
 * 测试测试账号生成工具的各种功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestAccountGenerator, testAccountGenerator } from '../TestAccountGenerator';
import { accountManager } from '@/services/AccountManager';
import type { Address } from 'viem';

// Mock AccountManager
vi.mock('@/services/AccountManager', () => ({
  accountManager: {
    predictAccountAddress: vi.fn(),
  },
}));
vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('TestAccountGenerator', () => {
  let generator: TestAccountGenerator;
  let mockAccountManager: {
    predictAccountAddress: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // 重置 mock
    vi.clearAllMocks();
    
    mockAccountManager = accountManager as unknown as {
      predictAccountAddress: ReturnType<typeof vi.fn>;
    };
    
    generator = new TestAccountGenerator();
  });

  describe('generateEOA', () => {
    it('应该生成有效的EOA账户（不带种子）', () => {
      const eoa = generator.generateEOA();
      
      expect(eoa.address).toBeDefined();
      expect(eoa.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(eoa.privateKey).toBeDefined();
      expect(eoa.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('应该生成确定性EOA账户（带种子）', () => {
      const seed = 'test-seed-123';
      const eoa1 = generator.generateEOA(seed);
      const eoa2 = generator.generateEOA(seed);
      
      // 使用相同种子应该生成相同的地址和私钥
      expect(eoa1.address).toBe(eoa2.address);
      expect(eoa1.privateKey).toBe(eoa2.privateKey);
    });

    it('应该为不同种子生成不同的账户', () => {
      const eoa1 = generator.generateEOA('seed-1');
      const eoa2 = generator.generateEOA('seed-2');
      
      expect(eoa1.address).not.toBe(eoa2.address);
      expect(eoa1.privateKey).not.toBe(eoa2.privateKey);
    });
  });

  describe('generateMnemonicAccount', () => {
    it('应该生成有效的助记词账户', () => {
      const account = generator.generateMnemonicAccount();
      
      expect(account.mnemonic).toBeDefined();
      expect(account.mnemonic.split(' ').length).toBe(12); // 默认12个单词
      expect(account.address).toBeDefined();
      expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(account.privateKey).toBeDefined();
      expect(account.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('应该支持生成24个单词的助记词', () => {
      const account = generator.generateMnemonicAccount(24);
      
      expect(account.mnemonic.split(' ').length).toBe(24);
    });

    it('每次生成应该产生不同的助记词', () => {
      const account1 = generator.generateMnemonicAccount();
      const account2 = generator.generateMnemonicAccount();
      
      expect(account1.mnemonic).not.toBe(account2.mnemonic);
      expect(account1.address).not.toBe(account2.address);
    });
  });

  describe('predictSmartAccountAddress', () => {
    it('应该成功预测智能合约账户地址', async () => {
      const owner = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 5000;
      const predictedAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      
      mockAccountManager.predictAccountAddress.mockResolvedValue(predictedAddress);
      
      const result = await generator.predictSmartAccountAddress(owner, chainId);
      
      expect(result).toBe(predictedAddress);
      expect(mockAccountManager.predictAccountAddress).toHaveBeenCalledWith(owner, chainId);
    });

    it('应该处理预测失败的情况', async () => {
      const owner = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 5000;
      const error = new Error('Prediction failed');
      
      mockAccountManager.predictAccountAddress.mockRejectedValue(error);
      
      await expect(
        generator.predictSmartAccountAddress(owner, chainId)
      ).rejects.toThrow('Prediction failed');
    });
  });

  describe('generateAccountSet', () => {
    it('应该生成完整的测试账号集合', async () => {
      const chainId = 5000;
      const predictedAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      
      mockAccountManager.predictAccountAddress.mockResolvedValue(predictedAddress);
      
      const accountSet = await generator.generateAccountSet(chainId, true);
      
      // 验证主账户
      expect(accountSet.mainAccount).toBeDefined();
      expect(accountSet.mainAccount.type).toBe('smart-contract');
      expect(accountSet.mainAccount.chainId).toBe(chainId);
      expect(accountSet.mainAccount.owner).toBeDefined();
      expect(accountSet.mainAccount.privateKey).toBeDefined();
      
      // 验证辅助账户
      expect(accountSet.auxiliaryAccounts).toHaveLength(2);
      accountSet.auxiliaryAccounts.forEach(account => {
        expect(account.type).toBe('eoa');
        expect(account.chainId).toBe(chainId);
        expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
      
      // 验证守护人账户
      expect(accountSet.guardians).toHaveLength(3);
      accountSet.guardians.forEach(account => {
        expect(account.type).toBe('eoa');
        expect(account.chainId).toBe(chainId);
        expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
      
      // 验证赞助商账户
      expect(accountSet.sponsorAccount).toBeDefined();
      expect(accountSet.sponsorAccount?.type).toBe('eoa');
      expect(accountSet.sponsorAccount?.chainId).toBe(chainId);
    });

    it('应该支持不包含赞助商账户', async () => {
      const chainId = 5000;
      const predictedAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      
      mockAccountManager.predictAccountAddress.mockResolvedValue(predictedAddress);
      
      const accountSet = await generator.generateAccountSet(chainId, false);
      
      expect(accountSet.sponsorAccount).toBeUndefined();
    });

    it('应该在预测失败时使用占位地址', async () => {
      const chainId = 5000;
      
      mockAccountManager.predictAccountAddress.mockRejectedValue(new Error('RPC failed'));
      
      const accountSet = await generator.generateAccountSet(chainId, true);
      
      // 应该使用占位地址
      expect(accountSet.mainAccount.address).toBe('0x' + '1'.repeat(40));
      expect(accountSet.mainAccount.privateKey).toBeDefined();
    });
  });

  describe('generateBatch', () => {
    it('应该生成指定数量的测试账号', () => {
      const count = 10;
      const chainId = 5000;
      
      const accounts = generator.generateBatch(count, chainId);
      
      expect(accounts).toHaveLength(count);
      accounts.forEach(account => {
        expect(account.type).toBe('eoa');
        expect(account.chainId).toBe(chainId);
        expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });

    it('应该为每个账号生成不同的地址', () => {
      const count = 10;
      const chainId = 5000;
      
      const accounts = generator.generateBatch(count, chainId);
      const addresses = accounts.map(a => a.address);
      
      // 所有地址应该唯一
      expect(new Set(addresses).size).toBe(count);
    });

    it('应该使用默认链ID（5000）', () => {
      const accounts = generator.generateBatch(5);
      
      accounts.forEach(account => {
        expect(account.chainId).toBe(5000);
      });
    });
  });

  describe('generateTestnetAccounts', () => {
    it('应该生成多组测试账号集合', async () => {
      const chainId = 5000;
      const predictedAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      
      mockAccountManager.predictAccountAddress.mockResolvedValue(predictedAddress);
      
      const testSets = await generator.generateTestnetAccounts(chainId);
      
      expect(testSets).toHaveLength(3);
      testSets.forEach(set => {
        expect(set.mainAccount).toBeDefined();
        expect(set.auxiliaryAccounts).toHaveLength(2);
        expect(set.guardians).toHaveLength(3);
        expect(set.sponsorAccount).toBeDefined();
      });
    });
  });

  describe('单例实例', () => {
    it('应该导出单例实例', () => {
      expect(testAccountGenerator).toBeInstanceOf(TestAccountGenerator);
    });

    it('单例实例应该可以正常工作', () => {
      const eoa = testAccountGenerator.generateEOA();
      expect(eoa.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });
});
