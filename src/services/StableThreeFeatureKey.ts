/**
 * 三特征密钥系统
 *
 * 使用「用户ID + 钱包公钥哈希 + 业务ID」三个特征生成确定性加密密钥，
 * 用于本地加密存储敏感数据（如两阶段提交原始数据、投票数据等）。
 *
 * 密钥生成算法：
 * - 使用 SHA-256( userId | walletPubKeyHash | businessId )
 * - 使用前 32 字节作为 AES-256-GCM 密钥
 * - 不使用盐值
 *
 * 仅替换特征来源，不依赖操作系统信息或程序硬编码，保证在纯前端环境下的稳定性和可移植性。
 *
 * @module services/StableThreeFeatureKey
 */

/**
 * 三个稳定特征接口
 */
export interface ThreeFeatures {
  userId: string;           // 用户注册ID
  walletPubKeyHash: string; // 钱包公钥哈希（稳定摘要）
  businessId: string;      // 业务ID（业务场景标识）
}

/**
 * 特征摘要（用于调试）
 */
export interface FeatureSummary {
  userId: string;
  walletPubKeyHash: string;
  businessId: string;
}

/**
 * 三特征密钥系统
 */
export class StableThreeFeatureKey {
  private static instance: StableThreeFeatureKey | null = null;

  // 三个核心特征
  private userId: string = '';             // 用户注册ID（用户提供）
  private walletPubKeyHash: string = '';   // 钱包公钥哈希（由公钥计算）
  private businessId: string = '';         // 业务ID（业务场景标识）

  // 密钥缓存
  private keyCache: Map<string, CryptoKey> = new Map();

  // 本地存储键
  private readonly USER_ID_STORAGE_KEY = 'voting_user_id';
  private readonly WALLET_PK_HASH_STORAGE_KEY = 'voting_wallet_pk_hash';
  private readonly BUSINESS_ID_STORAGE_KEY = 'business_id';

  private constructor() {
    // 尝试从存储中恢复已有特征，保证稳定性
    this.loadUserId();
    this.loadWalletPubKeyHash();
    this.loadBusinessId();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): StableThreeFeatureKey {
    if (!StableThreeFeatureKey.instance) {
      StableThreeFeatureKey.instance = new StableThreeFeatureKey();
    }
    return StableThreeFeatureKey.instance;
  }

  /**
   * 初始化（设置三个特征）
   *
   * @param userId 用户注册ID
   * @param walletPubKey 钱包公钥（原始公钥字符串，将在本地做哈希处理）
   * @param businessId 业务ID（业务场景标识）
   * @returns 是否初始化成功
   */
  async initialize(userId: string, walletPubKey: string, businessId: string): Promise<boolean> {
    try {
      this.setUserId(userId);
      this.setWalletPubKeyHash(walletPubKey);
      this.setBusinessId(businessId);

      const features = this.getThreeFeatures();

      if (!features.userId || !features.walletPubKeyHash || !features.businessId) {
        throw new Error('特征不完整');
      }

      await this.getUserKey();

      return true;
    } catch (error) {
      console.error('密钥系统初始化失败:', error);
      return false;
    }
  }

  /**
   * 设置用户ID
   */
  private setUserId(userId: string): void {
    // 简单标准化：去除首尾空格
    this.userId = userId.trim();

    // 存储到 localStorage（持久化）
    if (this.userId) {
      try {
        localStorage.setItem(this.USER_ID_STORAGE_KEY, this.userId);
      } catch (e) {
        console.warn('用户ID存储失败:', e);
      }
    }
  }

  /**
   * 设置钱包公钥哈希（对原始公钥做稳定摘要，并持久化）
   */
  private setWalletPubKeyHash(pubKey: string): void {
    this.walletPubKeyHash = this.hashHex(pubKey);
    if (this.walletPubKeyHash) {
      try {
        localStorage.setItem(this.WALLET_PK_HASH_STORAGE_KEY, this.walletPubKeyHash);
      } catch (e) {
        console.warn('钱包公钥哈希存储失败:', e);
      }
    }
  }

  /**
   * 设置业务ID（并持久化）
   */
  private setBusinessId(businessId: string): void {
    this.businessId = businessId.trim();
    if (this.businessId) {
      try {
        localStorage.setItem(this.BUSINESS_ID_STORAGE_KEY, this.businessId);
      } catch (e) {
        console.warn('业务ID存储失败:', e);
      }
    }
  }

  /**
   * 从存储加载用户ID
   */
  private loadUserId(): void {
    try {
      const stored = localStorage.getItem(this.USER_ID_STORAGE_KEY);
      if (stored) {
        this.userId = stored;
      }
    } catch (e) {
      console.warn('用户ID加载失败:', e);
    }
  }

  /**
   * 从存储加载钱包公钥哈希
   */
  private loadWalletPubKeyHash(): void {
    try {
      const stored = localStorage.getItem(this.WALLET_PK_HASH_STORAGE_KEY);
      if (stored) {
        this.walletPubKeyHash = stored;
      }
    } catch (e) {
      console.warn('钱包公钥哈希加载失败:', e);
    }
  }

  /**
   * 从存储加载业务ID
   */
  private loadBusinessId(): void {
    try {
      const stored = localStorage.getItem(this.BUSINESS_ID_STORAGE_KEY);
      if (stored) {
        this.businessId = stored;
      }
    } catch (e) {
      console.warn('业务ID加载失败:', e);
    }
  }

  /**
   * 获取用户ID
   */
  private getUserId(): string {
    if (!this.userId) {
      this.loadUserId();
    }
    return this.userId;
  }

  /**
   * 获取钱包公钥哈希
   */
  private getWalletPubKeyHash(): string {
    if (!this.walletPubKeyHash) {
      this.loadWalletPubKeyHash();
    }
    return this.walletPubKeyHash;
  }

  /**
   * 获取业务ID
   */
  private getBusinessId(): string {
    if (!this.businessId) {
      this.loadBusinessId();
    }
    return this.businessId;
  }

  /**
   * 获取三个稳定特征
   */
  getThreeFeatures(): ThreeFeatures {
    const userId = this.getUserId();
    const walletPubKeyHash = this.getWalletPubKeyHash();
    const businessId = this.getBusinessId();

    if (!userId || !walletPubKeyHash || !businessId) {
      throw new Error('三特征未完整初始化，请先调用 initialize(...)');
    }

    return {
      userId,
      walletPubKeyHash,
      businessId,
    };
  }

  /**
   * 获取用户密钥（主要入口）
   * 
   * @returns 加密密钥（AES-256-GCM）
   */
  async getUserKey(): Promise<CryptoKey> {
    const features = this.getThreeFeatures();
    const cacheKey = this.generateCacheKey(features);

    // 检查缓存
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    // 生成新密钥
    const key = await this.deriveKeyFromFeatures(features);
    this.keyCache.set(cacheKey, key);

    return key;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(features: ThreeFeatures): string {
    // 简单组合，不涉及复杂计算
    return `KEY_${features.userId}_${features.walletPubKeyHash}_${features.businessId}`;
  }

  /**
   * 从三个特征派生密钥（核心算法）
   * 
   * 使用 SHA-256 哈希三个特征，生成确定性密钥（不使用盐值）
   */
  private async deriveKeyFromFeatures(features: ThreeFeatures): Promise<CryptoKey> {
    // 1. 按固定顺序组合三个特征
    const combined = [
      features.userId,           // 特征1: 用户ID
      features.walletPubKeyHash,  // 特征2: 钱包公钥哈希
      features.businessId,        // 特征3: 业务ID
    ].join('|');

    // 2. 使用 SHA-256 生成确定性哈希（不使用盐值）
    const seed = await this.sha256(combined);

    // 3. 使用哈希的前32字节作为 AES-256 密钥
    return await this.bytesToKey(seed.slice(0, 32));
  }

  /**
   * SHA-256 哈希函数
   */
  private async sha256(input: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  }

  /**
   * 轻量级同步哈希（用于对公钥做稳定摘要，不直接作为密钥）
   *
   * 真正的密钥材料来自 sha256(userId | walletPubKeyHash | businessId)。
   */
  private hashHex(input: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    let hash = 0;
    for (const byte of data) {
      hash = (hash * 31 + byte) >>> 0;
    }
    return `H${hash.toString(16)}`;
  }

  /**
   * 字节数组转 AES 密钥
   */
  private async bytesToKey(bytes: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(bytes),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * 验证系统是否可用
   */
  async validate(): Promise<boolean> {
    try {
      const features = this.getThreeFeatures();

      if (!features.userId) return false;
      if (!features.walletPubKeyHash) return false;
      if (!features.businessId) return false;

      // 尝试生成密钥
      await this.getUserKey();
      return true;
    } catch (error) {
      console.error('系统验证失败:', error);
      return false;
    }
  }

  /**
   * 获取特征摘要（调试用）
   */
  getFeaturesSummary(): FeatureSummary {
    const features = this.getThreeFeatures();

    return {
      userId: features.userId,
      walletPubKeyHash: '[HASHED]', // 不暴露真实哈希
      businessId: features.businessId,
    };
  }

  /**
   * 清除所有特征（用于登出等场景）
   */
  clearAllFeatures(): void {
    this.userId = '';
    this.walletPubKeyHash = '';
    this.businessId = '';
    try {
      localStorage.removeItem(this.USER_ID_STORAGE_KEY);
      localStorage.removeItem(this.WALLET_PK_HASH_STORAGE_KEY);
      localStorage.removeItem(this.BUSINESS_ID_STORAGE_KEY);
    } catch (e) {
      console.warn('清除本地特征失败:', e);
    }
    // 清除密钥缓存
    this.keyCache.clear();
  }
}

export const stableThreeFeatureKey = StableThreeFeatureKey.getInstance();
