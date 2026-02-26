/**
 * 账户 Store
 * 
 * 管理账户相关的状态，使用 MobX 进行响应式状态管理
 * 
 * 主要功能：
 * - 账户列表管理
 * - 当前账户和链的切换
 * - 账户创建和导入
 * - 与 AccountManager 服务集成
 * 
 * @module stores/AccountStore
 */

import { makeAutoObservable } from 'mobx';
import { AccountInfo, SupportedChain } from '@/types';
import { accountManager } from '@/services/AccountManager';
import { DEFAULT_CHAIN, getChainConfig, getSupportedChainByChainId, MANTLE_TESTNET_CHAIN } from '@/config/chains';

/**
 * 账户 Store 类
 * 
 * 使用 MobX 的 makeAutoObservable 自动将属性和方法转换为可观察对象
 */
export class AccountStore {
  /** 账户列表 */
  accounts: AccountInfo[] = [];
  
  /** 当前选中的账户 */
  currentAccount: AccountInfo | null = null;
  
  /** 当前选中的链（枚举值） */
  currentChain: SupportedChain = DEFAULT_CHAIN;
  
  /** 当前选中的链 ID（用于区分主网和测试网） */
  currentChainId: number = MANTLE_TESTNET_CHAIN.chainId; // 默认使用测试网（开发环境）
  
  /** 是否正在加载 */
  isLoading = false;
  
  /** 错误信息 */
  error: string | null = null;

  /** 初始化任务（用于外部等待 Store 就绪） */
  private initPromise: Promise<void> | null = null;

  constructor() {
    makeAutoObservable(this);
    this.initPromise = this.init();
  }

  /**
   * 初始化账户Store
   * 
   * 从AccountManager加载账户列表，并恢复当前账户
   */
  async init(): Promise<void> {
    this.isLoading = true;
    try {
      await accountManager.init();
      this.accounts = await accountManager.getAllAccounts();
      
      // 恢复当前账户
      if (this.accounts.length > 0) {
        this.setCurrentAccount(this.accounts[0]);
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to initialize accounts';
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 等待初始化完成（不触发重复初始化）
   */
  async waitUntilReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * 创建新账户
   * 
   * @param owner 账户所有者地址（签名者地址）
   * @param chainId 链 ID
   * @param signerPrivateKey 签名者私钥（必需，用于部署账户）
   */
  async createAccount(owner: string, chainId: number, signerPrivateKey: `0x${string}`): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const address = await accountManager.createAndDeployAccount(
        owner as `0x${string}`, 
        chainId,
        signerPrivateKey
      );
      
      // 从 AccountManager 重新加载账户列表（确保获取最新状态）
      this.accounts = await accountManager.getAllAccounts();
      
      // 设置当前账户
      const account = this.accounts.find(
        (a) => a.address.toLowerCase() === address.toLowerCase() && a.chainId === chainId
      );
      if (account) {
        this.setCurrentAccount(account);
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to create account';
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 切换账户
   */
  setCurrentAccount(account: AccountInfo): void {
    this.currentAccount = account;
    this.currentChainId = account.chainId;
    this.currentChain = getSupportedChainByChainId(account.chainId) || DEFAULT_CHAIN;
  }

  /**
   * 切换链
   * 
   * 支持通过链枚举值或链ID切换链
   * 如果链ID对应的是自定义链，会尝试更新currentChain
   * 
   * @param chain 链枚举值（SupportedChain）或链ID（数字）
   * 
   * @example
   * ```typescript
   * // 使用枚举值
   * accountStore.setCurrentChain(SupportedChain.MANTLE);
   * 
   * // 使用链ID
   * accountStore.setCurrentChain(5000);
   * ```
   */
  setCurrentChain(chain: SupportedChain | number): void {
    let chainId: number;
    let chainEnum: SupportedChain;

    // 如果是数字（chainId），直接使用
    if (typeof chain === 'number') {
      chainId = chain;
      chainEnum = getSupportedChainByChainId(chainId) || DEFAULT_CHAIN;
    } else {
      // 如果是枚举值，获取对应的 chainId
      chainEnum = chain;
      const config = getChainConfig(chain);
      chainId = config.chainId;
    }

    // 更新链枚举值和 chainId
    this.currentChain = chainEnum;
    this.currentChainId = chainId;

    // 查找当前链的账户
    const account = this.accounts.find((a) => a.chainId === chainId);
    if (account) {
      this.currentAccount = account;
    }
  }

  /**
   * 获取当前账户地址
   */
  get currentAccountAddress(): string | null {
    return this.currentAccount?.address || null;
  }

  /**
   * 根据链获取账户
   * 
   * 根据链枚举值或链ID查找对应的账户
   * 
   * @param chain 链枚举值（SupportedChain）或链ID（数字）
   * @returns 账户信息，如果不存在返回 null
   * 
   * @example
   * ```typescript
   * const account = accountStore.getAccount(SupportedChain.MANTLE);
   * if (account) {
   *   console.log('账户地址:', account.address);
   * }
   * ```
   */
  getAccount(chain: SupportedChain | number): AccountInfo | null {
    // 枚举值（如 Mantle）无法区分主网/测试网时，优先使用当前激活的 chainId。
    // 仅当 currentChainId 能映射到同一链枚举时才使用 currentChainId，避免自定义链误映射。
    const currentChainFromId = getSupportedChainByChainId(this.currentChainId);
    const chainId =
      typeof chain === 'number'
        ? chain
        : currentChainFromId === chain
          ? this.currentChainId
          : getChainConfig(chain).chainId;
    return this.accounts.find((a) => a.chainId === chainId) || null;
  }

  /**
   * 添加账户（用于导入）
   */
  async addAccount(account: AccountInfo): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      // 检查账户是否已存在
      const exists = this.accounts.find(
        (a) => a.address.toLowerCase() === account.address.toLowerCase() && a.chainId === account.chainId
      );
      if (exists) {
        throw new Error('Account already exists');
      }

      await accountManager.importAccount(account);
      this.accounts = await accountManager.getAllAccounts();
      this.currentAccount = account;
      this.currentChainId = account.chainId;
      this.currentChain = getSupportedChainByChainId(account.chainId) || DEFAULT_CHAIN;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to add account';
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 清除错误
   */
  clearError(): void {
    this.error = null;
  }
}

export const accountStore = new AccountStore();
