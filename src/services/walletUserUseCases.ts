import { AccountCreationPath, UserType } from '@/types';

export interface WalletUserUseCase {
  userType: UserType;
  creationPath: AccountCreationPath;
  title: string;
  summary: string;
  loginHint: string;
  registerHint: string;
  securityReminder: string;
}

export const WALLET_USER_USE_CASES: WalletUserUseCase[] = [
  {
    userType: UserType.SIMPLE,
    creationPath: AccountCreationPath.PATH_A_SIMPLE,
    title: '路径A：极简体验（新手）',
    summary: '无 EOA 也可使用，由赞助商代付 Gas，适合快速上手。',
    loginHint: '已有账户先登录解锁后继续操作。',
    registerHint: '新用户注册后进入路径A创建账户。',
    securityReminder: '请妥善保管密码与私钥，不截图、不外传。',
  },
  {
    userType: UserType.STANDARD,
    creationPath: AccountCreationPath.PATH_B_STANDARD,
    title: '路径B：标准模式（进阶）',
    summary: '支持 EOA 管理与自付 Gas，适合有链上经验用户。',
    loginHint: '已有账户登录后可继续使用自付模式。',
    registerHint: '新用户注册后进入路径B配置账户。',
    securityReminder: '请妥善保管密码与私钥，不截图、不外传。',
  },
  {
    userType: UserType.SPONSOR,
    creationPath: AccountCreationPath.PATH_C_SPONSOR,
    title: '路径C：成为赞助商',
    summary: '完成赞助商注册后可为他人代付与审核。',
    loginHint: '已有赞助商账户请先登录再进入控制台。',
    registerHint: '新用户注册后进入路径C完成赞助商申请。',
    securityReminder: '请妥善保管密码与私钥，不截图、不外传。',
  },
];

export function getWalletUserUseCase(userType: UserType): WalletUserUseCase {
  const found = WALLET_USER_USE_CASES.find((item) => item.userType === userType);
  if (!found) {
    throw new Error(`Unsupported user type: ${userType}`);
  }
  return found;
}

