import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountCreationPath, UserType, type AccountInfo } from '@/types';
import { guardianService } from '@/services/GuardianService';
import { rpcClientManager } from '@/utils/RpcClientManager';
import { UserCapabilityService } from '@/services/UserCapabilityService';

describe('UserCapabilityService', () => {
  let service: UserCapabilityService;

  beforeEach(() => {
    service = new UserCapabilityService();
    vi.restoreAllMocks();
  });

  it('should require guardian count >= 3 for simple -> standard', async () => {
    vi.spyOn(guardianService, 'getGuardians').mockResolvedValueOnce([
      { address: '0x1', addedAt: Date.now() },
      { address: '0x2', addedAt: Date.now() },
    ] as any);

    const notEligible = await service.evaluateSimpleToStandardEligibility(
      '0x1234567890123456789012345678901234567890',
      43113
    );
    expect(notEligible.eligible).toBe(false);
    expect(notEligible.requiredGuardianCountInclusive).toBe(3);

    vi.spyOn(guardianService, 'getGuardians').mockResolvedValueOnce([
      { address: '0x1', addedAt: Date.now() },
      { address: '0x2', addedAt: Date.now() },
      { address: '0x3', addedAt: Date.now() },
    ] as any);

    const exactlyEligible = await service.evaluateSimpleToStandardEligibility(
      '0x1234567890123456789012345678901234567890',
      43113
    );
    expect(exactlyEligible.eligible).toBe(true);
    expect(exactlyEligible.guardianCount).toBe(3);

    vi.spyOn(guardianService, 'getGuardians').mockResolvedValueOnce([
      { address: '0x1', addedAt: Date.now() },
      { address: '0x2', addedAt: Date.now() },
      { address: '0x3', addedAt: Date.now() },
      { address: '0x4', addedAt: Date.now() },
    ] as any);

    const eligible = await service.evaluateSimpleToStandardEligibility(
      '0x1234567890123456789012345678901234567890',
      43113
    );
    expect(eligible.eligible).toBe(true);
  });

  it('should require native balance >= 10 for standard -> sponsor by default', async () => {
    const account: AccountInfo = {
      address: '0x1111111111111111111111111111111111111111',
      chainId: 43113,
      owner: '0x2222222222222222222222222222222222222222',
      createdAt: Date.now(),
      status: 'deployed',
      userType: UserType.STANDARD,
      creationPath: AccountCreationPath.PATH_B_STANDARD,
      eoaAddress: '0x3333333333333333333333333333333333333333',
    };

    vi.spyOn(rpcClientManager, 'getPublicClient').mockReturnValue({
      getBalance: vi.fn().mockResolvedValueOnce(9_000000000000000000n),
    } as any);

    const low = await service.evaluateStandardToSponsorEligibility(account);
    expect(low.eligible).toBe(false);

    vi.spyOn(rpcClientManager, 'getPublicClient').mockReturnValue({
      getBalance: vi.fn().mockResolvedValueOnce(10_000000000000000000n),
    } as any);
    const high = await service.evaluateStandardToSponsorEligibility(account);
    expect(high.eligible).toBe(true);
  });

  it('should enforce sponsor chain binding', () => {
    const sponsor: AccountInfo = {
      address: '0x1111111111111111111111111111111111111111',
      chainId: 43114,
      owner: '0x2222222222222222222222222222222222222222',
      createdAt: Date.now(),
      status: 'deployed',
      userType: UserType.SPONSOR,
      creationPath: AccountCreationPath.PATH_C_SPONSOR,
    };

    expect(() => service.assertSponsorChainBinding(sponsor, 43114)).not.toThrow();
    expect(() => service.assertSponsorChainBinding(sponsor, 43113)).toThrow(/chain-bound/);
  });
});
