/**
 * 两阶段提交加密服务
 * 
 * 使用三特征密钥系统加密/解密两阶段提交的原始数据
 * 在承诺阶段加密数据并保存，在揭示阶段解密数据并发送到合约
 * 
 * @module services/TwoPhaseCommitEncryption
 */

import { stableThreeFeatureKey } from './StableThreeFeatureKey';
import type { Hex } from 'viem';

/**
 * 加密后的数据接口
 */
export interface EncryptedData {
  iv: string;           // 初始化向量（Base64）
  ciphertext: string;   // 密文（Base64）
  timestamp: number;    // 加密时间戳
}

/**
 * 两阶段提交加密服务
 */
export class TwoPhaseCommitEncryption {
  /**
   * 初始化加密服务（三特征密钥系统）
   *
   * @param userId 用户注册ID
   * @param walletPubKey 钱包公钥（原始公钥字符串，将在本地计算哈希）
   * @param voteSessionId 会话ID（例如本次两阶段提交/投票会话ID）
   * @param voteId 单次投票/提交ID（同一会话多次投票时区分）
   * @returns 是否初始化成功
   */
  async initialize(userId: string, walletPubKey: string, voteSessionId: string, voteId: string): Promise<boolean> {
    return stableThreeFeatureKey.initialize(userId, walletPubKey, voteSessionId, voteId);
  }

  /**
   * 加密原始数据
   * 
   * 使用三特征密钥系统加密数据，用于两阶段提交的承诺阶段
   * 
   * @param data 原始数据（字符串或 hex）
   * @returns 加密后的数据（包含 IV 和密文）
   * 
   * @example
   * ```typescript
   * const encrypted = await encryption.encryptData('my secret data');
   * // 保存 encrypted.iv 和 encrypted.ciphertext
   * ```
   */
  async encryptData(data: string | Hex): Promise<EncryptedData> {
    // 获取用户密钥
    const userKey = await stableThreeFeatureKey.getUserKey();

    // 生成随机 IV（12 字节，AES-GCM 推荐）
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 准备数据
    const dataToEncrypt = {
      data: data,
      encryptedAt: Date.now(),
    };

    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(dataToEncrypt));

    // 加密
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      userKey,
      plaintext
    );

    return {
      iv: this.arrayToBase64(iv),
      ciphertext: this.arrayToBase64(new Uint8Array(ciphertext)),
      timestamp: dataToEncrypt.encryptedAt,
    };
  }

  /**
   * 解密数据
   * 
   * 使用三特征密钥系统解密数据，用于两阶段提交的揭示阶段
   * 
   * @param encrypted 加密后的数据
   * @returns 原始数据（字符串）
   * 
   * @example
   * ```typescript
   * const decrypted = await encryption.decryptData(encrypted);
   * // 使用 decrypted 发送到合约
   * ```
   */
  async decryptData(encrypted: EncryptedData): Promise<string> {
    // 获取用户密钥
    const userKey = await stableThreeFeatureKey.getUserKey();

    // 转换 Base64 为 ArrayBuffer
    const iv = this.base64ToArray(encrypted.iv);
    const ciphertext = this.base64ToArray(encrypted.ciphertext);

    // 解密
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      userKey,
      ciphertext
    );

    // 解析 JSON
    const decoder = new TextDecoder();
    const decrypted = JSON.parse(decoder.decode(plaintext));

    return decrypted.data;
  }

  /**
   * 验证加密服务是否可用
   */
  async validate(): Promise<boolean> {
    return await stableThreeFeatureKey.validate();
  }

  /**
   * 工具方法：数组转 Base64
   */
  private arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array));
  }

  /**
   * 工具方法：Base64 转数组
   */
  private base64ToArray(base64: string): Uint8Array {
    return new Uint8Array(
      atob(base64)
        .split('')
        .map((c) => c.charCodeAt(0))
    );
  }
}

export const twoPhaseCommitEncryption = new TwoPhaseCommitEncryption();

