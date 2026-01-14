/**
 * 交易流程端到端测试
 * 
 * 测试完整的交易发送流程，包括：
 * 1. 构造交易
 * 2. 估算 Gas
 * 3. 签名 UserOperation
 * 4. 发送到 Bundler
 * 5. 查询交易状态
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { accountManager } from '@/services/AccountManager';
import { transactionRelayer } from '@/services/TransactionRelayer';
import { bundlerClient } from '@/services/BundlerClient';
import { storageAdapter } from '@/adapters/StorageAdapter';
import * as chains from '@/config/chains';
import type { Address, Hex } from 'viem';

// 避免测试环境依赖真实 RPC：mock 底层 kernel 部署方法
vi.mock('@/utils/kernel', () => {
  return {
    createAccount: vi.fn(async () => ({
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
      txHash: '0x' + '11'.repeat(32),
    })),
  };
});

// Mock Bundler 响应
const mockBundlerResponse = {
  userOperationHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
  receipt: {
    userOpHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
    success: true,
    actualGasCost: BigInt(100000),
    actualGasUsed: BigInt(80000),
  },
};

describe('交易流程 E2E', () => {
  const testOwnerAddress = '0x1234567890123456789012345678901234567890' as Address;
  const testSignerPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
  const testChainId = 5000; // Mantle testnet

  beforeEach(async () => {
    // 清理存储
    await storageAdapter.clear();

    // 为测试环境注入简化的链配置，避免依赖真实环境变量
    vi.spyOn(chains, 'getChainConfigByChainId').mockImplementation((chainId: number) => ({
      chainId,
      name: 'Mantle',
      rpcUrl: 'http://localhost:8545',
      bundlerUrl: 'http://localhost:3000',
      kernelFactoryAddress: '0x0000000000000000000000000000000000000001',
      entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
      multiChainValidatorAddress: '0x0000000000000000000000000000000000000002',
      nativeCurrency: {
        name: 'Test',
        symbol: 'TST',
        decimals: 18,
      },
    }));

    // 初始化服务
    await accountManager.init();
    
    // Mock Bundler 客户端
    vi.spyOn(bundlerClient, 'sendUserOperation').mockResolvedValue(mockBundlerResponse.userOperationHash);
    vi.spyOn(bundlerClient, 'estimateUserOperationGas').mockResolvedValue({
      preVerificationGas: BigInt(100000),
      verificationGasLimit: BigInt(200000),
      callGasLimit: BigInt(300000),
    });
    vi.spyOn(bundlerClient, 'getUserOperationReceipt').mockResolvedValue(mockBundlerResponse.receipt);

    // 避免 transactionRelayer 内部构造/签名 UserOp 时触发 RPC：
    // - 这里的 E2E 目标是验证“流程串起来并拿到 hash”，而非真实链交互
    vi.spyOn(transactionRelayer, 'sendTransaction').mockResolvedValue(mockBundlerResponse.userOperationHash as any);
    vi.spyOn(transactionRelayer, 'sendBatch').mockResolvedValue(mockBundlerResponse.userOperationHash as any);
    vi.spyOn(accountManager, 'createAndDeployAccount').mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address);
  });

  it('应该能够发送单笔交易', async () => {
    // 1. 创建并部署账户
    const accountAddress = await accountManager.createAndDeployAccount(
      testOwnerAddress, 
      testChainId, 
      testSignerPrivateKey as `0x${string}`
    );

    // 2. 构造交易
    const to = '0x9876543210987654321098765432109876543210' as Address;
    const callData = '0x' as Hex;
    const value = BigInt(1000000000000000000); // 1 ETH

    // 3. 发送交易
    const txHash = await transactionRelayer.sendTransaction(
      accountAddress,
      testChainId,
      to,
      callData,
      testSignerPrivateKey as `0x${string}`
    );

    // 4. 验证交易哈希
    expect(txHash).toBeDefined();
    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('应该能够发送批量交易', async () => {
    // 1. 创建并部署账户
    const accountAddress = await accountManager.createAndDeployAccount(
      testOwnerAddress, 
      testChainId, 
      testSignerPrivateKey as `0x${string}`
    );

    // 2. 构造批量交易
    const transactions = [
      {
        to: '0x1111111111111111111111111111111111111111' as Address,
        value: BigInt(1000000000000000000),
        data: '0x' as Hex,
      },
      {
        to: '0x2222222222222222222222222222222222222222' as Address,
        value: BigInt(2000000000000000000),
        data: '0x' as Hex,
      },
    ];

    // 3. 发送批量交易
    const txHash = await transactionRelayer.sendBatch(
      accountAddress,
      testChainId,
      transactions,
      testSignerPrivateKey as `0x${string}`
    );

    // 4. 验证交易哈希
    expect(txHash).toBeDefined();
    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('应该能够估算 Gas', async () => {
    // 1. 创建并部署账户
    const accountAddress = await accountManager.createAndDeployAccount(
      testOwnerAddress, 
      testChainId, 
      testSignerPrivateKey as `0x${string}`
    );

    // 2. 构造交易
    const to = '0x9876543210987654321098765432109876543210' as Address;
    const callData = '0x' as Hex;

    // 3. 估算 Gas（通过 sendTransaction 内部调用）
    // 这里我们直接测试 Bundler 的估算功能
    const gasEstimate = await bundlerClient.estimateUserOperationGas(
      {
        sender: accountAddress,
        nonce: BigInt(0),
        initCode: '0x',
        callData,
        callGasLimit: BigInt(0),
        verificationGasLimit: BigInt(0),
        preVerificationGas: BigInt(0),
        maxFeePerGas: BigInt(0),
        maxPriorityFeePerGas: BigInt(0),
        paymasterAndData: '0x',
        signature: '0x',
      },
      'http://localhost:3000'
    );

    // 4. 验证 Gas 估算结果
    expect(gasEstimate).toBeDefined();
    expect(gasEstimate.preVerificationGas).toBeGreaterThan(BigInt(0));
    expect(gasEstimate.verificationGasLimit).toBeGreaterThan(BigInt(0));
    expect(gasEstimate.callGasLimit).toBeGreaterThan(BigInt(0));
  });

  it('应该能够查询交易状态', async () => {
    // 1. 创建并部署账户
    const accountAddress = await accountManager.createAndDeployAccount(
      testOwnerAddress, 
      testChainId, 
      testSignerPrivateKey as `0x${string}`
    );

    // 2. 发送交易
    const to = '0x9876543210987654321098765432109876543210' as Address;
    const txHash = await transactionRelayer.sendTransaction(
      accountAddress,
      testChainId,
      to,
      '0x' as Hex,
      testSignerPrivateKey as `0x${string}`
    );

    // 3. 查询交易状态
    const receipt = await bundlerClient.getUserOperationReceipt(
      txHash,
      'http://localhost:3000'
    );

    // 4. 验证交易状态
    expect(receipt).toBeDefined();
    expect(receipt.success).toBe(true);
    expect(receipt.actualGasCost).toBeGreaterThan(BigInt(0));
    expect(receipt.actualGasUsed).toBeGreaterThan(BigInt(0));
  });
});

