import { describe, it, expect } from 'vitest';
import {
  isIsoDateString,
  isSupportedUri,
  isValidConsensusHash,
  isValidEvmAddress,
  isValidSolanaAddress,
  normalizeChainFamily,
  validateTiming,
} from '@/services/ming/validation';

describe('ming validation helpers', () => {
  it('should validate consensus hash format', () => {
    expect(
      isValidConsensusHash(
        '0x1111111111111111111111111111111111111111111111111111111111111111'
      )
    ).toBe(true);
    expect(isValidConsensusHash('0x1234')).toBe(false);
    expect(
      isValidConsensusHash(
        '1111111111111111111111111111111111111111111111111111111111111111'
      )
    ).toBe(false);
  });

  it('should validate address format by chain family', () => {
    expect(
      isValidEvmAddress('0x1111111111111111111111111111111111111111')
    ).toBe(true);
    expect(isValidEvmAddress('0x123')).toBe(false);

    expect(isValidSolanaAddress('8J8W1ahh6Y1cM1k8oYyU7F2jmYb5x1p6DYk7tV4hyU2S')).toBe(
      true
    );
    expect(
      isValidSolanaAddress('0x1111111111111111111111111111111111111111')
    ).toBe(false);
  });

  it('should validate token URI schemes', () => {
    expect(isSupportedUri('ipfs://QmExample')).toBe(true);
    expect(isSupportedUri('https://gateway.pinata.cloud/ipfs/QmExample')).toBe(
      true
    );
    expect(isSupportedUri('http://example.com')).toBe(false);
    expect(isSupportedUri('javascript:alert(1)')).toBe(false);
  });

  it('should infer chain family from contract payload', () => {
    expect(
      normalizeChainFamily({
        address: '0x1111111111111111111111111111111111111111',
        chainId: 11155111,
      })
    ).toBe('evm');

    expect(
      normalizeChainFamily({
        address: '5Ga3kk79rpPJy5joLvZKoJowRsEGvfcMpSDqAahYEVKT',
        chainId: 0,
        network: 'solana-devnet',
      })
    ).toBe('solana');
  });

  it('should validate timing object semantics', () => {
    const now = new Date().toISOString();
    const later = new Date(Date.now() + 60_000).toISOString();
    expect(isIsoDateString(now)).toBe(true);
    expect(isIsoDateString('not-a-date')).toBe(false);

    expect(() =>
      validateTiming(
        {
          requestedAt: now,
          executeAt: later,
          strategy: 'scheduled',
        },
        'scheduled'
      )
    ).not.toThrow();

    expect(() =>
      validateTiming(
        {
          requestedAt: now,
          executeAt: later,
          strategy: 'immediate',
        },
        'scheduled'
      )
    ).toThrow();
  });
});
