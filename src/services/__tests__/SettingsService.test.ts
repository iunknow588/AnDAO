/**
 * SettingsService 单元测试
 * 
 * 测试设置服务的各项功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsService } from '../SettingsService';
import { configStorage } from '@/adapters/StorageAdapter';

describe('SettingsService', () => {
  let settingsService: SettingsService;

  beforeEach(async () => {
    settingsService = new SettingsService();
    await configStorage.clear();
    await settingsService.init();
  });

  describe('初始化', () => {
    it('应该使用默认设置', async () => {
      const settings = await settingsService.getSettings();
      expect(settings.autoLockDelay).toBe(5);
      expect(settings.paymasterEnabled).toBe(true);
      expect(settings.paymasterStrategy).toBe('auto');
      expect(settings.showSecurityTips).toBe(true);
    });
  });

  describe('获取设置', () => {
    it('应该返回当前设置', async () => {
      const settings = await settingsService.getSettings();
      expect(settings).toBeDefined();
      expect(settings.autoLockDelay).toBeGreaterThan(0);
    });
  });

  describe('更新设置', () => {
    it('应该成功更新设置', async () => {
      await settingsService.updateSettings({
        autoLockDelay: 10,
      });

      const settings = await settingsService.getSettings();
      expect(settings.autoLockDelay).toBe(10);
    });

    it('应该合并更新而不是替换', async () => {
      await settingsService.updateSettings({
        autoLockDelay: 10,
      });

      await settingsService.updateSettings({
        paymasterEnabled: false,
      });

      const settings = await settingsService.getSettings();
      expect(settings.autoLockDelay).toBe(10); // 应该保留
      expect(settings.paymasterEnabled).toBe(false); // 应该更新
    });
  });

  describe('自动锁定延迟', () => {
    it('应该成功设置自动锁定延迟', async () => {
      await settingsService.setAutoLockDelay(15);
      const delay = await settingsService.getAutoLockDelay();
      expect(delay).toBe(15);
    });

    it('应该拒绝小于1的值', async () => {
      await expect(
        settingsService.setAutoLockDelay(0)
      ).rejects.toThrow('自动锁定时间必须在1-1440分钟之间');
    });

    it('应该拒绝大于1440的值', async () => {
      await expect(
        settingsService.setAutoLockDelay(1441)
      ).rejects.toThrow('自动锁定时间必须在1-1440分钟之间');
    });

    it('应该接受边界值', async () => {
      await settingsService.setAutoLockDelay(1);
      expect(await settingsService.getAutoLockDelay()).toBe(1);

      await settingsService.setAutoLockDelay(1440);
      expect(await settingsService.getAutoLockDelay()).toBe(1440);
    });
  });

  describe('Gas代付设置', () => {
    it('应该成功获取Gas代付设置', async () => {
      const paymasterSettings = await settingsService.getPaymasterSettings();
      expect(paymasterSettings.enabled).toBe(true);
      expect(paymasterSettings.strategy).toBe('auto');
    });

    it('应该成功更新Gas代付设置', async () => {
      await settingsService.setPaymasterSettings({
        enabled: false,
        strategy: 'never',
      });

      const paymasterSettings = await settingsService.getPaymasterSettings();
      expect(paymasterSettings.enabled).toBe(false);
      expect(paymasterSettings.strategy).toBe('never');
    });

    it('应该支持部分更新', async () => {
      await settingsService.setPaymasterSettings({
        enabled: false,
      });

      const paymasterSettings = await settingsService.getPaymasterSettings();
      expect(paymasterSettings.enabled).toBe(false);
      expect(paymasterSettings.strategy).toBe('auto'); // 应该保留原值
    });
  });

  describe('安全提示设置', () => {
    it('应该成功获取安全提示设置', async () => {
      const securitySettings = await settingsService.getSecuritySettings();
      expect(securitySettings.showSecurityTips).toBe(true);
      expect(securitySettings.level).toBe('medium');
    });

    it('应该成功更新安全提示设置', async () => {
      await settingsService.setSecuritySettings({
        showSecurityTips: false,
        level: 'high',
      });

      const securitySettings = await settingsService.getSecuritySettings();
      expect(securitySettings.showSecurityTips).toBe(false);
      expect(securitySettings.level).toBe('high');
    });

    it('应该验证安全提示级别', async () => {
      await settingsService.setSecuritySettings({
        level: 'low',
      });
      expect((await settingsService.getSecuritySettings()).level).toBe('low');

      await settingsService.setSecuritySettings({
        level: 'medium',
      });
      expect((await settingsService.getSecuritySettings()).level).toBe('medium');

      await settingsService.setSecuritySettings({
        level: 'high',
      });
      expect((await settingsService.getSecuritySettings()).level).toBe('high');
    });
  });

  describe('持久化', () => {
    it('应该持久化设置到存储', async () => {
      await settingsService.setAutoLockDelay(20);

      // 创建新实例应该加载保存的设置
      const newService = new SettingsService();
      await newService.init();

      const delay = await newService.getAutoLockDelay();
      expect(delay).toBe(20);
    });
  });
});
