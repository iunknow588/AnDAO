/**
 * Kernel 工具函数测试
 */

import { describe, it, expect } from 'vitest';
import {
  encodeExecuteCallData,
  encodeExecuteBatchCallData,
} from '../kernel';
import type { Address, Hex } from 'viem';

describe('Kernel 工具函数', () => {
  describe('encodeExecuteCallData', () => {
    it('应该编码 execute 调用数据', () => {
      const target = '0x1234567890123456789012345678901234567890' as Address;
      const value = BigInt(1000);
      const data = '0xabcd' as Hex;
      
      const result = encodeExecuteCallData(target, value, data);
      
      expect(result).toBeDefined();
      expect(result).toMatch(/^0x/);
      expect(result.length).toBeGreaterThan(10); // 至少包含函数选择器和参数
    });
  });

  describe('encodeExecuteBatchCallData', () => {
    it('应该编码 executeBatch 调用数据', () => {
      const targets = [
        '0x1234567890123456789012345678901234567890' as Address,
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
      ];
      const values = [BigInt(1000), BigInt(2000)];
      const datas = ['0xabcd' as Hex, '0xef01' as Hex];
      
      const result = encodeExecuteBatchCallData(targets, values, datas);
      
      expect(result).toBeDefined();
      expect(result).toMatch(/^0x/);
      expect(result.length).toBeGreaterThan(10);
    });

    it('应该处理空数组', () => {
      const targets: Address[] = [];
      const values: bigint[] = [];
      const datas: Hex[] = [];
      
      const result = encodeExecuteBatchCallData(targets, values, datas);
      
      expect(result).toBeDefined();
      expect(result).toMatch(/^0x/);
    });
  });
});

