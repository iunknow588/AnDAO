import type { MingChainFamily, MingContractTarget, MingTiming } from '@/types/ming';

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const CONSENSUS_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export const PROTOCOL_VERSION = '1.0.0';

export function isValidConsensusHash(value: string): boolean {
  return CONSENSUS_HASH_REGEX.test(value);
}

export function isValidEvmAddress(value: string): boolean {
  return EVM_ADDRESS_REGEX.test(value);
}

export function isValidSolanaAddress(value: string): boolean {
  return SOLANA_ADDRESS_REGEX.test(value);
}

export function isSupportedUri(value: string): boolean {
  return value.startsWith('ipfs://') || value.startsWith('https://');
}

export function isIsoDateString(value: string): boolean {
  const ts = Date.parse(value);
  return !Number.isNaN(ts);
}

export function normalizeChainFamily(contract: MingContractTarget): MingChainFamily {
  if (contract.chainFamily === 'evm' || contract.chainFamily === 'solana') {
    return contract.chainFamily;
  }

  if (contract.network && contract.network.toLowerCase().includes('solana')) {
    return 'solana';
  }

  if (Number.isInteger(contract.chainId) && contract.chainId > 0) {
    return 'evm';
  }

  return 'solana';
}

export function validateTiming(
  timing: MingTiming,
  mode: 'mint' | 'scheduled'
): { executeAt: number; requestedAt: number } {
  if (!timing || !timing.requestedAt || !timing.executeAt || !timing.strategy) {
    throw new Error('timing is required');
  }

  if (!isIsoDateString(timing.requestedAt) || !isIsoDateString(timing.executeAt)) {
    throw new Error('timing.requestedAt and timing.executeAt must be valid ISO strings');
  }

  if (mode === 'scheduled' && timing.strategy !== 'scheduled') {
    throw new Error("timing.strategy must be 'scheduled'");
  }

  if (mode === 'mint' && timing.strategy !== 'scheduled' && timing.strategy !== 'immediate') {
    throw new Error("timing.strategy must be 'immediate' or 'scheduled'");
  }

  return {
    requestedAt: Date.parse(timing.requestedAt),
    executeAt: Date.parse(timing.executeAt),
  };
}
