/**
 * PaymasterService 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymasterService } from '../PaymasterService';
import { UserOperation } from '@/types';
import type { Address } from 'viem';

// Mock chain config
vi.mock('@/config/chains', () => ({
  getChainConfigByChainId: vi.fn().mockReturnValue({
    chainId: 5000,
    name: 'Mantle',
    rpcUrl: 'https://rpc.mantle.xyz',
    paymasterAddress: '0x0000000000000000000000000000000000000002',
    entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  }),
}));

// Mock viem
vi.mock('viem', () => ({
  createPublicClient: vi.fn().mockReturnValue({
    readContract: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890123456789012345678901234'),
  }),
  http: vi.fn(),
}));

describe('PaymasterService', () => {
  let paymasterService: PaymasterService;

  beforeEach(() => {
    paymasterService = new PaymasterService();
    vi.clearAllMocks();
  });

  describe('buildPaymasterData', () => {
    it('应该构造 Paymaster 数据', async () => {
      const userOp: UserOperation = {
        sender: '0x1234567890123456789012345678901234567890',
        nonce: BigInt(0),
        initCode: '0x',
        callData: '0x',
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(100000),
        preVerificationGas: BigInt(50000),
        maxFeePerGas: BigInt(1000000000),
        maxPriorityFeePerGas: BigInt(100000000),
        paymasterAndData: '0x',
        signature: '0x',
      };

      const chainId = 5000;

      const paymasterData = await paymasterService.buildPaymasterData(userOp, chainId);

      expect(paymasterData).toBeDefined();
      expect(paymasterData).toMatch(/^0x/);
    });

    it('应该在没有 Paymaster 时返回空数据', async () => {
      const userOp: UserOperation = {
        sender: '0x1234567890123456789012345678901234567890',
        nonce: BigInt(0),
        initCode: '0x',
        callData: '0x',
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(100000),
        preVerificationGas: BigInt(50000),
        maxFeePerGas: BigInt(1000000000),
        maxPriorityFeePerGas: BigInt(100000000),
        paymasterAndData: '0x',
        signature: '0x',
      };

      // Mock 没有 Paymaster 的链配置
      vi.doMock('@/config/chains', () => ({
        getChainConfigByChainId: vi.fn().mockReturnValue({
          chainId: 5000,
          name: 'Mantle',
          rpcUrl: 'https://rpc.mantle.xyz',
          paymasterAddress: undefined,
        }),
      }));

      const paymasterData = await paymasterService.buildPaymasterData(userOp, 5000);

      expect(paymasterData).toBe('0x');
    });
  });

  describe('canUsePaymaster', () => {
    it('应该检查是否可以使用 Paymaster', async () => {
      const canUse = await paymasterService.canUsePaymaster(5000);

      expect(typeof canUse).toBe('boolean');
    });
  });

  describe('getPaymasterAddress', () => {
    it('应该获取 Paymaster 地址', () => {
      const address = paymasterService.getPaymasterAddress(5000);

      expect(address).toBeDefined();
      expect(address).toMatch(/^0x/);
    });

    it('应该在没有 Paymaster 时返回 null', () => {
      // Mock 没有 Paymaster 的链配置
      vi.doMock('@/config/chains', () => ({
        getChainConfigByChainId: vi.fn().mockReturnValue({
          chainId: 5000,
          paymasterAddress: undefined,
        }),
      }));

      const address = paymasterService.getPaymasterAddress(5000);

      expect(address).toBeNull();
    });
  });
});

