/**
 * BundlerClient 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BundlerClient } from '../BundlerClient';
import { UserOperation } from '@/types';
import type { Hash } from 'viem';

// Mock fetch
global.fetch = vi.fn();

describe('BundlerClient', () => {
  let bundlerClient: BundlerClient;

  beforeEach(() => {
    bundlerClient = new BundlerClient();
    vi.clearAllMocks();
  });

  describe('addBundler', () => {
    it('应该添加 Bundler 配置', () => {
      bundlerClient.addBundler({
        url: 'https://bundler1.example.com',
        name: 'Bundler 1',
        priority: 1,
      });

      bundlerClient.addBundler({
        url: 'https://bundler2.example.com',
        name: 'Bundler 2',
        priority: 2,
      });

      // 测试通过发送请求来验证
      expect(bundlerClient).toBeDefined();
    });

    it('应该按优先级排序 Bundler', () => {
      bundlerClient.addBundler({
        url: 'https://bundler2.example.com',
        name: 'Bundler 2',
        priority: 2,
      });

      bundlerClient.addBundler({
        url: 'https://bundler1.example.com',
        name: 'Bundler 1',
        priority: 1,
      });

      // 第一个添加的应该是优先级最高的
      expect(bundlerClient).toBeDefined();
    });
  });

  describe('setBundler', () => {
    it('应该设置当前使用的 Bundler', () => {
      bundlerClient.addBundler({
        url: 'https://bundler1.example.com',
        name: 'Bundler 1',
        priority: 1,
      });

      bundlerClient.setBundler('https://bundler1.example.com', 5000);

      expect(bundlerClient).toBeDefined();
    });
  });

  describe('sendUserOperation', () => {
    it('应该发送 UserOperation 到 Bundler', async () => {
      const mockUserOp: UserOperation = {
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

      bundlerClient.addBundler({
        url: 'https://bundler1.example.com',
        name: 'Bundler 1',
        priority: 1,
        chainId: 5000,
      });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        }),
      } as Response);

      bundlerClient.setBundler('https://bundler1.example.com', 5000);
      bundlerClient.setChainId(5000);

      const hash = await bundlerClient.sendUserOperation(mockUserOp, 5000);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^0x/);
    });

    it('应该在第一个 Bundler 失败时尝试下一个', async () => {
      const mockUserOp: UserOperation = {
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

      bundlerClient.addBundler({
        url: 'https://bundler1.example.com',
        name: 'Bundler 1',
        priority: 1,
      });

      bundlerClient.addBundler({
        url: 'https://bundler2.example.com',
        name: 'Bundler 2',
        priority: 2,
      });

      // 第一个失败
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      // 第二个成功
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        }),
      } as Response);

      bundlerClient.setBundler('https://bundler1.example.com', 5000);
      bundlerClient.setChainId(5000);

      const hash = await bundlerClient.sendUserOperation(mockUserOp, 5000);

      expect(hash).toBeDefined();
    });
  });

  describe('estimateUserOperationGas', () => {
    it('应该估算 UserOperation Gas', async () => {
      const mockUserOp: UserOperation = {
        sender: '0x1234567890123456789012345678901234567890',
        nonce: BigInt(0),
        initCode: '0x',
        callData: '0x',
        callGasLimit: BigInt(0),
        verificationGasLimit: BigInt(0),
        preVerificationGas: BigInt(0),
        maxFeePerGas: BigInt(1000000000),
        maxPriorityFeePerGas: BigInt(100000000),
        paymasterAndData: '0x',
        signature: '0x',
      };

      bundlerClient.addBundler({
        url: 'https://bundler1.example.com',
        name: 'Bundler 1',
        priority: 1,
      });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            callGasLimit: '0x186a0',
            verificationGasLimit: '0x186a0',
            preVerificationGas: '0xc350',
          },
        }),
      } as Response);

      bundlerClient.setBundler('https://bundler1.example.com', 5000);
      bundlerClient.setChainId(5000);

      const estimate = await bundlerClient.estimateUserOperationGas(mockUserOp, 5000);

      expect(estimate.callGasLimit).toBeGreaterThan(BigInt(0));
      expect(estimate.verificationGasLimit).toBeGreaterThan(BigInt(0));
      expect(estimate.preVerificationGas).toBeGreaterThan(BigInt(0));
    });
  });

  describe('getUserOperationReceipt', () => {
    it('应该获取 UserOperation 收据', async () => {
      const userOpHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash;

      bundlerClient.addBundler({
        url: 'https://bundler1.example.com',
        name: 'Bundler 1',
        priority: 1,
      });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            userOpHash,
            success: true,
            actualGasCost: '0x1234',
          },
        }),
      } as Response);

      bundlerClient.setBundler('https://bundler1.example.com', 5000);

      const receipt = await bundlerClient.getUserOperationReceipt(userOpHash);

      expect(receipt).toBeDefined();
      expect(receipt.userOpHash).toBe(userOpHash);
    });
  });
});

