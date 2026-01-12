/**
 * 认证服务
 * 
 * 负责用户登录、会话管理和密码管理
 */

import { securityVault } from './SecurityVault';
import { storageAdapter } from '@/adapters/StorageAdapter';
import { StorageKey } from '@/types';
import { settingsService } from './SettingsService';

export interface Session {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export class AuthService {
  private session: Session | null = null;
  private readonly SESSION_DURATION = 30 * 60 * 1000; // 30分钟
  private autoLockTimer: NodeJS.Timeout | null = null;
  private activityListeners: (() => void)[] = [];
  private autoLockDelay: number = 5 * 60 * 1000; // 默认5分钟无活动自动锁定
  private visibilityHandler: (() => void) | null = null;

  /**
   * 初始化认证服务
   */
  async init(): Promise<void> {
    // 加载自动锁定设置
    await this.loadAutoLockDelay();
    
    // 从存储加载会话
    const storedSession = await storageAdapter.get<Session>(StorageKey.SESSION);
    if (storedSession && storedSession.expiresAt > Date.now()) {
      this.session = storedSession;
      this.startAutoLock();
      this.setupActivityListeners();
    } else {
      // 会话已过期，清除
      await this.clearSession();
    }
  }

  /**
   * 加载自动锁定延迟设置
   */
  private async loadAutoLockDelay(): Promise<void> {
    try {
      const delayMinutes = await settingsService.getAutoLockDelay();
      this.autoLockDelay = delayMinutes * 60 * 1000; // 转换为毫秒
    } catch (error) {
      console.warn('Failed to load auto lock delay, using default:', error);
      this.autoLockDelay = 5 * 60 * 1000; // 默认5分钟
    }
  }

  /**
   * 更新自动锁定延迟
   */
  async updateAutoLockDelay(): Promise<void> {
    await this.loadAutoLockDelay();
    if (this.isAuthenticated()) {
      this.startAutoLock();
    }
  }

  /**
   * 检查是否是首次登录
   */
  async isFirstLogin(userId: string = 'default'): Promise<boolean> {
    const testKey = `test_${userId}`;
    try {
      // 尝试从存储中获取加密数据的元数据（不依赖密码）
      const metaKey = `meta_${testKey}`;
      const meta = await storageAdapter.get(metaKey);
      return meta === null;
    } catch {
      return true;
    }
  }

  /**
   * 首次登录（创建密码）
   * 
   * @param password 用户密码
   * @param userId 用户ID
   * @returns 是否成功
   */
  async firstLogin(password: string, userId: string = 'default'): Promise<boolean> {
    if (!(await this.isFirstLogin(userId))) {
      throw new Error('Not first login, use login() instead');
    }
    
    try {
      const testKey = `test_${userId}`;
      await securityVault.setItem(testKey, { verified: true, createdAt: Date.now() }, password);
      
      // 标记已初始化
      const metaKey = `meta_${testKey}`;
      await storageAdapter.set(metaKey, { initialized: true });
      
      // 创建会话
      return this.createSession(userId);
    } catch (error) {
      console.error('First login failed:', error);
      return false;
    }
  }

  /**
   * 登录/解锁（验证密码）
   * 
   * @param password 用户密码
   * @param userId 用户ID
   * @returns 是否成功
   */
  async login(password: string, userId: string = 'default'): Promise<boolean> {
    if (await this.isFirstLogin(userId)) {
      throw new Error('First login required, use firstLogin() instead');
    }
    
    try {
      const testKey = `test_${userId}`;
      const testData = await securityVault.getItem(testKey, password);
      
      if (testData === null) {
        // 密码错误（解密失败）
        return false;
      }
      
      if (!testData.verified) {
        console.warn('Test data verification failed');
        return false;
      }
      
      // 创建会话
      return this.createSession(userId);
    } catch (error) {
      console.error('Login failed:', error);
      // 如果解密失败（密码错误），返回 false
      return false;
    }
  }

  /**
   * 创建会话（内部方法）
   */
  private async createSession(userId: string): Promise<boolean> {
    this.session = {
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.SESSION_DURATION,
    };

    await storageAdapter.set(StorageKey.SESSION, this.session);
    this.startAutoLock();
    this.setupActivityListeners();
    return true;
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    await this.clearSession();
  }

  /**
   * 检查是否已登录
   */
  isAuthenticated(): boolean {
    if (!this.session) {
      return false;
    }
    
    if (this.session.expiresAt <= Date.now()) {
      // 会话已过期
      this.clearSession();
      return false;
    }

    return true;
  }

  /**
   * 获取当前会话
   */
  getSession(): Session | null {
    if (!this.isAuthenticated()) {
      return null;
    }
    return this.session;
  }

  /**
   * 延长会话
   */
  async extendSession(): Promise<void> {
    if (!this.session) {
      return;
    }

    this.session.expiresAt = Date.now() + this.SESSION_DURATION;
    await storageAdapter.set(StorageKey.SESSION, this.session);
  }

  /**
   * 修改密码
   * 
   * 重新加密所有使用旧密码加密的数据
   * 
   * 实现流程：
   * 1. 验证旧密码
   * 2. 获取所有使用旧密码加密的数据键
   * 3. 使用旧密码解密数据
   * 4. 使用新密码重新加密数据
   * 5. 更新存储
   * 
   * ⚠️ **注意**: 这是一个耗时操作，可能需要较长时间
   * 
   * @param oldPassword 旧密码
   * @param newPassword 新密码
   * @returns 是否修改成功
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      // 验证旧密码
      if (!this.isAuthenticated()) {
        return false;
      }

      const session = this.getSession();
      if (!session) {
        return false;
      }

      // 验证旧密码（通过尝试解密测试数据）
      const testKey = `test_${session.userId}`;
      try {
        const testData = await securityVault.getItem(testKey, oldPassword);
        if (testData === null || !testData.verified) {
          // 密码错误
          return false;
        }
      } catch (error) {
        // 解密失败，密码错误
        return false;
      }

      // 获取需要重新加密的键：优先使用 SecurityVault 注册表，回落到全量扫描
      let encryptedKeys: string[] = securityVault.getRegisteredKeys();

      if (encryptedKeys.length === 0) {
        try {
          const allKeys = await storageAdapter.getAllKeys();
          encryptedKeys = allKeys.filter(key => 
            key.startsWith('key_') ||
            key.startsWith('session_key_') ||
            key.startsWith('test_')
          );
        } catch (error) {
          console.warn('Failed to get all keys for reencryption:', error);
          encryptedKeys = [];
        }
      }

      // 重新加密所有数据
      for (const key of encryptedKeys) {
        try {
          const data = await securityVault.getItem(key, oldPassword);
          if (data !== null) {
            await securityVault.setItem(key, data, newPassword);
          }
        } catch (error) {
          console.warn(`Failed to reencrypt key ${key}:`, error);
        }
      }

      // 更新测试数据（使用新密码）
      await securityVault.setItem(testKey, { verified: true }, newPassword);

      return true;
    } catch (error) {
      console.error('Change password failed:', error);
      return false;
    }
  }

  /**
   * 清除会话
   */
  private async clearSession(): Promise<void> {
    this.session = null;
    await storageAdapter.remove(StorageKey.SESSION);
    this.stopAutoLock();
    this.removeActivityListeners();
  }

  /**
   * 启动自动锁定
   */
  private startAutoLock(): void {
    this.stopAutoLock();
    
    this.autoLockTimer = setTimeout(() => {
      if (this.isAuthenticated()) {
        this.logout();
        // 触发自动锁定事件
        window.dispatchEvent(new CustomEvent('wallet:auto-locked'));
      }
    }, this.autoLockDelay);
  }

  /**
   * 停止自动锁定
   */
  private stopAutoLock(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
  }

  /**
   * 重置自动锁定计时器
   */
  resetAutoLock(): void {
    if (this.isAuthenticated()) {
      this.startAutoLock();
    }
  }

  /**
   * 设置活动监听器
   */
  private setupActivityListeners(): void {
    const resetLock = () => this.resetAutoLock();
    
    // 监听用户活动
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, resetLock, { passive: true });
      this.activityListeners.push(() => window.removeEventListener(event, resetLock));
    });

    // PWA/前台可见性监控：页面隐藏或失焦时立即锁定
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.logout();
      }
    };
    const onBlur = () => {
      this.resetAutoLock();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur, { passive: true });

    this.visibilityHandler = () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }

  /**
   * 移除活动监听器
   */
  private removeActivityListeners(): void {
    this.activityListeners.forEach(remove => remove());
    this.activityListeners = [];
    if (this.visibilityHandler) {
      this.visibilityHandler();
      this.visibilityHandler = null;
    }
  }
}

export const authService = new AuthService();

