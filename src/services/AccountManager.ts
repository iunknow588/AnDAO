/**
 * 账户管理器
 * 
 * 负责管理智能合约账户的创建、恢复和查询
 * 直接使用 kernel-dev 中的 Factory 合约接口
 */

import { type Address, type Hash, encodeFunctionData } from 'viem';
import { AccountInfo, StorageKey, AccountCreationPath, UserType } from '@/types';
import { requireChainConfig } from '@/utils/chainConfigValidation';
import { storageAdapter } from '@/adapters/StorageAdapter';
import { rpcClientManager } from '@/utils/RpcClientManager';
import { keyManagerService } from './KeyManagerService';

export class AccountManager {
  private accounts: Map<string, AccountInfo> = new Map();

  /**
   * 生成账户 Map 使用的唯一键
   * 
   * @param address 账户地址
   * @param chainId 链 ID
   */
  private getAccountKey(address: string, chainId: number): string {
    return `${chainId}:${address.toLowerCase()}`;
  }

  /**
   * 初始化账户管理器
   * 
   * 加载账户列表，并对旧数据进行迁移（添加status字段）
   */
  async init(): Promise<void> {
    // 从存储加载账户列表
    const storedAccounts = await storageAdapter.get<AccountInfo[]>(StorageKey.ACCOUNTS);
    if (storedAccounts) {
      // 迁移旧数据：为没有status字段的账户添加status
      const migratedAccounts: AccountInfo[] = storedAccounts.map((account) => {
        // 如果账户没有status字段，需要检查是否已部署
        if (!account.status) {
          // 默认设置为deployed（假设已存在的账户都是已部署的）
          // 实际部署状态会在使用时通过accountExists检查
          return {
            ...account,
            status: 'deployed' as const,
            deployedAt: account.createdAt, // 使用创建时间作为部署时间
          } as AccountInfo;
        }
        return account;
      });

      // 保存迁移后的数据
      if (migratedAccounts.some((acc, idx) => acc !== storedAccounts[idx])) {
        await storageAdapter.set(StorageKey.ACCOUNTS, migratedAccounts);
      }

      migratedAccounts.forEach((account) => {
        this.accounts.set(this.getAccountKey(account.address, account.chainId), account);
      });
    }
  }

  /**
   * 预测账户地址（不涉及部署）
   * 
   * 仅计算账户地址，不保存账户信息，不部署合约
   * 
   * @param owner 账户所有者地址（签名者）
   * @param chainId 链 ID
   * @returns 预测的账户地址
   */
  async predictAccountAddress(owner: Address, chainId: number): Promise<Address> {
    const chainConfig = requireChainConfig(chainId, ['kernelFactoryAddress', 'rpcUrl']);

    const initData = this.buildInitData(owner, chainId);
    const salt = await this.generateSalt(owner, chainId);
    
    const { predictAccountAddress } = await import('@/utils/kernel');
    return predictAccountAddress(
      chainConfig.kernelFactoryAddress as Address,
      initData,
      salt,
      chainConfig.rpcUrl
    );
  }

  /**
   * 创建并部署账户（返回地址）
   * 
   * 实际部署账户合约到链上，并保存账户信息。
   * 这是一个便捷包装方法，仅返回地址，用于绝大部分前端调用场景。
   * 如需获取部署交易哈希，请使用 createAndDeployAccountWithTx。
   * 
   * @param owner 账户所有者地址（签名者）
   * @param chainId 链 ID
   * @param signerPrivateKey 签名者私钥（必需，用于部署账户）
   * @returns 部署的账户地址
   */
  async createAndDeployAccount(
    owner: Address, 
    chainId: number, 
    signerPrivateKey: `0x${string}`
  ): Promise<Address> {
    const { address } = await this.createAndDeployAccountWithTx(owner, chainId, signerPrivateKey);
    return address;
  }

  /**
   * 创建并部署账户（返回地址与交易哈希）
   * 
   * 在原有 createAndDeployAccount 的基础上，额外返回部署交易哈希，
   * 主要用于赞助商代付部署等需要链上追踪的场景。
   * 
   * @param owner 账户所有者地址（签名者）
   * @param chainId 链 ID
   * @param signerPrivateKey 签名者私钥（必需，用于部署账户）
   * @returns 包含账户地址与可选部署交易哈希的结果对象
   */
  async createAndDeployAccountWithTx(
    owner: Address,
    chainId: number,
    signerPrivateKey: `0x${string}`
  ): Promise<{ address: Address; txHash?: Hash }> {
    const chainConfig = requireChainConfig(chainId, ['kernelFactoryAddress', 'rpcUrl']);

    // 预测地址（用于幂等性检查）
    const predictedAddress = await this.predictAccountAddress(owner, chainId);
    
    // 检查是否已部署
    const existing = await this.getAccount(owner, chainId);
    if (existing?.status === 'deployed') {
      const deployed = await this.accountExists(predictedAddress, chainId);
      if (deployed) {
        return {
          address: predictedAddress,
          txHash: undefined,
        };
      }
    }

    // 构造初始化数据
    const initData = this.buildInitData(owner, chainId);
    const salt = await this.generateSalt(owner, chainId);

    // 部署账户
    const { createAccount } = await import('@/utils/kernel');
    const { address: accountAddress, txHash } = await createAccount(
      chainConfig.kernelFactoryAddress as Address,
      initData,
      salt,
      chainConfig.rpcUrl,
      signerPrivateKey,
      chainId
    );

    // 保存已部署账户信息
    const accountInfo: AccountInfo = {
      address: accountAddress,
      chainId,
      owner,
      createdAt: Date.now(),
      status: 'deployed',
      deployedAt: Date.now(),
    };

    this.accounts.set(this.getAccountKey(accountAddress, chainId), accountInfo);
    await this.saveAccounts();

    return {
      address: accountAddress,
      txHash,
    };
  }

  /**
   * 创建新账户（便捷方法）
   * 
   * 向后兼容方法，内部调用 createAndDeployAccount
   * 
   * @param owner 账户所有者地址（签名者）
   * @param chainId 链 ID
   * @param signerPrivateKey 签名者私钥（必需，用于部署账户）
   * @returns 创建的账户地址
   */
  async createAccount(owner: Address, chainId: number, signerPrivateKey: `0x${string}`): Promise<Address> {
    return this.createAndDeployAccount(owner, chainId, signerPrivateKey);
  }

  /**
   * 构造 Kernel 账户的初始化数据
   * 
   * 根据 Kernel 的实际初始化逻辑构造
   * 使用 MultiChainValidator 作为根验证器
   * 
   * 注意：此方法是同步的，所有操作都是纯计算，不需要异步
   * 
   * Kernel.initialize(
   *   ValidationId _rootValidator,
   *   IHook hook,
   *   bytes calldata validatorData,
   *   bytes calldata hookData,
   *   bytes[] calldata initConfig
   * )
   */
  private buildInitData(owner: Address, chainId: number): `0x${string}` {
    const chainConfig = requireChainConfig(chainId);

    // 从链配置中获取 MultiChainValidator 地址
    const multiChainValidatorAddress = chainConfig.multiChainValidatorAddress;
    
    if (!multiChainValidatorAddress || multiChainValidatorAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error(`MultiChainValidator address not configured for chain: ${chainId}. Please configure VITE_${chainConfig.name.toUpperCase().replace(/\s+/g, '_')}_MULTI_CHAIN_VALIDATOR_ADDRESS`);
    }

    // 构造 ValidationId
    // ValidationId 是 bytes21，格式为: validatorType (1 byte) + validatorAddress (20 bytes)
    // MODULE_TYPE_VALIDATOR = 1
    const validatorType = 1; // MODULE_TYPE_VALIDATOR
    const validationId = `0x${validatorType.toString(16).padStart(2, '0')}${multiChainValidatorAddress.slice(2)}`.slice(0, 44) as `0x${string}`; // 21 bytes = 42 hex chars + 0x

    // 构造 validatorData (MultiChainValidator 的 onInstall 数据)
    // MultiChainValidator.onInstall 接收 owner 地址（20 bytes）
    const validatorData = owner.slice(0, 42) as `0x${string}`; // owner 地址

    // hookData 为空（MultiChainValidator 也实现了 IHook，但初始化时可以为空）
    const hookData = '0x' as `0x${string}`;

    // initConfig 为空数组
    const initConfig: `0x${string}`[] = [];

    // 编码 Kernel.initialize 调用
    return encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: '_rootValidator', type: 'bytes21' },
            { name: 'hook', type: 'address' },
            { name: 'validatorData', type: 'bytes' },
            { name: 'hookData', type: 'bytes' },
            { name: 'initConfig', type: 'bytes[]' },
          ],
          name: 'initialize',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'initialize',
      args: [
        validationId,
        multiChainValidatorAddress as Address, // hook 地址（MultiChainValidator 也实现了 IHook）
        validatorData,
        hookData,
        initConfig,
      ],
    });
  }

  /**
   * 生成 salt
   */
  private async generateSalt(owner: Address, chainId: number): Promise<`0x${string}`> {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${owner}:${chainId}`);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hash));
    return `0x${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
  }

  /**
   * 获取账户地址
   * 
   * 优先返回已保存的账户地址，如果未找到则返回预测地址
   */
  async getAccountAddress(owner: Address, chainId: number): Promise<Address | null> {
    // 先查找已保存的账户
    const account = await this.getAccount(owner, chainId);
    if (account) {
      return account.address as Address;
    }
    
    // 如果未找到，返回预测地址（但不保存）
    return await this.predictAccountAddress(owner, chainId);
  }

  /**
   * 根据地址获取账户信息
   * 
   * @param address 账户地址
   * @param chainId 链 ID
   * @returns 账户信息，如果不存在则返回 null
   */
  async getAccountByAddress(address: Address, chainId: number): Promise<AccountInfo | null> {
    const key = this.getAccountKey(address, chainId);
    return this.accounts.get(key) || null;
  }

  /**
   * 获取账户信息
   */
  async getAccount(owner: Address, chainId: number): Promise<AccountInfo | null> {
    for (const account of this.accounts.values()) {
      if (account.owner.toLowerCase() === owner.toLowerCase() && account.chainId === chainId) {
        return account;
      }
    }
    return null;
  }

  /**
   * 获取所有账户
   */
  async getAllAccounts(): Promise<AccountInfo[]> {
    return Array.from(this.accounts.values());
  }

  /**
   * 保存账户列表到存储
   */
  private async saveAccounts(): Promise<void> {
    const accounts = Array.from(this.accounts.values());
    await storageAdapter.set(StorageKey.ACCOUNTS, accounts);
  }

  private async saveAccount(account: AccountInfo): Promise<void> {
    this.accounts.set(this.getAccountKey(account.address, account.chainId), account);
    await this.saveAccounts();
  }

  /**
   * 导入或更新账户信息
   * 
   * 用于处理用户导入已有账户的场景，使数据持久化
   * 
   * @param account 账户信息
   */
  async importAccount(account: AccountInfo): Promise<void> {
    const normalizedAccount: AccountInfo = {
      ...account,
      address: account.address as Address,
      status: account.status ?? 'deployed',
      createdAt: account.createdAt ?? Date.now(),
      deployedAt: account.deployedAt ?? (account.status === 'deployed' ? Date.now() : undefined),
    };

    this.accounts.set(
      this.getAccountKey(normalizedAccount.address, normalizedAccount.chainId),
      normalizedAccount
    );
    await this.saveAccounts();
  }

  /**
   * 检查账户是否存在
   * 
   * 使用缓存的 PublicClient 实例，避免重复创建
   */
  async accountExists(address: Address, chainId: number): Promise<boolean> {
    try {
      // 使用 RpcClientManager 获取缓存的 PublicClient 实例
      const publicClient = rpcClientManager.getPublicClient(chainId);

      // 检查账户合约是否已部署（检查 code 是否为空）
      const code = await publicClient.getBytecode({ address });
      return code !== undefined && code !== '0x';
    } catch (error) {
      // 如果链配置不存在或其他错误，返回 false
      return false;
    }
  }

  /**
   * 路径A升级为路径B
   * 
   * 当路径A用户（UserType.SIMPLE）的守护人数量达到3个时，可以升级为路径B（UserType.STANDARD）
   * 
   * 升级内容：
   * - 用户类型：UserType.SIMPLE → UserType.STANDARD
   * - 创建路径：PATH_A_SIMPLE → PATH_B_STANDARD
   * - 保留历史：originalCreationPath = PATH_A_SIMPLE
   * - 获得EOA能力：可以创建EOA账户，自主支付Gas（可选）
   * 
   * 注意：
   * - 升级后不降级：即使守护人减少，也保持标准用户身份
   * - EOA创建是可选的：用户可以选择立即创建EOA，也可以稍后创建
   * 
   * @param accountAddress 账户地址
   * @param chainId 链ID
   * @param createEOA 是否立即创建EOA账户（可选，默认为false）
   * @param eoaPrivateKey EOA私钥（如果createEOA为true，必须提供）
   * @returns 更新后的账户信息
   */
  async upgradePathA(
    accountAddress: Address,
    chainId: number,
    createEOA: boolean = false,
    eoaPrivateKey?: `0x${string}`
  ): Promise<AccountInfo> {
    const account = await this.getAccountByAddress(accountAddress, chainId);
    if (!account) {
      throw new Error(`Account not found: ${accountAddress}`);
    }

    // 检查是否为路径A用户
    const userType = account.userType;
    const creationPath = account.creationPath;

    if (userType !== UserType.SIMPLE || creationPath !== AccountCreationPath.PATH_A_SIMPLE) {
      throw new Error('Account is not a path A user, cannot upgrade');
    }

    // 如果已经升级过，直接返回
    if (account.originalCreationPath && account.originalCreationPath !== AccountCreationPath.PATH_A_SIMPLE) {
      return account;
    }

    // 更新账户信息
    const upgradedAccount: AccountInfo = {
      ...account,
      // 更新用户类型和创建路径
      userType: UserType.STANDARD,
      creationPath: AccountCreationPath.PATH_B_STANDARD,
      originalCreationPath: AccountCreationPath.PATH_A_SIMPLE,
    };

    // 如果用户选择立即创建EOA
    if (createEOA && eoaPrivateKey) {
      const eoaAddress = keyManagerService.getAddressFromPrivateKey(eoaPrivateKey);
      
      // 添加EOA地址到账户信息
      upgradedAccount.eoaAddress = eoaAddress;
    }

    // 保存更新后的账户信息
    await this.saveAccount(upgradedAccount);

    return upgradedAccount;
  }

  /**
   * 路径转换：路径A → 路径B（添加EOA账户）
   * 
   * 将路径A用户（UserType.SIMPLE）转换为路径B用户（UserType.STANDARD）
   * 通过添加EOA账户实现，使路径A用户获得自主支付Gas的能力
   * 
   * 转换内容：
   * - 用户类型：UserType.SIMPLE → UserType.STANDARD
   * - 创建路径：PATH_A_SIMPLE → PATH_B_STANDARD
   * - 保留历史：originalCreationPath = PATH_A_SIMPLE
   * - 添加EOA地址：eoaAddress = 新创建的EOA地址
   * 
   * @param accountAddress 账户地址
   * @param chainId 链ID
   * @param eoaPrivateKey EOA私钥（必需，用于创建EOA账户）
   * @returns 更新后的账户信息
   */
  async convertPathAToB(
    accountAddress: Address,
    chainId: number,
    eoaPrivateKey: `0x${string}`
  ): Promise<AccountInfo> {
    const account = await this.getAccountByAddress(accountAddress, chainId);
    if (!account) {
      throw new Error(`Account not found: ${accountAddress}`);
    }

    // 检查是否为路径A用户
    const userType = account.userType;
    const creationPath = account.creationPath;

    if (userType !== UserType.SIMPLE || creationPath !== AccountCreationPath.PATH_A_SIMPLE) {
      throw new Error('Account is not a path A user, cannot convert to path B');
    }

    // 获取EOA地址
    const eoaAddress = keyManagerService.getAddressFromPrivateKey(eoaPrivateKey);

    // 更新账户信息
    const convertedAccount: AccountInfo = {
      ...account,
      userType: UserType.STANDARD,
      creationPath: AccountCreationPath.PATH_B_STANDARD,
      originalCreationPath: AccountCreationPath.PATH_A_SIMPLE,
      eoaAddress: eoaAddress,
    };

    // 保存更新后的账户信息
    await this.saveAccount(convertedAccount);

    return convertedAccount;
  }

  /**
   * 路径转换：路径A → 路径C（注册成为赞助商）
   * 
   * 将路径A用户转换为路径C用户（赞助商）
   * 需要先完成赞助商注册流程，然后更新账户信息
   * 
   * 转换内容：
   * - 用户类型：UserType.SIMPLE → UserType.SPONSOR
   * - 创建路径：PATH_A_SIMPLE → PATH_C_SPONSOR
   * - 保留历史：originalCreationPath = PATH_A_SIMPLE
   * - 添加赞助商ID：sponsorId = 注册后的赞助商ID
   * - 添加EOA地址：eoaAddress = Gas支付账户地址
   * 
   * 注意：此方法仅更新账户信息，实际的赞助商注册需要通过SponsorService完成
   * 
   * @param accountAddress 账户地址
   * @param chainId 链ID
   * @param sponsorId 赞助商ID（从SponsorService.registerOnChain获取）
   * @param gasAccountPrivateKey Gas支付账户私钥（用于获取EOA地址）
   * @returns 更新后的账户信息
   */
  async convertPathAToC(
    accountAddress: Address,
    chainId: number,
    sponsorId: string,
    gasAccountPrivateKey: `0x${string}`
  ): Promise<AccountInfo> {
    const account = await this.getAccountByAddress(accountAddress, chainId);
    if (!account) {
      throw new Error(`Account not found: ${accountAddress}`);
    }

    // 检查是否为路径A用户
    const userType = account.userType;
    const creationPath = account.creationPath;

    if (userType !== UserType.SIMPLE || creationPath !== AccountCreationPath.PATH_A_SIMPLE) {
      throw new Error('Account is not a path A user, cannot convert to path C');
    }

    // 获取Gas账户地址
    const eoaAddress = keyManagerService.getAddressFromPrivateKey(gasAccountPrivateKey);

    // 更新账户信息
    const convertedAccount: AccountInfo = {
      ...account,
      userType: UserType.SPONSOR,
      creationPath: AccountCreationPath.PATH_C_SPONSOR,
      originalCreationPath: AccountCreationPath.PATH_A_SIMPLE,
      sponsorId: sponsorId,
      eoaAddress: eoaAddress,
    };

    // 保存更新后的账户信息
    await this.saveAccount(convertedAccount);

    return convertedAccount;
  }

  /**
   * 路径转换：路径B → 路径C（注册成为赞助商）
   * 
   * 将路径B用户转换为路径C用户（赞助商）
   * 需要先完成赞助商注册流程，然后更新账户信息
   * 
   * 转换内容：
   * - 用户类型：UserType.STANDARD → UserType.SPONSOR
   * - 创建路径：PATH_B_STANDARD → PATH_C_SPONSOR
   * - 保留历史：originalCreationPath = PATH_B_STANDARD
   * - 添加赞助商ID：sponsorId = 注册后的赞助商ID
   * - 保留EOA地址：eoaAddress（如果已有，保持不变；如果没有，使用Gas账户地址）
   * 
   * 注意：此方法仅更新账户信息，实际的赞助商注册需要通过SponsorService完成
   * 
   * @param accountAddress 账户地址
   * @param chainId 链ID
   * @param sponsorId 赞助商ID（从SponsorService.registerOnChain获取）
   * @param gasAccountPrivateKey Gas支付账户私钥（可选，如果账户已有EOA地址则不需要）
   * @returns 更新后的账户信息
   */
  async convertPathBToC(
    accountAddress: Address,
    chainId: number,
    sponsorId: string,
    gasAccountPrivateKey?: `0x${string}`
  ): Promise<AccountInfo> {
    const account = await this.getAccountByAddress(accountAddress, chainId);
    if (!account) {
      throw new Error(`Account not found: ${accountAddress}`);
    }

    // 检查是否为路径B用户
    const userType = account.userType;
    const creationPath = account.creationPath;

    if (userType !== UserType.STANDARD || creationPath !== AccountCreationPath.PATH_B_STANDARD) {
      throw new Error('Account is not a path B user, cannot convert to path C');
    }

    // 确定EOA地址
    let eoaAddress = account.eoaAddress;
    if (!eoaAddress && gasAccountPrivateKey) {
      eoaAddress = keyManagerService.getAddressFromPrivateKey(gasAccountPrivateKey);
    }

    // 更新账户信息
    const convertedAccount: AccountInfo = {
      ...account,
      userType: UserType.SPONSOR,
      creationPath: AccountCreationPath.PATH_C_SPONSOR,
      originalCreationPath: AccountCreationPath.PATH_B_STANDARD,
      sponsorId: sponsorId,
      eoaAddress: eoaAddress || account.eoaAddress,
    };

    // 保存更新后的账户信息
    await this.saveAccount(convertedAccount);

    return convertedAccount;
  }
}


export const accountManager = new AccountManager();
