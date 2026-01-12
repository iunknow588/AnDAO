/**
 * 账户创建流程端到端测试
 * 
 * 测试完整的账户创建流程，包括：
 * 1. 用户输入签名者地址
 * 2. 创建智能合约账户
 * 3. 账户地址预测
 * 4. 账户信息保存
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { accountManager } from '@/services/AccountManager';
import { securityVault } from '@/services/SecurityVault';
import { storageAdapter } from '@/adapters/StorageAdapter';
import type { Address } from 'viem';

describe('账户创建流程 E2E', () => {
  const testPassword = 'test-password-123';
  const testOwnerAddress = '0x1234567890123456789012345678901234567890' as Address;

  beforeEach(async () => {
    // 清理存储
    await storageAdapter.clear();
    await securityVault.clear();
    
    // 初始化 AccountManager
    await accountManager.init();
  });

  it('应该成功创建账户并保存到存储', async () => {
    // 1. 生成测试私钥
    const { generatePrivateKey } = await import('viem/accounts');
    const testPrivateKey = generatePrivateKey() as `0x${string}`;
    
    // 2. 创建并部署账户
    const address = await accountManager.createAndDeployAccount(testOwnerAddress, 5000, testPrivateKey);

    // 3. 验证账户地址
    expect(address).toBeDefined();
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);

    // 4. 验证账户已保存
    const savedAccount = await accountManager.getAccountByAddress(address, 5000);
    expect(savedAccount).toBeDefined();
    expect(savedAccount?.address).toBe(address);
    expect(savedAccount?.owner).toBe(testOwnerAddress);
    expect(savedAccount?.status).toBe('deployed');
    expect(savedAccount?.deployedAt).toBeDefined();
  });

  it('应该能够预测账户地址', async () => {
    // 1. 预测地址
    const predictedAddress = await accountManager.predictAccountAddress(testOwnerAddress, 5000);

    // 2. 验证地址格式
    expect(predictedAddress).toBeDefined();
    expect(predictedAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);

    // 3. 创建账户后地址应该一致
    const { generatePrivateKey } = await import('viem/accounts');
    const testPrivateKey = generatePrivateKey() as `0x${string}`;
    const deployedAddress = await accountManager.createAndDeployAccount(testOwnerAddress, 5000, testPrivateKey);
    expect(deployedAddress.toLowerCase()).toBe(predictedAddress.toLowerCase());
  });

  it('应该支持多链账户创建', async () => {
    // 1. 生成测试私钥
    const { generatePrivateKey } = await import('viem/accounts');
    const testPrivateKey = generatePrivateKey() as `0x${string}`;

    // 2. 在 Mantle 上创建账户
    const mantleAddress = await accountManager.createAndDeployAccount(testOwnerAddress, 5000, testPrivateKey);

    // 3. 在 Injective 上创建账户（假设链ID为888）
    const injectiveAddress = await accountManager.createAndDeployAccount(testOwnerAddress, 888, testPrivateKey);

    // 4. 验证两个账户地址不同（因为链ID不同）
    expect(mantleAddress).not.toBe(injectiveAddress);

    // 5. 验证两个账户都已保存
    const savedMantle = await accountManager.getAccountByAddress(mantleAddress, 5000);
    const savedInjective = await accountManager.getAccountByAddress(injectiveAddress, 888);

    expect(savedMantle).toBeDefined();
    expect(savedInjective).toBeDefined();
  });

  it('应该能够获取所有账户', async () => {
    // 1. 生成测试私钥
    const { generatePrivateKey } = await import('viem/accounts');
    const testPrivateKey = generatePrivateKey() as `0x${string}`;

    // 2. 创建多个账户
    const address1 = await accountManager.createAndDeployAccount(testOwnerAddress, 5000, testPrivateKey);
    const address2 = await accountManager.createAndDeployAccount(testOwnerAddress, 888, testPrivateKey);

    // 3. 获取所有账户
    const allAccounts = await accountManager.getAllAccounts();

    // 4. 验证账户数量
    expect(allAccounts.length).toBeGreaterThanOrEqual(2);
    expect(allAccounts.some((a) => a.address === address1)).toBe(true);
    expect(allAccounts.some((a) => a.address === address2)).toBe(true);
  });

  it('应该能够检查账户是否存在', async () => {
    // 1. 生成测试私钥
    const { generatePrivateKey } = await import('viem/accounts');
    const testPrivateKey = generatePrivateKey() as `0x${string}`;

    // 2. 创建并部署账户
    const address = await accountManager.createAndDeployAccount(testOwnerAddress, 5000, testPrivateKey);

    // 3. 检查账户是否存在
    const exists = await accountManager.accountExists(address, 5000);
    expect(exists).toBe(true);

    // 4. 检查不存在的账户
    const nonExistentAddress = '0x0000000000000000000000000000000000000001' as Address;
    const nonExistent = await accountManager.accountExists(nonExistentAddress, 5000);
    expect(nonExistent).toBe(false);
  });
});

