/**
 * 获取私钥辅助函数
 * 
 * 提供统一的私钥获取逻辑，优先从会话中获取，如果不存在则抛出错误
 * 
 * @module utils/getPrivateKey
 */

import type { Address, Hex } from 'viem';
import { keyManagerService } from '@/services/KeyManagerService';
import { authService } from '@/services/AuthService';

/**
 * 获取 owner 的私钥
 * 
 * 优先从会话中获取私钥，如果不存在则抛出错误
 * 
 * @param ownerAddress owner 地址
 * @returns owner 的私钥
 * @throws 如果无法获取私钥，抛出错误
 */
export async function getOwnerPrivateKey(ownerAddress: Address): Promise<Hex> {
  // 检查是否已登录
  if (!authService.isAuthenticated()) {
    throw new Error('User not authenticated. Please login first.');
  }

  // 尝试从会话中获取私钥
  let privateKey: Hex | null = null;
  
  try {
    privateKey = await keyManagerService.getPrivateKeyFromSession(ownerAddress);
  } catch (error) {
    console.warn('Failed to get private key from session:', error);
  }

  if (!privateKey) {
    throw new Error(
      'Private key not available in session. ' +
      'Please unlock wallet or re-enter password to access private key.'
    );
  }

  return privateKey;
}

/**
 * 获取账户的 owner 私钥
 * 
 * 从账户信息中获取 owner 地址，然后获取对应的私钥
 * 
 * @param accountAddress 账户地址
 * @param chainId 链 ID
 * @returns owner 的私钥
 * @throws 如果无法获取私钥，抛出错误
 */
export async function getAccountOwnerPrivateKey(
  accountAddress: Address,
  chainId: number
): Promise<Hex> {
  // 从 AccountManager 获取账户信息
  const { accountManager } = await import('@/services/AccountManager');
  const account = await accountManager.getAccountByAddress(accountAddress, chainId);
  
  if (!account) {
    throw new Error(`Account not found: ${accountAddress} on chain ${chainId}`);
  }

  return getOwnerPrivateKey(account.owner as Address);
}
