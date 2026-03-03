import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountCreationPath, UserType } from '@/types';
import { transactionRelayer } from '@/services/TransactionRelayer';
import { SponsorService } from '@/services/SponsorService';

describe('SponsorService.deployContractOnBoundChain', () => {
  let service: SponsorService;

  beforeEach(() => {
    service = new SponsorService();
    vi.restoreAllMocks();
  });

  it('should deploy on bound chain for sponsor account', async () => {
    (service as any).accountManager = {
      getAccountByAddress: vi.fn().mockResolvedValue({
        address: '0x1111111111111111111111111111111111111111',
        owner: '0x2222222222222222222222222222222222222222',
        chainId: 43113,
        createdAt: Date.now(),
        status: 'deployed',
        userType: UserType.SPONSOR,
        creationPath: AccountCreationPath.PATH_C_SPONSOR,
      }),
    };
    (service as any).keyManagerService = {
      getPrivateKeyFromSession: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
      getPrivateKey: vi.fn(),
    };
    const sendSpy = vi
      .spyOn(transactionRelayer, 'sendTransaction')
      .mockResolvedValue('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

    const txHash = await service.deployContractOnBoundChain({
      sponsorAccountAddress: '0x1111111111111111111111111111111111111111',
      chainId: 43113,
      bytecode: '0x60006000',
    });

    expect(txHash).toMatch(/^0x/);
    expect(sendSpy).toHaveBeenCalledWith(
      '0x1111111111111111111111111111111111111111',
      43113,
      '0x0000000000000000000000000000000000000000',
      '0x60006000',
      expect.any(String),
      0n,
      undefined
    );
  });

  it('should reject deploy when chain binding mismatches', async () => {
    (service as any).accountManager = {
      getAccountByAddress: vi.fn().mockResolvedValue({
        address: '0x1111111111111111111111111111111111111111',
        owner: '0x2222222222222222222222222222222222222222',
        chainId: 43114,
        createdAt: Date.now(),
        status: 'deployed',
        userType: UserType.SPONSOR,
        creationPath: AccountCreationPath.PATH_C_SPONSOR,
      }),
    };
    (service as any).keyManagerService = {
      getPrivateKeyFromSession: vi.fn(),
      getPrivateKey: vi.fn(),
    };

    await expect(
      service.deployContractOnBoundChain({
        sponsorAccountAddress: '0x1111111111111111111111111111111111111111',
        chainId: 43113,
        bytecode: '0x60006000',
      })
    ).rejects.toThrow(/chain-bound/);
  });
});
