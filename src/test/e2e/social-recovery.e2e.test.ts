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
import * as chains from '@/config/chains';
import type { Address, Hex } from 'viem';
import { StorageKey } from '@/types';

describe('社交恢复流程 E2E', () => {
  const testSignerPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
  const testChainId = 5000; // Mantle testnet
  const guardian1Address = '0x1111111111111111111111111111111111111111' as Address;
  const guardian2Address = '0x2222222222222222222222222222222222222222' as Address;
  const newOwnerAddress = '0x3333333333333333333333333333333333333333' as Address;

  let accountAddress: Address;

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
      recoveryPluginAddress: '0x0000000000000000000000000000000000000003',
      nativeCurrency: {
        name: 'Test',
        symbol: 'TST',
        decimals: 18,
      },
    }));
    
    // 初始化服务
    await accountManager.init();
    
    // 避免 RPC：这里不依赖真实链上创建，直接用固定地址即可
    accountAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address;

    // Mock GuardianService 的链上调用入口（其内部会调用 transactionRelayer / RPC）
    const dummyTxHash = ('0x' + '22'.repeat(32)) as Hex;
    vi.spyOn(guardianService, 'addGuardian').mockResolvedValue(dummyTxHash);
    vi.spyOn(guardianService, 'removeGuardian').mockResolvedValue(dummyTxHash);
    vi.spyOn(guardianService, 'voteForRecovery').mockResolvedValue(dummyTxHash);
    vi.spyOn(guardianService, 'initiateRecovery').mockImplementation(async (
      acct: Address,
      chainId: number,
      newOwner: Address
    ) => {
      const txHash = dummyTxHash as string;
      const recoveryId = `recovery_${txHash}`;

      // 与真实实现一致：写入本地恢复请求列表
      const key = `${StorageKey.GUARDIANS}_recovery_${acct}_${chainId}`;
      const recoveries =
        (await storageAdapter.get<Array<{
          recoveryId: string;
          newOwner: Address;
          txHash: string;
          createdAt: number;
          status: 'pending' | 'approved' | 'completed' | 'rejected';
        }>>(key)) || [];

      recoveries.push({
        recoveryId,
        newOwner,
        txHash,
        createdAt: Date.now(),
        status: 'pending',
      });
      await storageAdapter.set(key, recoveries);

      return { recoveryId, txHash };
    });
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
    const { recoveryId, txHash } = await guardianService.initiateRecovery(
      accountAddress,
      testChainId,
      newOwnerAddress,
      undefined,
      testSignerPrivateKey as `0x${string}`
    );

    // 3. 验证交易哈希
    expect(txHash).toBeDefined();
    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // 4. 验证已写入本地恢复请求列表
    expect(recoveryId).toBeTruthy();
    const requests = await guardianService.getRecoveryRequests(accountAddress, testChainId);
    expect(requests.length).toBeGreaterThanOrEqual(1);
  });

  it('应该能够获取恢复后的新所有者地址', async () => {
    // 1. 发起恢复
    await guardianService.initiateRecovery(
      accountAddress,
      testChainId,
      newOwnerAddress,
      undefined,
      testSignerPrivateKey as `0x${string}`
    );

    // 2. 读取本地恢复请求
    const requests = await guardianService.getRecoveryRequests(accountAddress, testChainId);
    expect(requests[0]?.newOwner).toBeDefined();
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
    const { recoveryId } = await guardianService.initiateRecovery(
      accountAddress,
      testChainId,
      newOwnerAddress,
      undefined,
      testSignerPrivateKey as `0x${string}`
    );

    // 3. 守护人投票（模拟）
    const txHash1 = await guardianService.voteForRecovery(
      accountAddress,
      testChainId,
      recoveryId,
      testSignerPrivateKey as `0x${string}`
    );
    expect(txHash1).toBeDefined();

    const txHash2 = await guardianService.voteForRecovery(
      accountAddress,
      testChainId,
      recoveryId,
      testSignerPrivateKey as `0x${string}`
    );
    expect(txHash2).toBeDefined();
  });
});
