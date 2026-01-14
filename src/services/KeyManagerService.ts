/**
 * 密钥管理服务
 * 
 * 负责管理签名者私钥的安全存储和获取
 * 私钥使用密码加密存储，仅在需要时解密
 */

import { securityVault } from './SecurityVault';
import { authService } from './AuthService';
import type { Address, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Wallet } from 'ethers';

export interface KeyInfo {
  address: Address;
  privateKey: Hex; // 加密存储，需要密码解密
  createdAt: number;
}

/**
 * 密钥管理服务
 */
export class KeyManagerService {
  private readonly KEY_STORAGE_PREFIX = 'key_';

  /**
   * 保存签名者私钥（加密存储）
   * 
   * @param address 签名者地址
   * @param privateKey 私钥（明文）
   * @param password 加密密码
   */
  async savePrivateKey(
    address: Address,
    privateKey: Hex,
    password: string
  ): Promise<void> {
    const keyInfo: KeyInfo = {
      address,
      privateKey, // 这里存储的是明文，实际应该加密
      createdAt: Date.now(),
    };

    // 使用 SecurityVault 加密存储
    const storageKey = `${this.KEY_STORAGE_PREFIX}${address.toLowerCase()}`;
    await securityVault.setItem(storageKey, keyInfo, password);
  }

  /**
   * 获取签名者私钥（需要密码解密）
   * 
   * @param address 签名者地址
   * @param password 解密密码
   * @returns 私钥（明文）
   */
  async getPrivateKey(address: Address, password: string): Promise<Hex | null> {
    // 检查是否已登录
    if (!authService.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    const storageKey = `${this.KEY_STORAGE_PREFIX}${address.toLowerCase()}`;
    const keyInfo = await securityVault.getItem<KeyInfo>(storageKey, password);

    if (!keyInfo) {
      return null;
    }

    return keyInfo.privateKey as Hex;
  }

  /**
   * 从当前会话获取私钥（使用会话密钥）
   * 
   * 实现方案：
   * 1. 从会话中获取会话密钥（通过authService）
   * 2. 使用会话密钥派生加密密钥
   * 3. 解密存储的私钥
   * 
   * 注意：会话密钥在用户登录时生成，登出时清除
   * 
   * @param address 签名者地址
   * @returns 私钥（明文），如果无法获取返回 null
   */
  async getPrivateKeyFromSession(address: Address): Promise<Hex | null> {
    const session = authService.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    try {
      // 方案1: 使用会话密钥派生加密密钥
      // 从SecurityVault获取会话密钥（如果已缓存）
      const storageKey = `${this.KEY_STORAGE_PREFIX}${address.toLowerCase()}`;
      
      // 尝试从会话存储中获取缓存的私钥
      // 注意：这需要在登录时缓存私钥（需要用户输入一次密码）
      const sessionKey = `session_key_${session.userId}_${address.toLowerCase()}`;
      const cachedKey = await securityVault.getItem<{ privateKey: Hex; expiresAt: number }>(
        sessionKey,
        session.userId // 使用userId作为密码（实际应该使用会话密钥）
      );

      if (cachedKey && cachedKey.expiresAt > Date.now()) {
        return cachedKey.privateKey;
      }

      // 方案2: 如果会话中没有缓存的私钥，返回null，要求用户输入密码
      // 这是安全的做法，避免在会话中永久存储私钥
      return null;
    } catch (error) {
      console.error('Failed to get private key from session:', error);
      return null;
    }
  }

  /**
   * 缓存私钥到会话（临时存储）
   * 
   * 在用户输入密码后，可以临时缓存私钥到会话中
   * 缓存有过期时间，登出时自动清除
   * 
   * @param address 签名者地址
   * @param privateKey 私钥（明文）
   * @param ttl 缓存时间（毫秒，默认30分钟）
   */
  async cachePrivateKeyToSession(
    address: Address,
    privateKey: Hex,
    ttl: number = 30 * 60 * 1000
  ): Promise<void> {
    const session = authService.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const sessionKey = `session_key_${session.userId}_${address.toLowerCase()}`;
    await securityVault.setItem(
      sessionKey,
      {
        privateKey,
        expiresAt: Date.now() + ttl,
      },
      session.userId // 使用userId作为密码（实际应该使用会话密钥）
    );
  }

  /**
   * 生成新的私钥
   */
  async generatePrivateKey(): Promise<{ address: Address; privateKey: Hex }> {
    const { generatePrivateKey: viemGeneratePrivateKey } = await import('viem/accounts');
    const privateKey = viemGeneratePrivateKey();
    const account = privateKeyToAccount(privateKey);
    
    return {
      address: account.address,
      privateKey,
    };
  }

  /**
   * 生成 BIP-39 助记词并派生私钥
   *
   * 说明：
   * - 使用 ethers.Wallet.createRandom() 生成符合 BIP-39 的助记词和私钥
   * - 仅在需要显示助记词给用户备份的场景中使用
   */
  async generateMnemonic(): Promise<{ mnemonic: string; address: Address; privateKey: Hex }> {
    const wallet = Wallet.createRandom();
    const phrase = wallet.mnemonic?.phrase;

    if (!phrase) {
      // 理论上不会发生，仅作防御性处理
      throw new Error('Failed to generate mnemonic phrase');
    }

    return {
      mnemonic: phrase,
      address: wallet.address as Address,
      privateKey: wallet.privateKey as Hex,
    };
  }

  /**
   * 从 BIP-39 助记词恢复私钥
   *
   * @param mnemonic 助记词短语（12/24 词）
   * @throws 如果助记词格式无效或无法解析
   */
  async recoverFromMnemonic(mnemonic: string): Promise<{ address: Address; privateKey: Hex }> {
    // ethers 内部会对助记词做基本校验并抛出错误
    const wallet = Wallet.fromPhrase(mnemonic.trim());

    return {
      address: wallet.address as Address,
      privateKey: wallet.privateKey as Hex,
    };
  }

  /**
   * 从私钥获取地址
   */
  getAddressFromPrivateKey(privateKey: Hex): Address {
    const account = privateKeyToAccount(privateKey);
    return account.address;
  }

  /**
   * 检查私钥是否存在
   * 
   * 通过检查存储中是否有对应的键来判断私钥是否存在
   * 注意：由于 SecurityVault 需要密码才能读取，这里只能检查键是否存在
   * 
   * @param address 签名者地址
   * @returns 私钥是否存在
   */
  async hasPrivateKey(address: Address): Promise<boolean> {
    const storageKey = `${this.KEY_STORAGE_PREFIX}${address.toLowerCase()}`;
    
    try {
      // 尝试从存储中读取（使用一个测试密码）
      // 如果键存在但密码错误，会返回null，但不会抛出错误
      // 如果键不存在，也会返回null
      // 因此我们需要通过其他方式检查键是否存在
      
      // 方案：尝试从 storageAdapter 直接检查键是否存在
      // 注意：这需要 storageAdapter 支持 exists 方法
      // 当前实现：尝试读取，如果返回null且没有错误，说明键可能不存在
      // 但这不够准确，因为密码错误也会返回null
      
      // 更好的方案：在 SecurityVault 中添加 exists 方法
      // 或者：维护一个私钥地址列表
      
      // 首先检查存储中是否存在私钥
      const storageKey = `${this.KEY_STORAGE_PREFIX}${address.toLowerCase()}`;
      const exists = await securityVault.exists(storageKey);
      if (exists) {
        return true;
      }

      // 如果存储中不存在，检查会话缓存
      const session = authService.getSession();
      if (session) {
        const sessionKey = `session_key_${session.userId}_${address.toLowerCase()}`;
        const cached = await securityVault.getItem<{ privateKey: Hex; expiresAt: number }>(
          sessionKey,
          session.userId
        );
        if (cached && cached.expiresAt > Date.now()) {
          return true; // 会话中有缓存的私钥
        }
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check private key existence:', error);
      return false;
    }
  }

  /**
   * 删除私钥
   */
  async removePrivateKey(address: Address): Promise<void> {
    const storageKey = `${this.KEY_STORAGE_PREFIX}${address.toLowerCase()}`;
    await securityVault.removeItem(storageKey);
  }
}

export const keyManagerService = new KeyManagerService();

