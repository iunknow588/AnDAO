import { formatUnits, parseUnits, type Address } from 'viem';
import { AccountCreationPath, type AccountInfo, UserType } from '@/types';
import {
  type SimpleToStandardEligibility,
  type StandardToSponsorEligibility,
  type WalletRoleCapabilitySnapshot,
} from '@/types/user-capability';
import { guardianService } from '@/services/GuardianService';
import { requireChainConfig } from '@/utils/chainConfigValidation';
import { rpcClientManager } from '@/utils/RpcClientManager';

const COMMON_CAPABILITIES = [
  'guardian_manage',
  'scheduled_mint_nft',
  'two_phase_commit_hash_reveal',
  'nft_query_owned',
  'nft_trade',
] as const;

const SPONSOR_CAPABILITIES = ['deploy_contract_on_bound_chain'] as const;

/**
 * 用户能力与升级策略服务
 *
 * 目标：
 * - 统一三类用户能力矩阵
 * - 提供“路径A -> 路径B”与“路径B -> 路径C”的可执行资格判定
 * - 明确赞助商“按链绑定”的权限边界
 */
export class UserCapabilityService {
  readonly simpleToStandardGuardianThresholdInclusive = 3;
  readonly standardToSponsorDefaultNativeThreshold = '10';

  getRoleCapabilities(account: AccountInfo): WalletRoleCapabilitySnapshot {
    const userType = account.userType || this.inferUserType(account);
    return {
      account,
      userType,
      commonCapabilities: [...COMMON_CAPABILITIES],
      sponsorCapabilities: userType === UserType.SPONSOR ? [...SPONSOR_CAPABILITIES] : [],
    };
  }

  /**
   * 简易用户升级条件：守护人数量必须“大于等于3个”
   */
  async evaluateSimpleToStandardEligibility(
    accountAddress: Address,
    chainId: number
  ): Promise<SimpleToStandardEligibility> {
    const guardians = await guardianService.getGuardians(accountAddress, chainId);
    const guardianCount = guardians.length;
    return {
      eligible: guardianCount >= this.simpleToStandardGuardianThresholdInclusive,
      guardianCount,
      requiredGuardianCountInclusive: this.simpleToStandardGuardianThresholdInclusive,
    };
  }

  /**
   * 标准用户升级赞助商条件：Gas 账户余额达到给定链阈值（默认 10 原生代币）
   */
  async evaluateStandardToSponsorEligibility(
    account: AccountInfo,
    options?: {
      gasPayerAddress?: Address;
      minNativeAmount?: string;
    }
  ): Promise<StandardToSponsorEligibility> {
    const chainConfig = requireChainConfig(account.chainId, ['rpcUrl']);
    const decimals = chainConfig.nativeCurrency.decimals;
    const minNativeAmount = options?.minNativeAmount || this.standardToSponsorDefaultNativeThreshold;
    const requiredNativeBalance = parseUnits(minNativeAmount, decimals);

    const gasPayerAddress =
      options?.gasPayerAddress ||
      (account.eoaAddress as Address | undefined) ||
      (account.owner as Address);

    const publicClient = rpcClientManager.getPublicClient(account.chainId);
    const currentNativeBalance = await publicClient.getBalance({
      address: gasPayerAddress,
    });

    return {
      eligible: currentNativeBalance >= requiredNativeBalance,
      gasPayerAddress,
      currentNativeBalance,
      requiredNativeBalance,
      requiredNativeBalanceDisplay: `${formatUnits(requiredNativeBalance, decimals)} ${chainConfig.nativeCurrency.symbol}`,
    };
  }

  /**
   * 赞助商链绑定规则：仅可在“该赞助商账户所属链”执行部署类能力
   */
  assertSponsorChainBinding(account: AccountInfo, targetChainId: number): void {
    const userType = account.userType || this.inferUserType(account);
    if (userType !== UserType.SPONSOR || account.creationPath !== AccountCreationPath.PATH_C_SPONSOR) {
      throw new Error('Current account is not sponsor role');
    }
    if (account.chainId !== targetChainId) {
      throw new Error(
        `Sponsor role is chain-bound. account.chainId=${account.chainId}, targetChainId=${targetChainId}`
      );
    }
  }

  private inferUserType(account: AccountInfo): UserType {
    switch (account.creationPath) {
      case AccountCreationPath.PATH_A_SIMPLE:
        return UserType.SIMPLE;
      case AccountCreationPath.PATH_B_STANDARD:
        return UserType.STANDARD;
      case AccountCreationPath.PATH_C_SPONSOR:
        return UserType.SPONSOR;
      default:
        return UserType.STANDARD;
    }
  }
}

export const userCapabilityService = new UserCapabilityService();
