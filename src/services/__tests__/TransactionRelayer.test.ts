/**
 * TransactionRelayer 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransactionRelayer } from '../TransactionRelayer';
import { bundlerClient } from '../BundlerClient';
import { UserOperation, Transaction } from '@/types';
import type { Address, Hash } from 'viem';

// Mock bundler client
vi.mock('../BundlerClient', () => ({
  bundlerClient: {
    setBundler: vi.fn(),
    setChainId: vi.fn(),
    sendUserOperation: vi.fn(),
    estimateUserOperationGas: vi.fn(),
  },
}));

// Mock AccountManager
vi.mock('../AccountManager', () => ({
  accountManager: {
    getAccountByAddress: vi.fn().mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      chainId: 5000,
      owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      status: 'deployed' as const,
      deployedAt: Date.now(),
    }),
  },
}));

// Mock kernel utils
vi.mock('@/utils/kernel', () => ({
  getAccountNonce: vi.fn().mockResolvedValue(BigInt(0)),
  encodeExecuteCallData: vi.fn().mockReturnValue('0xabcd'),
  encodeExecuteBatchCallData: vi.fn().mockReturnValue('0xabcd'),
}));

// Mock eip712 utils
vi.mock('@/utils/eip712', () => ({
  signUserOperation: vi.fn().mockResolvedValue('0x1234567890abcdef'),
}));

// Mock chain config
vi.mock('@/config/chains', () => ({
  getChainConfigByChainId: vi.fn().mockReturnValue({
    chainId: 5000,
    name: 'Mantle',
    rpcUrl: 'https://rpc.mantle.xyz',
    bundlerUrl: 'https://bundler.mantle.xyz',
    entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  }),
}));

// Mock viem
vi.mock('viem', () => ({
  createPublicClient: vi.fn().mockReturnValue({
    getGasPrice: vi.fn().mockResolvedValue(BigInt(1000000000)),
  }),
  http: vi.fn(),
}));

describe('TransactionRelayer', () => {
  let transactionRelayer: TransactionRelayer;

  beforeEach(() => {
    transactionRelayer = new TransactionRelayer();
    vi.clearAllMocks();
  });

  describe('sendTransaction', () => {
    it('应该发送单笔交易', async () => {
      const accountAddress = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 5000;
      const target = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      const data = '0x1234';
      const ownerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

      const mockHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash;

      vi.mocked(bundlerClient.sendUserOperation).mockResolvedValue(mockHash);
      vi.mocked(bundlerClient.estimateUserOperationGas).mockResolvedValue({
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(100000),
        preVerificationGas: BigInt(50000),
      });

      const hash = await transactionRelayer.sendTransaction(
        accountAddress,
        chainId,
        target,
        data,
        ownerPrivateKey
      );

      expect(hash).toBe(mockHash);
      expect(bundlerClient.setBundler).toHaveBeenCalled();
      expect(bundlerClient.sendUserOperation).toHaveBeenCalled();
    });

    it('应该在缺少 Bundler URL 时抛出错误', async () => {
      const accountAddress = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 5000;
      const target = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      const data = '0x1234';
      const ownerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

      vi.doMock('@/config/chains', () => ({
        getChainConfigByChainId: vi.fn().mockReturnValue({
          chainId: 5000,
          bundlerUrl: undefined,
        }),
      }));

      await expect(
        transactionRelayer.sendTransaction(accountAddress, chainId, target, data, ownerPrivateKey)
      ).rejects.toThrow();
    });
  });

  describe('sendBatch', () => {
    it('应该发送批量交易', async () => {
      const accountAddress = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 5000;
      const transactions: Transaction[] = [
        {
          to: '0x1111111111111111111111111111111111111111',
          value: BigInt(1000),
          data: '0x1234',
        },
        {
          to: '0x2222222222222222222222222222222222222222',
          value: BigInt(2000),
          data: '0x5678',
        },
      ];
      const ownerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

      const mockHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash;

      vi.mocked(bundlerClient.sendUserOperation).mockResolvedValue(mockHash);
      vi.mocked(bundlerClient.estimateUserOperationGas).mockResolvedValue({
        callGasLimit: BigInt(200000),
        verificationGasLimit: BigInt(100000),
        preVerificationGas: BigInt(50000),
      });

      const hash = await transactionRelayer.sendBatch(
        accountAddress,
        chainId,
        transactions,
        ownerPrivateKey
      );

      expect(hash).toBe(mockHash);
      expect(bundlerClient.sendUserOperation).toHaveBeenCalled();
    });

    it('应该在交易列表为空时抛出错误', async () => {
      const accountAddress = '0x1234567890123456789012345678901234567890' as Address;
      const chainId = 5000;
      const transactions: Transaction[] = [];
      const ownerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

      await expect(
        transactionRelayer.sendBatch(accountAddress, chainId, transactions, ownerPrivateKey)
      ).rejects.toThrow('No transactions to batch');
    });
  });
});

