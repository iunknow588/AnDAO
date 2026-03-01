import { describe, expect, it } from 'vitest';
import { UserType } from '@/types';
import { WALLET_USER_USE_CASES, getWalletUserUseCase } from '@/services/walletUserUseCases';

describe('walletUserUseCases', () => {
  it('应完整覆盖三种用户类型', () => {
    const userTypes = WALLET_USER_USE_CASES.map((item) => item.userType).sort();
    expect(userTypes).toEqual([UserType.SIMPLE, UserType.SPONSOR, UserType.STANDARD].sort());
  });

  it('每个用例都应包含登录、注册与安全提醒', () => {
    for (const item of WALLET_USER_USE_CASES) {
      expect(item.loginHint.length).toBeGreaterThan(0);
      expect(item.registerHint.length).toBeGreaterThan(0);
      expect(item.securityReminder).toContain('密码');
      expect(item.securityReminder).toContain('私钥');
    }
  });

  it('可按用户类型查询 use case', () => {
    const sponsor = getWalletUserUseCase(UserType.SPONSOR);
    expect(sponsor.title).toContain('路径C');
  });
});

