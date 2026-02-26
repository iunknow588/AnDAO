import { describe, expect, it } from 'vitest';
import type { ChainConfig } from '@/types';
import {
  ensureChainConfigFields,
  getChainNativeSymbol,
  requireChainConfig,
} from '@/utils/chainConfigValidation';

const mockChainConfig: ChainConfig = {
  chainId: 99999,
  name: 'Mock Chain',
  rpcUrl: 'https://rpc.mock.chain',
  bundlerUrl: 'https://bundler.mock.chain',
  paymasterAddress: '0x1111111111111111111111111111111111111111',
  kernelFactoryAddress: '0x2222222222222222222222222222222222222222',
  entryPointAddress: '0x3333333333333333333333333333333333333333',
  multiChainValidatorAddress: '0x4444444444444444444444444444444444444444',
  recoveryPluginAddress: '0x5555555555555555555555555555555555555555',
  nativeCurrency: {
    name: 'Mock',
    symbol: 'MOCK',
    decimals: 18,
  },
};

describe('chainConfigValidation', () => {
  describe('ensureChainConfigFields', () => {
    it('should pass when required fields exist', () => {
      expect(ensureChainConfigFields(mockChainConfig, ['rpcUrl', 'kernelFactoryAddress'])).toBe(
        mockChainConfig
      );
    });

    it('should throw when required field is missing', () => {
      const brokenConfig: ChainConfig = {
        ...mockChainConfig,
        kernelFactoryAddress: '',
      };

      expect(() => ensureChainConfigFields(brokenConfig, ['kernelFactoryAddress'])).toThrow(
        'Kernel Factory 地址 未配置'
      );
    });
  });

  describe('requireChainConfig', () => {
    it('should return config for known chain id', () => {
      const config = requireChainConfig(5000, ['rpcUrl']);
      expect(config.chainId).toBe(5000);
    });

    it('should throw for unknown chain id', () => {
      expect(() => requireChainConfig(99999123)).toThrow('链配置未找到');
    });
  });

  describe('getChainNativeSymbol', () => {
    it('should return native symbol for known chain', () => {
      expect(getChainNativeSymbol(5000)).toBe('MNT');
    });

    it('should return fallback for unknown chain', () => {
      expect(getChainNativeSymbol(99999123, 'UNKNOWN')).toBe('UNKNOWN');
    });
  });
});
