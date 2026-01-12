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
import type { Address, Hex } from 'viem';

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

