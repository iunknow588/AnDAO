/**
 * 安全存储库
 * 
 * 提供加密存储功能，使用 Web Crypto API 进行 AES-GCM 加密
 * 用于安全保存会话密钥、守护人列表等敏感数据
 */

import { storageAdapter } from '@/adapters/StorageAdapter';

export class SecurityVault {
  private encryptionKey: CryptoKey | null = null;
  private readonly KEY_REGISTRY_KEY = 'security_vault_registry';

  /**
   * 从密码派生加密密钥
   */
  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    );

    this.encryptionKey = key;
    return key;
  }

  /**
   * 加密数据
   */
  private async encrypt(data: string, key: CryptoKey): Promise<{ encrypted: string; iv: string }> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      dataBuffer
    );

    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
    };
  }

  /**
   * 解密数据
   */
  private async decrypt(
    encrypted: string,
    iv: string,
    key: CryptoKey
  ): Promise<string> {
    const encryptedBuffer = this.base64ToArrayBuffer(encrypted);
    const ivBuffer = this.base64ToArrayBuffer(iv);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
      },
      key,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * 存储加密数据
   */
  async setItem(key: string, value: any, password: string): Promise<void> {
    if (!this.encryptionKey) {
      // 如果没有密钥，从密码派生
      const salt = this.getOrCreateSalt(key);
      await this.deriveKey(password, salt);
    }

    const valueString = JSON.stringify(value);
    const { encrypted, iv } = await this.encrypt(valueString, this.encryptionKey!);

    // 存储加密数据和 IV
    await storageAdapter.set(key, {
      encrypted,
      iv,
      salt: this.arrayBufferToBase64(this.getOrCreateSalt(key)),
    });

    // 记录已使用的密钥，便于密码轮换时全量重加密
    this.registerKey(key);
  }

  /**
   * 读取并解密数据
   */
  async getItem<T>(key: string, password: string): Promise<T | null> {
    try {
      const stored = await storageAdapter.get<{ encrypted: string; iv: string; salt: string }>(key);
      if (!stored) {
        return null;
      }

      // 从存储的 salt 派生密钥
      const salt = this.base64ToArrayBuffer(stored.salt);
      const key = await this.deriveKey(password, salt);

      // 解密数据
      const decrypted = await this.decrypt(stored.encrypted, stored.iv, key);
      return JSON.parse(decrypted) as T;
    } catch (error) {
      console.error('SecurityVault getItem error:', error);
      return null;
    }
  }

  /**
   * 删除数据
   */
  async removeItem(key: string): Promise<void> {
    await storageAdapter.remove(key);
    this.unregisterKey(key);
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    await storageAdapter.clear();
    localStorage.removeItem(this.KEY_REGISTRY_KEY);
  }

  /**
   * 检查数据是否存在
   * 
   * 检查指定键的加密数据是否存在（不进行解密）
   * 
   * @param key 存储键
   * @returns 如果数据存在返回 true，否则返回 false
   */
  async exists(key: string): Promise<boolean> {
    try {
      const stored = await storageAdapter.get<{ encrypted: string; iv: string; salt: string }>(key);
      return stored !== null && stored !== undefined;
    } catch (error) {
      console.error('SecurityVault exists error:', error);
      return false;
    }
  }

  /**
   * 获取或创建 salt
   */
  private getOrCreateSalt(key: string): Uint8Array {
    // 从 localStorage 获取或创建 salt
    const saltKey = `salt_${key}`;
    const stored = localStorage.getItem(saltKey);
    if (stored) {
      return this.base64ToArrayBuffer(stored);
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(saltKey, this.arrayBufferToBase64(salt));
    return salt;
  }

  /**
   * 将 key 写入注册表（存储于 localStorage，仅保存键名，不含数据）
   */
  private registerKey(key: string): void {
    try {
      const keys = this.getRegisteredKeys();
      if (!keys.includes(key)) {
        keys.push(key);
        localStorage.setItem(this.KEY_REGISTRY_KEY, JSON.stringify(keys));
      }
    } catch (error) {
      console.warn('Failed to register key for re-encryption:', error);
    }
  }

  /**
   * 从注册表移除 key
   */
  private unregisterKey(key: string): void {
    try {
      const keys = this.getRegisteredKeys().filter(k => k !== key);
      localStorage.setItem(this.KEY_REGISTRY_KEY, JSON.stringify(keys));
    } catch (error) {
      console.warn('Failed to unregister key:', error);
    }
  }

  /**
   * 获取当前注册的所有加密键（用于密码轮换）
   */
  getRegisteredKeys(): string[] {
    try {
      const stored = localStorage.getItem(this.KEY_REGISTRY_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as string[];
    } catch (error) {
      console.warn('Failed to read key registry:', error);
      return [];
    }
  }

  /**
   * ArrayBuffer 转 Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Base64 转 ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export const securityVault = new SecurityVault();

