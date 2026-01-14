/**
 * 账户管理器
 * 
 * 负责管理智能合约账户的创建、恢复和查询
 * 直接使用 kernel-dev 中的 Factory 合约接口
 */

import { createPublicClient, http, type Address, type Hash, encodeFunctionData } from 'viem';
import { AccountInfo } from '@/types';
import { getChainConfigByChainId } from '@/config/chains';
import { storageAdapter } from '@/adapters/StorageAdapter';
import { StorageKey } from '@/types';

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
        // 为了兼容早期存储结构，在迁移过程中使用宽松的 any 类型，
        // 保证运行时行为不变，同时避免类型系统将旧数据推断为 never。
        const acc = account as any;
        // 如果账户没有status字段，需要检查是否已部署
        if (!('status' in acc)) {
          // 默认设置为deployed（假设已存在的账户都是已部署的）
          // 实际部署状态会在使用时通过accountExists检查
          return {
            ...acc,
            status: 'deployed' as const,
            deployedAt: acc.createdAt, // 使用创建时间作为部署时间
          } as AccountInfo;
        }
        return acc as AccountInfo;
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
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig || !chainConfig.kernelFactoryAddress) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

    const initData = await this.buildInitData(owner, chainId);
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
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    if (!chainConfig.kernelFactoryAddress) {
      throw new Error(`Kernel Factory address not configured for chain: ${chainId}`);
    }

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
    const initData = await this.buildInitData(owner, chainId);
    const salt = await this.generateSalt(owner, chainId);

    // 部署账户
    const { createAccount } = await import('@/utils/kernel');
    const { address: accountAddress, txHash } = await createAccount(
      chainConfig.kernelFactoryAddress as Address,
      initData,
      salt,
      chainConfig.rpcUrl,
      signerPrivateKey
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
   * Kernel.initialize(
   *   ValidationId _rootValidator,
   *   IHook hook,
   *   bytes calldata validatorData,
   *   bytes calldata hookData,
   *   bytes[] calldata initConfig
   * )
   */
  private async buildInitData(owner: Address, chainId: number): Promise<`0x${string}`> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

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
   */
  async accountExists(address: Address, chainId: number): Promise<boolean> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      return false;
    }

    const publicClient = createPublicClient({
      transport: http(chainConfig.rpcUrl),
    });

    // 检查账户合约是否已部署（检查 code 是否为空）
    const code = await publicClient.getBytecode({ address });
    return code !== undefined && code !== '0x';
  }
}


export const accountManager = new AccountManager();

