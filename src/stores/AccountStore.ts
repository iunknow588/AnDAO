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
import { DEFAULT_CHAIN, getChainConfig } from '@/config/chains';

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
  
  /** 当前选中的链 */
  currentChain: SupportedChain = DEFAULT_CHAIN;
  
  /** 是否正在加载 */
  isLoading = false;
  
  /** 错误信息 */
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
    this.init();
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
        this.currentAccount = this.accounts[0];
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to initialize accounts';
    } finally {
      this.isLoading = false;
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
        this.currentAccount = account;
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
    // 根据 chainId 确定链类型
    // Mantle: 5000, Injective: 888
    if (account.chainId === 5000 || account.chainId === 5001) {
      this.currentChain = SupportedChain.MANTLE;
    } else if (account.chainId === 888) {
      this.currentChain = SupportedChain.INJECTIVE;
    } else {
      // 默认使用 Mantle
      this.currentChain = DEFAULT_CHAIN;
    }
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
    // 如果是数字，尝试转换为 SupportedChain
    if (typeof chain === 'number') {
      // 查找匹配的链
      const supportedChain = Object.values(SupportedChain).find(
        (c) => {
          try {
            const config = getChainConfig(c as SupportedChain);
            return config.chainId === chain;
          } catch {
            return false;
          }
        }
      ) as SupportedChain | undefined;

      if (supportedChain) {
        this.currentChain = supportedChain;
      } else {
        // 自定义链：暂时使用数字作为标识
        // 注意：这需要扩展类型定义以支持自定义链
        this.currentChain = chain as any;
      }
    } else {
      this.currentChain = chain;
    }

    // 查找当前链的账户
    const chainId = typeof chain === 'number' ? chain : (getChainConfig(chain).chainId);
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
    const chainId = typeof chain === 'number' ? chain : (getChainConfig(chain).chainId);
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
      // 根据 chainId 确定链类型
      // Mantle: 5000, Injective: 888
      if (account.chainId === 5000 || account.chainId === 5001) {
        this.currentChain = SupportedChain.MANTLE;
      } else if (account.chainId === 888) {
        this.currentChain = SupportedChain.INJECTIVE;
      } else {
        // 默认使用 Mantle
        this.currentChain = DEFAULT_CHAIN;
      }
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

