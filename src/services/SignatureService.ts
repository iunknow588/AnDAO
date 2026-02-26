/**
 * 签名服务
 * 
 * 提供各种消息签名功能，支持：
 * - eth_sign: 原始消息签名（已弃用，但部分 DApp 仍在使用）
 * - personal_sign: EIP-191 个人消息签名
 * - eth_signTypedData: EIP-712 结构化数据签名
 * 
 * @module services/SignatureService
 */

import type { Address, Hex } from 'viem';
import { Wallet } from 'ethers';
import type { TypedDataDomain } from 'viem';
import { keccak256, toBytes } from 'viem';

type TypedDataField = {
  name: string;
  type: string;
};

export interface TypedData {
  domain: TypedDataDomain;
  types: Record<string, TypedDataField[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

/**
 * 签名服务类
 */
export class SignatureService {
  /**
   * eth_sign 签名
   * 
   * 对原始消息进行签名（已弃用，但部分 DApp 仍在使用）
   * 注意：eth_sign 存在安全风险，建议使用 personal_sign 或 eth_signTypedData
   * 
   * @param message 原始消息（hex 字符串）
   * @param privateKey 签名者私钥
   * @returns 签名结果（65 字节，r + s + v）
   * 
   * @example
   * ```typescript
   * const signature = await signatureService.ethSign('0x...', privateKey);
   * ```
   */
  async ethSign(message: Hex, privateKey: Hex): Promise<Hex> {
    // eth_sign 是对消息哈希的直接签名，不添加 EIP-191 前缀
    // 首先将消息转换为字节数组
    const messageBytes = message.startsWith('0x')
      ? toBytes(message)
      : toBytes(message as `0x${string}`);
    
    // 计算消息哈希（keccak256）
    const messageHash = keccak256(messageBytes);
    
    // 使用 viem 进行签名（不添加 EIP-191 前缀）
    const wallet = new Wallet(privateKey);
    const signature = wallet.signingKey.sign(messageHash).serialized;
    return signature as Hex;
  }

  /**
   * personal_sign 签名
   * 
   * EIP-191 个人消息签名标准
   * 这是推荐的消息签名方式
   * 
   * @param message 消息（字符串或 hex）
   * @param privateKey 签名者私钥
   * @returns 签名结果（65 字节，r + s + v）
   * 
   * @example
   * ```typescript
   * const signature = await signatureService.personalSign('Hello, World!', privateKey);
   * ```
   */
  async personalSign(message: string | Hex, privateKey: Hex): Promise<Hex> {
    const wallet = new Wallet(privateKey);
    
    // personal_sign 使用 EIP-191 标准，ethers.js 的 signMessage 会自动处理
    const signature = await wallet.signMessage(message);
    
    return signature as Hex;
  }

  /**
   * eth_signTypedData 签名
   * 
   * EIP-712 结构化数据签名标准
   * 这是最安全和推荐的结构化数据签名方式
   * 
   * @param typedData EIP-712 结构化数据
   * @param privateKey 签名者私钥
   * @returns 签名结果（65 字节，r + s + v）
   * 
   * @example
   * ```typescript
   * const typedData = {
   *   domain: { name: 'MyApp', version: '1', chainId: 1 },
   *   types: { Person: [{ name: 'name', type: 'string' }] },
   *   primaryType: 'Person',
   *   message: { name: 'Alice' }
   * };
   * const signature = await signatureService.signTypedData(typedData, privateKey);
   * ```
   */
  async signTypedData(typedData: TypedData, privateKey: Hex): Promise<Hex> {
    const wallet = new Wallet(privateKey);
    
    // 使用 ethers.js 的 _signTypedData 方法
    // 注意：ethers.js v6 的 API 可能有所不同
    const signature = await wallet.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    );
    
    return signature as Hex;
  }

  /**
   * 验证签名
   * 
   * 验证消息签名的有效性
   * 
   * @param message 原始消息
   * @param signature 签名
   * @param expectedAddress 期望的签名者地址
   * @returns 是否为有效签名
   */
  async verifySignature(
    message: string | Hex,
    signature: Hex,
    expectedAddress: Address
  ): Promise<boolean> {
    try {
      const recoveredAddress = await this.recoverAddress(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch {
      return false;
    }
  }

  /**
   * 从签名恢复地址
   * 
   * 从消息和签名中恢复签名者地址
   * 
   * @param message 原始消息
   * @param signature 签名
   * @returns 签名者地址
   */
  async recoverAddress(message: string | Hex, signature: Hex): Promise<Address> {
    const { recoverAddress: viemRecoverAddress } = await import('viem');
    const { hashMessage } = await import('viem');
    
    // 计算消息哈希（EIP-191）
    const messageHash = hashMessage(message);
    
    // 恢复地址
    const address = viemRecoverAddress({
      hash: messageHash,
      signature: signature,
    });
    
    return address;
  }
}

export const signatureService = new SignatureService();
