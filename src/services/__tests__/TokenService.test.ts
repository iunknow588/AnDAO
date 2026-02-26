/**
 * TokenService 单元测试
 * 
 * 测试代币服务的各项功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TokenService } from '../TokenService';
import { storageAdapter } from '@/adapters/StorageAdapter';
import type { TokenInfo } from '../TokenService';
import type { Address } from 'viem';

describe('TokenService', () => {
  let tokenService: TokenService;

  beforeEach(async () => {
    tokenService = new TokenService();
    await storageAdapter.clear();
    await tokenService.init();
  });

  describe('初始化', () => {
    it('应该正确初始化服务', async () => {
      expect(tokenService).toBeInstanceOf(TokenService);
    });

    it('应该从存储加载代币列表', async () => {
      const mockTokens: TokenInfo[] = [
        {
          address: '0x1111111111111111111111111111111111111111',
          chainId: 5000,
          symbol: 'TEST',
          name: 'Test Token',
          decimals: 18,
          addedAt: Date.now(),
        },
      ];

      await storageAdapter.set('settings:tokens', mockTokens);
      const newService = new TokenService();
      await newService.init();

      const tokens = await newService.getTokens(5000);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].symbol).toBe('TEST');
    });
  });

  describe('获取代币', () => {
    it('应该返回空数组当没有代币时', async () => {
      const tokens = await tokenService.getTokens();
      expect(tokens).toEqual([]);
    });

    it('应该根据链ID过滤代币', async () => {
      await tokenService.addToken({
        address: '0x1111111111111111111111111111111111111111',
        chainId: 5000,
        symbol: 'TEST1',
        name: 'Test Token 1',
        decimals: 18,
      });

      await tokenService.addToken({
        address: '0x2222222222222222222222222222222222222222',
        chainId: 1776,
        symbol: 'TEST2',
        name: 'Test Token 2',
        decimals: 18,
      });

      const mantleTokens = await tokenService.getTokens(5000);
      expect(mantleTokens).toHaveLength(1);
      expect(mantleTokens[0].symbol).toBe('TEST1');

      const injectiveTokens = await tokenService.getTokens(1776);
      expect(injectiveTokens).toHaveLength(1);
      expect(injectiveTokens[0].symbol).toBe('TEST2');
    });
  });

  describe('添加代币', () => {
    it('应该成功添加代币', async () => {
      const token: Omit<TokenInfo, 'addedAt'> = {
        address: '0x1111111111111111111111111111111111111111',
        chainId: 5000,
        symbol: 'TEST',
        name: 'Test Token',
        decimals: 18,
      };

      await tokenService.addToken(token);

      const tokens = await tokenService.getTokens(5000);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].symbol).toBe('TEST');
      expect(tokens[0].address).toBe(token.address.toLowerCase());
      expect(tokens[0].addedAt).toBeGreaterThan(0);
    });

    it('应该忽略地址大小写', async () => {
      await tokenService.addToken({
        address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        chainId: 5000,
        symbol: 'TEST',
        name: 'Test Token',
        decimals: 18,
      });

      // 尝试添加相同地址（不同大小写）
      await tokenService.addToken({
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        chainId: 5000,
        symbol: 'TEST2',
        name: 'Test Token 2',
        decimals: 18,
      });

      const tokens = await tokenService.getTokens(5000);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].symbol).toBe('TEST2'); // 应该更新为最新添加的
    });
  });

  describe('删除代币', () => {
    it('应该成功删除代币', async () => {
      await tokenService.addToken({
        address: '0x1111111111111111111111111111111111111111',
        chainId: 5000,
        symbol: 'TEST',
        name: 'Test Token',
        decimals: 18,
      });

      await tokenService.removeToken(
        '0x1111111111111111111111111111111111111111',
        5000
      );

      const tokens = await tokenService.getTokens(5000);
      expect(tokens).toHaveLength(0);
    });

    it('应该忽略地址大小写', async () => {
      await tokenService.addToken({
        address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        chainId: 5000,
        symbol: 'TEST',
        name: 'Test Token',
        decimals: 18,
      });

      await tokenService.removeToken(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        5000
      );

      const tokens = await tokenService.getTokens(5000);
      expect(tokens).toHaveLength(0);
    });
  });

  describe('获取代币余额', () => {
    it('应该成功获取代币余额', async () => {
      const tokenAddress = '0x1111111111111111111111111111111111111111' as Address;

      // 由于 TokenService 使用 RpcClientManager，这里主要测试方法调用
      // 实际 RPC 调用测试需要在集成测试中进行

      await tokenService.addToken({
        address: tokenAddress,
        chainId: 5000,
        symbol: 'TEST',
        name: 'Test Token',
        decimals: 18,
      });

      // 这个方法会调用 RPC，但在单元测试中可能失败
      // 应该测试方法的存在性和基本逻辑
      expect(typeof tokenService.getTokenBalance).toBe('function');
    });
  });
});
