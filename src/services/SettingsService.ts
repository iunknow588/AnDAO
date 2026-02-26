/**
 * 设置服务
 * 
 * 管理钱包的各种设置，包括自动锁定时间、Gas代付设置、安全提示等
 */

import { configStorage } from '@/adapters/StorageAdapter';

export interface WalletSettings {
  // 自动锁定设置
  autoLockDelay: number; // 自动锁定延迟（分钟）
  
  // Gas代付设置
  paymasterEnabled: boolean; // 是否启用Gas代付
  paymasterStrategy: 'auto' | 'always' | 'never'; // Gas代付策略
  
  // 安全提示设置
  showSecurityTips: boolean; // 是否显示安全提示
  securityTipLevel: 'low' | 'medium' | 'high'; // 安全提示级别
  
  // 其他设置
  defaultChain?: string; // 默认链
  theme?: 'light' | 'dark' | 'auto'; // 主题
}

const DEFAULT_SETTINGS: WalletSettings = {
  autoLockDelay: 5, // 默认5分钟
  paymasterEnabled: true,
  paymasterStrategy: 'auto',
  showSecurityTips: true,
  securityTipLevel: 'medium',
  theme: 'light',
};

const SETTINGS_KEY = 'wallet_settings';

export class SettingsService {
  private settings: WalletSettings | null = null;

  /**
   * 初始化设置服务
   */
  async init(): Promise<void> {
    await this.loadSettings();
  }

  /**
   * 加载设置
   */
  async loadSettings(): Promise<WalletSettings> {
    if (this.settings) {
      return this.settings;
    }

    const stored = await configStorage.get<WalletSettings>(SETTINGS_KEY);
    this.settings = stored || { ...DEFAULT_SETTINGS };
    return this.settings;
  }

  /**
   * 获取设置
   */
  async getSettings(): Promise<WalletSettings> {
    return this.loadSettings();
  }

  /**
   * 更新设置
   */
  async updateSettings(updates: Partial<WalletSettings>): Promise<void> {
    const current = await this.loadSettings();
    this.settings = {
      ...current,
      ...updates,
    };
    await configStorage.set(SETTINGS_KEY, this.settings);
  }

  /**
   * 获取自动锁定延迟（分钟）
   */
  async getAutoLockDelay(): Promise<number> {
    const settings = await this.loadSettings();
    return settings.autoLockDelay;
  }

  /**
   * 设置自动锁定延迟（分钟）
   */
  async setAutoLockDelay(minutes: number): Promise<void> {
    if (minutes < 1 || minutes > 1440) {
      throw new Error('自动锁定时间必须在1-1440分钟之间');
    }
    await this.updateSettings({ autoLockDelay: minutes });
  }

  /**
   * 获取Gas代付设置
   */
  async getPaymasterSettings(): Promise<{
    enabled: boolean;
    strategy: 'auto' | 'always' | 'never';
  }> {
    const settings = await this.loadSettings();
    return {
      enabled: settings.paymasterEnabled,
      strategy: settings.paymasterStrategy,
    };
  }

  /**
   * 设置Gas代付
   */
  async setPaymasterSettings(
    enabledOrConfig:
      | boolean
      | {
          enabled?: boolean;
          strategy?: 'auto' | 'always' | 'never';
        },
    strategy: 'auto' | 'always' | 'never' = 'auto'
  ): Promise<void> {
    if (typeof enabledOrConfig === 'object') {
      const current = await this.getPaymasterSettings();
      await this.updateSettings({
        paymasterEnabled: enabledOrConfig.enabled ?? current.enabled,
        paymasterStrategy: enabledOrConfig.strategy ?? current.strategy,
      });
      return;
    }

    await this.updateSettings({
      paymasterEnabled: enabledOrConfig,
      paymasterStrategy: strategy,
    });
  }

  /**
   * 获取安全提示设置
   */
  async getSecurityTipSettings(): Promise<{
    showSecurityTips: boolean;
    securityTipLevel: 'low' | 'medium' | 'high';
  }> {
    const settings = await this.loadSettings();
    return {
      showSecurityTips: settings.showSecurityTips,
      securityTipLevel: settings.securityTipLevel,
    };
  }

  /**
   * 设置安全提示
   */
  async setSecurityTipSettings(
    showSecurityTips: boolean,
    securityTipLevel: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    await this.updateSettings({
      showSecurityTips,
      securityTipLevel,
    });
  }

  /**
   * 兼容接口：获取安全提示设置
   */
  async getSecuritySettings(): Promise<{
    showSecurityTips: boolean;
    level: 'low' | 'medium' | 'high';
  }> {
    const settings = await this.getSecurityTipSettings();
    return {
      showSecurityTips: settings.showSecurityTips,
      level: settings.securityTipLevel,
    };
  }

  /**
   * 兼容接口：设置安全提示
   */
  async setSecuritySettings(config: {
    showSecurityTips?: boolean;
    level?: 'low' | 'medium' | 'high';
  }): Promise<void> {
    const current = await this.getSecuritySettings();
    await this.setSecurityTipSettings(
      config.showSecurityTips ?? current.showSecurityTips,
      config.level ?? current.level
    );
  }

  /**
   * 重置为默认设置
   */
  async resetToDefaults(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS };
    await configStorage.set(SETTINGS_KEY, this.settings);
  }
}

export const settingsService = new SettingsService();
