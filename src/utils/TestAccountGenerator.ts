/**
 * 测试账号生成工具
 * 
 * 用于生成测试环境所需的各类账号，包括：
 * - EOA 私钥和地址
 * - 智能合约账户地址预测
 * - 助记词生成
 * - 测试账号集合生成
 * 
 * 用途：
 * - 单元测试和集成测试
 * - 端到端测试
 * - 测试网验证脚本
 * - 开发环境数据准备
 * 
 * @module utils/TestAccountGenerator
 */

import { generatePrivateKey, privateKeyToAccount, english, generateMnemonic, mnemonicToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';
import { toHex } from 'viem';
import { accountManager } from '@/services/AccountManager';
import { logger } from './logger';

/**
 * 测试账号信息
 */
export interface TestAccount {
  /** 账户地址（智能合约账户或EOA） */
  address: Address;
  /** 私钥（如果适用） */
  privateKey?: Hex;
  /** 助记词（如果适用） */
  mnemonic?: string;
  /** 账户类型 */
  type: 'smart-contract' | 'eoa';
  /** 链 ID */
  chainId: number;
  /** 所有者地址（对于智能合约账户） */
  owner?: Address;
}

/**
 * 测试账号集合
 */
export interface TestAccountSet {
  /** 主账户（智能合约账户） */
  mainAccount: TestAccount;
  /** 辅助账户（EOA） */
  auxiliaryAccounts: TestAccount[];
  /** 守护人账户列表 */
  guardians: TestAccount[];
  /** 赞助商账户 */
  sponsorAccount?: TestAccount;
}

/**
 * 测试账号生成器类
 */
export class TestAccountGenerator {
  private accountManager = accountManager;

  constructor() {
    // 使用共享 AccountManager，避免测试工具与应用状态分叉
  }

  /**
   * 生成 EOA 私钥和地址
   * 
   * @param seed 可选种子（用于生成确定性私钥）
   * @returns EOA 账号信息
   * 
   * @example
   * ```typescript
   * const eoa = await generator.generateEOA();
   * console.log(eoa.address); // 0x...
   * console.log(eoa.privateKey); // 0x...
   * ```
   */
  generateEOA(seed?: string): { address: Address; privateKey: Hex } {
    let privateKey: Hex;
    
    if (seed) {
      // 使用种子生成确定性私钥（简单实现，实际应使用更安全的方法）
      const encoder = new TextEncoder();
      const seedBytes = encoder.encode(seed);
      const hash = seedBytes.reduce((acc, byte) => acc + byte, 0);
      privateKey = `0x${hash.toString(16).padStart(64, '0')}` as Hex;
    } else {
      // 生成随机私钥
      privateKey = generatePrivateKey();
    }

    const account = privateKeyToAccount(privateKey);
    
    return {
      address: account.address,
      privateKey,
    };
  }

  /**
   * 生成助记词和对应的账户
   * 
   * @param wordCount 助记词单词数量（12或24，默认12）
   * @returns 助记词和账户信息
   * 
   * @example
   * ```typescript
   * const { mnemonic, address, privateKey } = await generator.generateMnemonicAccount();
   * console.log(mnemonic); // "word1 word2 ... word12"
   * ```
   */
  generateMnemonicAccount(_wordCount: 12 | 24 = 12): {
    mnemonic: string;
    address: Address;
    privateKey: Hex;
  } {
    const strength = _wordCount === 24 ? 256 : 128;
    const mnemonic = generateMnemonic(english, strength);
    const account = mnemonicToAccount(mnemonic);
    const hdPrivateKey = account.getHdKey().privateKey;
    if (!hdPrivateKey) {
      throw new Error('Failed to derive private key from mnemonic');
    }
    const privateKey = toHex(hdPrivateKey) as Hex;

    return {
      mnemonic,
      address: account.address,
      privateKey,
    };
  }

  /**
   * 预测智能合约账户地址
   * 
   * @param owner 账户所有者地址
   * @param chainId 链 ID
   * @returns 预测的账户地址
   * 
   * @example
   * ```typescript
   * const owner = generator.generateEOA();
   * const predicted = await generator.predictSmartAccountAddress(
   *   owner.address,
   *   5000 // Mantle
   * );
   * ```
   */
  async predictSmartAccountAddress(
    owner: Address,
    chainId: number
  ): Promise<Address> {
    try {
      return await this.accountManager.predictAccountAddress(owner, chainId);
    } catch (error) {
      logger.error('Failed to predict smart account address', 'TestAccountGenerator', error as Error, {
        owner,
        chainId,
      });
      throw error;
    }
  }

  /**
   * 生成完整的测试账号集合
   * 
   * 包含：
   * - 1个主账户（智能合约账户）
   * - 2个辅助账户（EOA）
   * - 3个守护人账户（EOA）
   * - 1个赞助商账户（EOA，可选）
   * 
   * @param chainId 链 ID（默认 5000 - Mantle）
   * @param includeSponsor 是否包含赞助商账户（默认 true）
   * @returns 测试账号集合
   * 
   * @example
   * ```typescript
   * const accountSet = await generator.generateAccountSet(5000);
   * console.log(accountSet.mainAccount.address);
   * console.log(accountSet.guardians.length); // 3
   * ```
   */
  async generateAccountSet(
    chainId: number = 5000,
    includeSponsor: boolean = true
  ): Promise<TestAccountSet> {
    // 1. 生成主账户的EOA（所有者）
    const ownerEOA = this.generateEOA('main-owner');
    
    // 2. 预测智能合约账户地址
    let mainAccountAddress: Address;
    try {
      mainAccountAddress = await this.predictSmartAccountAddress(
        ownerEOA.address,
        chainId
      );
    } catch (error) {
      // 如果预测失败（例如在测试环境中），使用一个占位地址
      logger.warn('Failed to predict smart account address, using placeholder', 'TestAccountGenerator', {
        error,
      });
      mainAccountAddress = '0x' + '1'.repeat(40) as Address;
    }

    // 3. 生成辅助账户（2个）
    const auxiliaryAccounts: TestAccount[] = [
      {
        ...this.generateEOA('auxiliary-1'),
        type: 'eoa',
        chainId,
      },
      {
        ...this.generateEOA('auxiliary-2'),
        type: 'eoa',
        chainId,
      },
    ];

    // 4. 生成守护人账户（3个）
    const guardians: TestAccount[] = [
      {
        ...this.generateEOA('guardian-1'),
        type: 'eoa',
        chainId,
      },
      {
        ...this.generateEOA('guardian-2'),
        type: 'eoa',
        chainId,
      },
      {
        ...this.generateEOA('guardian-3'),
        type: 'eoa',
        chainId,
      },
    ];

    // 5. 生成赞助商账户（可选）
    const sponsorAccount: TestAccount | undefined = includeSponsor
      ? {
          ...this.generateEOA('sponsor'),
          type: 'eoa',
          chainId,
        }
      : undefined;

    return {
      mainAccount: {
        address: mainAccountAddress,
        privateKey: ownerEOA.privateKey,
        type: 'smart-contract',
        chainId,
        owner: ownerEOA.address,
      },
      auxiliaryAccounts,
      guardians,
      sponsorAccount,
    };
  }

  /**
   * 批量生成测试账号
   * 
   * @param count 生成数量
   * @param chainId 链 ID
   * @returns 测试账号数组
   * 
   * @example
   * ```typescript
   * const accounts = generator.generateBatch(10, 5000);
   * console.log(accounts.length); // 10
   * ```
   */
  generateBatch(count: number, chainId: number = 5000): TestAccount[] {
    const accounts: TestAccount[] = [];
    
    for (let i = 0; i < count; i++) {
      const eoa = this.generateEOA(`batch-${i}`);
      accounts.push({
        ...eoa,
        type: 'eoa',
        chainId,
      });
    }
    
    return accounts;
  }

  /**
   * 生成用于测试网验证的账号集合
   * 
   * 包含足够的账号用于完整的功能测试：
   * - 账户创建测试
   * - 交易发送测试
   * - 社交恢复测试
   * - 赞助商功能测试
   * 
   * @param chainId 链 ID
   * @returns 测试账号集合数组
   * 
   * @example
   * ```typescript
   * const testSets = await generator.generateTestnetAccounts(5000);
   * // 用于 testnet-verification.ts
   * ```
   */
  async generateTestnetAccounts(
    chainId: number = 5000
  ): Promise<TestAccountSet[]> {
    const sets: TestAccountSet[] = [];
    
    // 生成3组测试账号集合
    for (let i = 0; i < 3; i++) {
      const set = await this.generateAccountSet(chainId, true);
      sets.push(set);
    }
    
    return sets;
  }
}

/**
 * 单例实例
 */
export const testAccountGenerator = new TestAccountGenerator();
