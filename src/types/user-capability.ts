import type { Address } from 'viem';
import type { AccountInfo, UserType } from '@/types';

export type WalletCommonCapability =
  | 'guardian_manage'
  | 'scheduled_mint_nft'
  | 'two_phase_commit_hash_reveal'
  | 'nft_query_owned'
  | 'nft_trade';

export type WalletSponsorCapability = 'deploy_contract_on_bound_chain';

export interface WalletRoleCapabilitySnapshot {
  account: AccountInfo;
  userType: UserType;
  commonCapabilities: WalletCommonCapability[];
  sponsorCapabilities: WalletSponsorCapability[];
}

export interface SimpleToStandardEligibility {
  eligible: boolean;
  guardianCount: number;
  requiredGuardianCountInclusive: number;
}

export interface StandardToSponsorEligibility {
  eligible: boolean;
  gasPayerAddress: Address;
  currentNativeBalance: bigint;
  requiredNativeBalance: bigint;
  requiredNativeBalanceDisplay: string;
}
