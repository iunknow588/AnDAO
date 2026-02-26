/**
 * 代币服务
 * 
 * 管理代币列表、添加、删除等功能
 */

import { type Address } from 'viem';
import { storageAdapter } from '@/adapters/StorageAdapter';
import { StorageKey } from '@/types';
import { rpcClientManager } from '@/utils/RpcClientManager';

// ERC-20 标准 ABI（用于查询余额和代币信息）
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface TokenInfo {
  address: string;
  chainId: number;
  symbol: string;
  name: string;
  decimals: number;
  balance?: bigint;
  addedAt: number;
}

export class TokenService {
  private tokens: Map<string, TokenInfo> = new Map();

  /**
   * 初始化代币服务
   */
  async init(): Promise<void> {
    const storedTokens = await storageAdapter.get<TokenInfo[]>(StorageKey.SETTINGS + ':tokens');
    if (storedTokens) {
      storedTokens.forEach((token) => {
        this.tokens.set(`${token.chainId}:${token.address.toLowerCase()}`, token);
      });
    }
  }

  /**
   * 获取所有代币
   */
  async getTokens(chainId?: number): Promise<TokenInfo[]> {
    const allTokens = Array.from(this.tokens.values());
    if (chainId !== undefined) {
      return allTokens.filter((token) => token.chainId === chainId);
    }
    return allTokens;
  }

  /**
   * 添加代币
   */
  async addToken(token: Omit<TokenInfo, 'addedAt'>): Promise<void> {
    const key = `${token.chainId}:${token.address.toLowerCase()}`;
    const tokenInfo: TokenInfo = {
      ...token,
      addedAt: Date.now(),
    };
    
    this.tokens.set(key, tokenInfo);
    await this.saveTokens();
  }

  /**
   * 删除代币
   */
  async removeToken(address: string, chainId: number): Promise<void> {
    const key = `${chainId}:${address.toLowerCase()}`;
    this.tokens.delete(key);
    await this.saveTokens();
  }

  /**
   * 查询代币信息
   * 
   * 使用缓存的 PublicClient 实例，避免重复创建
   */
  async fetchTokenInfo(address: Address, chainId: number): Promise<Omit<TokenInfo, 'addedAt' | 'balance'>> {
    // 使用 RpcClientManager 获取缓存的 PublicClient 实例
    const publicClient = rpcClientManager.getPublicClient(chainId);

    try {
      const [name, symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'name',
        }),
        publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }),
        publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }),
      ]);

      return {
        address: address.toLowerCase(),
        chainId,
        name: name as string,
        symbol: symbol as string,
        decimals: decimals as number,
      };
    } catch (error) {
      throw new Error(`Failed to fetch token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 查询代币余额
   * 
   * 使用缓存的 PublicClient 实例，避免重复创建
   */
  async getTokenBalance(address: Address, accountAddress: Address, chainId: number): Promise<bigint> {
    // 使用 RpcClientManager 获取缓存的 PublicClient 实例
    const publicClient = rpcClientManager.getPublicClient(chainId);

    try {
      const balance = await publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [accountAddress],
      });

      return balance as bigint;
    } catch (error) {
      throw new Error(`Failed to fetch token balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 更新代币余额
   */
  async updateTokenBalance(address: string, accountAddress: Address, chainId: number): Promise<void> {
    const key = `${chainId}:${address.toLowerCase()}`;
    const token = this.tokens.get(key);
    if (!token) {
      return;
    }

    try {
      const balance = await this.getTokenBalance(address as Address, accountAddress, chainId);
      token.balance = balance;
      this.tokens.set(key, token);
      await this.saveTokens();
    } catch (error) {
      console.error('Failed to update token balance:', error);
    }
  }

  /**
   * 保存代币列表
   */
  private async saveTokens(): Promise<void> {
    const tokens = Array.from(this.tokens.values());
    await storageAdapter.set(StorageKey.SETTINGS + ':tokens', tokens);
  }
}

export const tokenService = new TokenService();

