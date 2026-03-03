import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address } from 'viem';
import { NFTService } from '@/services/NFTService';
import { rpcClientManager } from '@/utils/RpcClientManager';
import { transactionRelayer } from '@/services/TransactionRelayer';

vi.mock('@/utils/RpcClientManager', () => ({
  rpcClientManager: {
    getPublicClient: vi.fn(),
  },
}));

vi.mock('@/services/TransactionRelayer', () => ({
  transactionRelayer: {
    sendTransaction: vi.fn(),
  },
}));

describe('NFTService', () => {
  let service: NFTService;

  beforeEach(() => {
    service = new NFTService();
    vi.clearAllMocks();
  });

  it('should compute owned ERC-721 tokenIds from transfer logs', async () => {
    const getLogs = vi
      .fn()
      .mockResolvedValueOnce([
        { args: { tokenId: 1n } },
        { args: { tokenId: 2n } },
        { args: { tokenId: 3n } },
      ])
      .mockResolvedValueOnce([
        { args: { tokenId: 2n } },
      ]);

    vi.mocked(rpcClientManager.getPublicClient).mockReturnValue({
      getLogs,
    } as any);

    const owned = await service.getOwnedErc721TokenIds(
      43113,
      '0x1111111111111111111111111111111111111111' as Address,
      '0x2222222222222222222222222222222222222222' as Address
    );

    expect(owned).toEqual(['1', '3']);
    expect(getLogs).toHaveBeenCalledTimes(2);
  });

  it('should send safeTransferFrom via transaction relayer', async () => {
    vi.mocked(transactionRelayer.sendTransaction).mockResolvedValue(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );

    const txHash = await service.transferErc721(
      '0x1111111111111111111111111111111111111111',
      43113,
      '0x3333333333333333333333333333333333333333',
      '0x4444444444444444444444444444444444444444',
      42n,
      '0x1234567890123456789012345678901234567890123456789012345678901234'
    );

    expect(txHash).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(transactionRelayer.sendTransaction).toHaveBeenCalledTimes(1);
    expect(transactionRelayer.sendTransaction).toHaveBeenCalledWith(
      '0x1111111111111111111111111111111111111111',
      43113,
      '0x3333333333333333333333333333333333333333',
      expect.stringMatching(/^0x[0-9a-f]+$/),
      '0x1234567890123456789012345678901234567890123456789012345678901234',
      0n,
      undefined
    );
  });
});
