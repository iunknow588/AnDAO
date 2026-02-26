/**
 * 账户创建集成测试
 * 
 * 测试账户创建的完整流程
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { accountManager } from '@/services/AccountManager';
import { storageAdapter } from '@/adapters/StorageAdapter';

// Mock dependencies
vi.mock('@/adapters/StorageAdapter', () => ({
  storageAdapter: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@/config/chains', () => ({
  getChainConfigByChainId: vi.fn().mockReturnValue({
    chainId: 5000,
    name: 'Mantle',
    rpcUrl: 'https://rpc.mantle.xyz',
    kernelFactoryAddress: '0x0000000000000000000000000000000000000001',
    entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    multiChainValidatorAddress: '0x0000000000000000000000000000000000000002',
    bundlerUrl: 'https://bundler.mantle.xyz',
  }),
}));

vi.mock('@/utils/kernel', () => ({
  predictAccountAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
  createAccount: vi.fn().mockResolvedValue({
    address: '0x1234567890123456789012345678901234567890',
    txHash: '0x' + '11'.repeat(32),
  }),
}));

describe('账户创建集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageAdapter.get).mockResolvedValue([]);
    vi.mocked(storageAdapter.set).mockResolvedValue();
  });

  it('应该完成账户创建流程', async () => {
    const owner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`;
    const chainId = 5000;
    const signerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

    // 初始化
    await accountManager.init();

    // 创建并部署账户
    const address = await accountManager.createAndDeployAccount(owner, chainId, signerPrivateKey);

    // 验证
    expect(address).toBeDefined();
    expect(address).toMatch(/^0x/);

    // 验证账户已保存
    const savedAccounts = await accountManager.getAllAccounts();
    expect(savedAccounts.length).toBeGreaterThan(0);
    expect(savedAccounts[0].address).toBe(address);
    expect(savedAccounts[0].status).toBe('deployed');
  });

  it('应该能够查询已创建的账户', async () => {
    const owner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`;
    const chainId = 5000;
    const signerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`;

    // 创建并部署账户
    const createdAddress = await accountManager.createAndDeployAccount(owner, chainId, signerPrivateKey);

    // 查询账户地址
    const queriedAddress = await accountManager.getAccountAddress(owner, chainId);

    expect(queriedAddress).toBe(createdAddress);
  });
});
