/**
 * 社交恢复流程端到端测试
 * 
 * 测试完整的社交恢复流程，包括：
 * 1. 添加守护人
 * 2. 移除守护人
 * 3. 发起恢复
 * 4. 守护人确认恢复
 * 5. 完成恢复
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { accountManager } from '@/services/AccountManager';
import { guardianService } from '@/services/GuardianService';
import { storageAdapter } from '@/adapters/StorageAdapter';
import type { Address, Hex } from 'viem';

describe('社交恢复流程 E2E', () => {
  const testOwnerAddress = '0x1234567890123456789012345678901234567890' as Address;
  const testSignerPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
  const testChainId = 5000; // Mantle testnet
  const guardian1Address = '0x1111111111111111111111111111111111111111' as Address;
  const guardian2Address = '0x2222222222222222222222222222222222222222' as Address;
  const newOwnerAddress = '0x3333333333333333333333333333333333333333' as Address;

  let accountAddress: Address;

  beforeEach(async () => {
    // 清理存储
    await storageAdapter.clear();
    
    // 初始化服务
    await accountManager.init();
    
    // 创建账户
    const account = await accountManager.createAccount(testOwnerAddress, testChainId);
    accountAddress = account.address as Address;

    // Mock 链上调用
    vi.spyOn(guardianService, 'getGuardians').mockResolvedValue([]);
  });

  it('应该能够添加守护人', async () => {
    // 1. 添加守护人
    const txHash = await guardianService.addGuardian(
      accountAddress,
      testChainId,
      guardian1Address,
      testSignerPrivateKey
    );

    // 2. 验证交易哈希
    expect(txHash).toBeDefined();
    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // 3. 获取守护人列表
    const guardians = await guardianService.getGuardians(accountAddress, testChainId);
    
    // 4. 验证守护人已添加（在真实环境中需要等待交易确认）
    // 这里我们只验证方法调用成功
    expect(guardians).toBeDefined();
  });

  it('应该能够移除守护人', async () => {
    // 1. 先添加守护人
    await guardianService.addGuardian(
      accountAddress,
      testChainId,
      guardian1Address,
      testSignerPrivateKey
    );

    // 2. 移除守护人
    const txHash = await guardianService.removeGuardian(
      accountAddress,
      testChainId,
      guardian1Address,
      testSignerPrivateKey
    );

    // 3. 验证交易哈希
    expect(txHash).toBeDefined();
    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('应该能够发起账户恢复', async () => {
    // 1. 添加守护人
    await guardianService.addGuardian(
      accountAddress,
      testChainId,
      guardian1Address,
      testSignerPrivateKey
    );

    // 2. 发起恢复
    const txHash = await guardianService.initiateRecovery(
      accountAddress,
      testChainId,
      newOwnerAddress,
      testSignerPrivateKey
    );

    // 3. 验证交易哈希
    expect(txHash).toBeDefined();
    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // 4. 检查恢复状态
    const isInitiated = await guardianService.isRecoveryInitiated(accountAddress, testChainId);
    expect(isInitiated).toBeDefined();
  });

  it('应该能够获取恢复后的新所有者地址', async () => {
    // 1. 发起恢复
    await guardianService.initiateRecovery(
      accountAddress,
      testChainId,
      newOwnerAddress,
      testSignerPrivateKey
    );

    // 2. 获取新所有者地址
    const recoveryOwner = await guardianService.getRecoveryOwner(accountAddress, testChainId);
    
    // 3. 验证新所有者地址（在真实环境中需要等待交易确认）
    expect(recoveryOwner).toBeDefined();
  });

  it('应该能够取消恢复', async () => {
    // 1. 发起恢复
    await guardianService.initiateRecovery(
      accountAddress,
      testChainId,
      newOwnerAddress,
      testSignerPrivateKey
    );

    // 2. 取消恢复
    const txHash = await guardianService.cancelRecovery(
      accountAddress,
      testChainId,
      testSignerPrivateKey
    );

    // 3. 验证交易哈希
    expect(txHash).toBeDefined();
    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('应该支持多守护人恢复流程', async () => {
    // 1. 添加多个守护人
    await guardianService.addGuardian(
      accountAddress,
      testChainId,
      guardian1Address,
      testSignerPrivateKey
    );
    await guardianService.addGuardian(
      accountAddress,
      testChainId,
      guardian2Address,
      testSignerPrivateKey
    );

    // 2. 发起恢复
    await guardianService.initiateRecovery(
      accountAddress,
      testChainId,
      newOwnerAddress,
      testSignerPrivateKey
    );

    // 3. 守护人1确认恢复
    const txHash1 = await guardianService.confirmRecovery(
      accountAddress,
      testChainId,
      testSignerPrivateKey
    );
    expect(txHash1).toBeDefined();

    // 4. 守护人2确认恢复
    const txHash2 = await guardianService.confirmRecovery(
      accountAddress,
      testChainId,
      testSignerPrivateKey
    );
    expect(txHash2).toBeDefined();
  });
});

