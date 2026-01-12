/**
 * GuardianService 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GuardianService } from '../GuardianService';
import { transactionRelayer } from '../TransactionRelayer';
import { storageAdapter } from '@/adapters/StorageAdapter';
import { StorageKey } from '@/types';
import type { Address } from 'viem';
import { getChainConfigByChainId } from '@/config/chains';

// Mock transaction relayer
vi.mock('../TransactionRelayer', () => ({
  transactionRelayer: {
    sendTransaction: vi.fn(),
  },
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
  getChainConfigByChainId: vi.fn(),
}));

describe('GuardianService', () => {
  let guardianService: GuardianService;

  beforeEach(() => {
    guardianService = new GuardianService();
    vi.clearAllMocks();
    
    // 设置默认的chain config mock
    vi.mocked(getChainConfigByChainId).mockReturnValue({
      chainId: 5000,
      name: 'Mantle',
      rpcUrl: 'https://rpc.mantle.xyz',
      kernelFactoryAddress: '0x0000000000000000000000000000000000000001',
      entryPointAddress: '0x0000000000000000000000000000000000000002',
      recoveryPluginAddress: '0x0000000000000000000000000000000000000003',
      nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
    } as any);
  });

  describe('getGuardians', () => {
    it('应该从本地存储获取守护人列表', async () => {
      const accountAddress = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 5000;

      const mockGuardians = [
        {
          address: '0x1111111111111111111111111111111111111111',
          addedAt: Date.now(),
        },
        {
          address: '0x2222222222222222222222222222222222222222',
          addedAt: Date.now(),
        },
      ];

      const storageKey = `${StorageKey.GUARDIANS}_${accountAddress}_${chainId}`;
      vi.mocked(storageAdapter.get).mockResolvedValue(mockGuardians);

      const guardians = await guardianService.getGuardians(accountAddress, chainId);

      expect(guardians).toHaveLength(2);
      expect(guardians[0].address).toBe(mockGuardians[0].address);
    });

    it('应该在存储为空时返回空数组', async () => {
      const accountAddress = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 5000;

      vi.mocked(storageAdapter.get).mockResolvedValue(null);

      const guardians = await guardianService.getGuardians(accountAddress, chainId);

      expect(guardians).toHaveLength(0);
    });
  });

  describe('addGuardian', () => {
    it('应该添加守护人', async () => {
      const accountAddress = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 5000;
      const guardianAddress = '0x1111111111111111111111111111111111111111' as Address;
      const signerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

      const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      vi.mocked(transactionRelayer.sendTransaction).mockResolvedValue(mockTxHash as any);
      vi.mocked(storageAdapter.get).mockResolvedValue([]);
      vi.mocked(storageAdapter.set).mockResolvedValue();

      const txHash = await guardianService.addGuardian(
        accountAddress,
        chainId,
        guardianAddress,
        signerPrivateKey
      );

      expect(txHash).toBe(mockTxHash);
      expect(transactionRelayer.sendTransaction).toHaveBeenCalled();
    });
  });

  describe('removeGuardian', () => {
    it('应该移除守护人', async () => {
      const accountAddress = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 5000;
      const guardianAddress = '0x1111111111111111111111111111111111111111' as Address;
      const signerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

      const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      vi.mocked(transactionRelayer.sendTransaction).mockResolvedValue(mockTxHash as any);
      vi.mocked(storageAdapter.get).mockResolvedValue([
        {
          address: guardianAddress,
          addedAt: Date.now(),
        },
      ]);
      vi.mocked(storageAdapter.set).mockResolvedValue();

      const txHash = await guardianService.removeGuardian(
        accountAddress,
        chainId,
        guardianAddress,
        signerPrivateKey
      );

      expect(txHash).toBe(mockTxHash);
      expect(transactionRelayer.sendTransaction).toHaveBeenCalled();
    });
  });

  describe('initiateRecovery', () => {
    it('应该发起恢复请求', async () => {
      const accountAddress = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 5000;
      const newOwner = '0x1111111111111111111111111111111111111111' as Address;
      const signerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

      const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      vi.mocked(transactionRelayer.sendTransaction).mockResolvedValue(mockTxHash as any);
      vi.mocked(storageAdapter.set).mockResolvedValue();

      const result = await guardianService.initiateRecovery(
        accountAddress,
        chainId,
        newOwner,
        undefined, // recoveryPluginAddress
        signerPrivateKey
      );

      expect(result.txHash).toBe(mockTxHash);
      expect(result.recoveryId).toBeTruthy();
      expect(transactionRelayer.sendTransaction).toHaveBeenCalled();
    });

    it('应该在缺少恢复插件地址时抛出错误', async () => {
      const accountAddress = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 9999; // 不存在的链ID，确保没有配置恢复插件地址
      const newOwner = '0x1111111111111111111111111111111111111111' as Address;
      const signerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

      vi.mocked(getChainConfigByChainId).mockReturnValue({
        chainId: 9999,
        name: 'Test Chain',
        rpcUrl: 'https://test.rpc',
        kernelFactoryAddress: '0x0000000000000000000000000000000000000001',
        entryPointAddress: '0x0000000000000000000000000000000000000002',
        nativeCurrency: { name: 'Test', symbol: 'TEST', decimals: 18 },
      } as any);

      await expect(
        guardianService.initiateRecovery(
          accountAddress,
          chainId,
          newOwner,
          undefined, // recoveryPluginAddress
          signerPrivateKey
        )
      ).rejects.toThrow('Recovery plugin address is required');
    });
  });
});

