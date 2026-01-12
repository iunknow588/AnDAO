/**
 * 交易流程集成测试
 * 
 * 测试交易发送的完整流程
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransactionRelayer } from '@/services/TransactionRelayer';
import { bundlerClient } from '@/services/BundlerClient';
import type { Address, Hash } from 'viem';

// Mock dependencies
vi.mock('@/services/BundlerClient', () => ({
  bundlerClient: {
    setBundler: vi.fn(),
    setChainId: vi.fn(),
    sendUserOperation: vi.fn(),
    estimateUserOperationGas: vi.fn(),
  },
}));

vi.mock('@/utils/kernel', () => ({
  getAccountNonce: vi.fn().mockResolvedValue(BigInt(0)),
  encodeExecuteCallData: vi.fn().mockReturnValue('0xabcd'),
}));

vi.mock('@/utils/eip712', () => ({
  signUserOperation: vi.fn().mockResolvedValue('0x1234567890abcdef'),
}));

vi.mock('@/config/chains', () => ({
  getChainConfigByChainId: vi.fn().mockReturnValue({
    chainId: 5000,
    name: 'Mantle',
    rpcUrl: 'https://rpc.mantle.xyz',
    bundlerUrl: 'https://bundler.mantle.xyz',
    entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  }),
}));

vi.mock('viem', () => ({
  createPublicClient: vi.fn().mockReturnValue({
    getGasPrice: vi.fn().mockResolvedValue(BigInt(1000000000)),
  }),
  http: vi.fn(),
}));

describe('交易流程集成测试', () => {
  let transactionRelayer: TransactionRelayer;

  beforeEach(() => {
    transactionRelayer = new TransactionRelayer();
    vi.clearAllMocks();
  });

  it('应该完成交易发送流程', async () => {
    const accountAddress = '0x1234567890123456789012345678901234567890' as Address;
    const chainId = 5000;
    const target = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
    const data = '0x1234';
    const signerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

    const mockHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash;

    vi.mocked(bundlerClient.sendUserOperation).mockResolvedValue(mockHash);
    vi.mocked(bundlerClient.estimateUserOperationGas).mockResolvedValue({
      callGasLimit: BigInt(100000),
      verificationGasLimit: BigInt(100000),
      preVerificationGas: BigInt(50000),
    });

    // 发送交易
    const hash = await transactionRelayer.sendTransaction(
      accountAddress,
      chainId,
      target,
      data,
      signerPrivateKey
    );

    // 验证
    expect(hash).toBe(mockHash);
    expect(bundlerClient.setBundler).toHaveBeenCalled();
    expect(bundlerClient.sendUserOperation).toHaveBeenCalled();
  });
});

