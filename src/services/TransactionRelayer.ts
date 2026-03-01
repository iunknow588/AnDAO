/**
 * 交易中继器
 * 
 * 负责构造和发送 UserOperation
 * 使用 kernel-dev 中的 UserOperation 类型定义
 * 支持多链（Mantle 优先）
 */

import { type Address, type Hash, type Hex } from 'viem';
import { Transaction, ChainConfig } from '@/types';
import { requireChainConfig } from '@/utils/chainConfigValidation';
import { bundlerClient } from './BundlerClient';
import { rpcClientManager } from '@/utils/RpcClientManager';
import { BundlerUnavailableError } from './BundlerClient';
import { accountManager } from './AccountManager';
import { applicationRegistryClient } from './ApplicationRegistryClient';
import { ErrorCode, WalletError } from '@/utils/errors';

/**
 * 降级模式错误
 * 
 * 当所有 Bundler 不可用时，抛出此错误，提示用户可以选择降级模式（自付 Gas）
 */
export class FallbackModeError extends Error {
  code = 'FALLBACK_MODE_AVAILABLE';
  estimatedGas: bigint;
  constructor(message: string, estimatedGas: bigint) {
    super(message);
    this.name = 'FallbackModeError';
    this.estimatedGas = estimatedGas;
  }
}

/**
 * 从 kernel-types 导入 UserOperation 类型
 * 
 * 使用统一的类型导入辅助模块
 * 
 * @see utils/kernel-types.ts
 */
import type { UserOperation } from '@/utils/kernel-types';

export interface SponsorPolicyContext {
  sponsored?: boolean;
  sponsorId?: string;
  ownerAddress?: Address;
  eoaAddress?: Address | null;
}

export class TransactionRelayer {
  /**
   * 发送单笔交易
   * 
   * @param accountAddress 智能合约账户地址
   * @param chainId 链 ID
   * @param target 目标地址
   * @param data 调用数据
   * @param ownerPrivateKey owner 的私钥（必需，用于签名 UserOperation，供 Validator 验证）
   *                        注意：这是账户 owner 的私钥，不是账户合约的私钥
   * @returns 交易哈希
   */
  async sendTransaction(
    accountAddress: Address,
    chainId: number,
    target: Address,
    data: string,
    ownerPrivateKey: `0x${string}`,
    value: bigint = BigInt(0),
    sponsorPolicyContext?: SponsorPolicyContext
  ): Promise<Hash> {
    const chainConfig = requireChainConfig(chainId, ['rpcUrl']);
    if (!chainConfig.bundlerUrl) {
      throw new BundlerUnavailableError(`Bundler URL not configured for chain: ${chainId}`);
    }
    await this.enforceSponsorPolicyGate(accountAddress, chainId, [target], sponsorPolicyContext);

    // 构造 UserOperation
    const userOp = await this.buildUserOperation(accountAddress, chainId, target, data, value);

    // 签名 UserOperation
    const signedUserOp = await this.signUserOperation(userOp, chainId, ownerPrivateKey);

    // 发送到 Bundler
    const txHash = await this.sendToBundler(signedUserOp, chainConfig.bundlerUrl, chainId);
    await this.recordPaymasterUsageIfNeeded(signedUserOp, chainConfig, txHash);
    return txHash;
  }

  /**
   * 发送批量交易
   * 
   * 将多个交易打包成一个 UserOperation，使用 Kernel 的 executeBatch 方法
   * 
   * @param accountAddress 智能合约账户地址
   * @param chainId 链 ID
   * @param transactions 交易列表
   * @param ownerPrivateKey owner 的私钥（必需，用于签名 UserOperation）
   * @returns 交易哈希
   */
  async sendBatch(
    accountAddress: Address,
    chainId: number,
    transactions: Transaction[],
    ownerPrivateKey: `0x${string}`,
    sponsorPolicyContext?: SponsorPolicyContext
  ): Promise<Hash> {
    const chainConfig = requireChainConfig(chainId, ['rpcUrl']);
    if (!chainConfig.bundlerUrl) {
      throw new BundlerUnavailableError(`Bundler URL not configured for chain: ${chainId}`);
    }

    if (transactions.length === 0) {
      throw new Error('No transactions to batch');
    }
    await this.enforceSponsorPolicyGate(
      accountAddress,
      chainId,
      transactions.map((tx) => tx.to as Address),
      sponsorPolicyContext
    );

    // 构造批量交易的 callData
    const { encodeExecuteBatchCallData } = await import('@/utils/kernel');
    const targets = transactions.map(tx => tx.to as Address);
    const values = transactions.map(tx => tx.value);
    const datas = transactions.map(tx => tx.data as `0x${string}`);
    
    const callData = encodeExecuteBatchCallData(targets, values, datas);

    // 构造 UserOperation
    const userOp = await this.buildUserOperation(accountAddress, chainId, accountAddress, callData);

    // 签名 UserOperation
    const signedUserOp = await this.signUserOperation(userOp, chainId, ownerPrivateKey);

    // 发送到 Bundler
    return this.sendToBundler(signedUserOp, chainConfig.bundlerUrl, chainId);
  }

  /**
   * 构造 UserOperation
   */
  private async buildUserOperation(
    accountAddress: Address,
    chainId: number,
    target: Address,
    data: string,
    value: bigint = BigInt(0)
  ): Promise<UserOperation> {
    const chainConfig = requireChainConfig(chainId);

    // 使用 RpcClientManager 获取缓存的 PublicClient 实例
    const publicClient = rpcClientManager.getPublicClient(chainId);

    // 获取账户 nonce
    const nonce = await this.getAccountNonce(accountAddress, chainId);

    // 获取当前 Gas 价格
    const gasPrice = await publicClient.getGasPrice();
    const maxPriorityFeePerGas = gasPrice / BigInt(2);

    // 构造 callData（调用 Kernel 的 execute 方法）
    const callData = await this.buildExecuteCallData(target, value, data);

    // 构造临时 UserOperation 用于 Gas 估算
    const tempUserOp: Partial<UserOperation> = {
      sender: accountAddress,
      nonce: nonce,
      initCode: '0x', // 账户已存在，不需要初始化代码
      callData: callData as Hex,
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      paymasterAndData: (chainConfig.paymasterAddress || '0x') as Hex,
    };

    // 估算 Gas
    const gasEstimate = await this.estimateGas(
      accountAddress,
      chainId,
      callData,
      tempUserOp,
      chainConfig.bundlerUrl || ''
    );

    // 构造完整的 UserOperation
    const userOp: UserOperation = {
      sender: accountAddress,
      nonce: nonce,
      initCode: '0x', // 账户已存在，不需要初始化代码
      callData: callData as Hex,
      callGasLimit: gasEstimate.callGasLimit,
      verificationGasLimit: gasEstimate.verificationGasLimit,
      preVerificationGas: gasEstimate.preVerificationGas,
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      paymasterAndData: (chainConfig.paymasterAddress || '0x') as Hex,
      signature: '0x', // 将在签名步骤填充
    };

    return userOp;
  }

  /**
   * 预览交易（不签名、不发送）
   * 
   * 返回构造好的 UserOperation 以及估算费用，供前端展示
   */
  async previewTransaction(
    accountAddress: Address,
    chainId: number,
    target: Address,
    data: string,
    value: bigint = BigInt(0)
  ): Promise<{
    userOp: UserOperation;
    estimatedFee: bigint;
  }> {
    const userOp = await this.buildUserOperation(accountAddress, chainId, target, data, value);
    const estimatedFee =
      (userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas) *
      userOp.maxFeePerGas;

    return { userOp, estimatedFee };
  }

  /**
   * 签名 UserOperation
   * 
   * 签名流程（符合 ERC-4337 和 Kernel 规范）：
   * 1. 计算 UserOperation 哈希（使用 EIP-712 方式）
   * 2. 使用 owner 私钥签名哈希（EIP-191 标准）
   * 3. 签名供 MultiChainValidator 验证使用
   * 
   * @param userOp UserOperation 对象
   * @param chainId 链 ID
   * @param ownerPrivateKey owner 的私钥（用于签名 UserOperation，供 Validator 验证）
   * @returns 签名后的 UserOperation
   */
  private async signUserOperation(
    userOp: UserOperation,
    chainId: number,
    ownerPrivateKey: `0x${string}`
  ): Promise<UserOperation> {
    const chainConfig = requireChainConfig(chainId, ['entryPointAddress', 'rpcUrl']);

    // 1. 计算 UserOperation 哈希（EIP-712）
    const { getUserOpHash } = await import('@/utils/eip712');
    getUserOpHash(userOp, chainConfig.entryPointAddress as `0x${string}`, chainId);

    // 2. 使用 owner 私钥签名哈希（EIP-191）
    const { signUserOperation } = await import('@/utils/eip712');
    const signature = await signUserOperation(
      userOp,
      chainConfig.entryPointAddress as `0x${string}`,
      chainId,
      ownerPrivateKey,
      chainConfig.rpcUrl
    );

    return {
      ...userOp,
      signature: signature,
    };
  }

  /**
   * 发送 UserOperation 到 Bundler
   * 
   * 如果所有 Bundler 失败，会抛出 FallbackModeError，提示用户可以选择降级模式
   */
  private async sendToBundler(
    userOp: UserOperation,
    bundlerUrl: string,
    chainId: number
  ): Promise<Hash> {
    // 确保 bundler 注册并设置当前链
    bundlerClient.ensureBundler({
      url: bundlerUrl,
      name: bundlerUrl,
      priority: 1,
      chainId,
    });
    bundlerClient.setBundler(bundlerUrl, chainId);
    bundlerClient.setChainId(chainId);

    try {
      return await bundlerClient.sendUserOperation(userOp, chainId);
    } catch (error) {
      if (error instanceof BundlerUnavailableError) {
        // 所有 Bundler 失败，尝试降级模式
        // 估算降级模式所需的 Gas
        const estimatedGas = await bundlerClient.estimateDirectGas(userOp, chainId);
        
        // 抛出降级模式错误，让 UI 层处理用户确认
        throw new FallbackModeError(
          '所有 Bundler 服务不可用。您可以选择自付 Gas 直接发送交易。',
          estimatedGas
        );
      }
      throw error;
    }
  }

  /**
   * 降级模式：直发 EntryPoint + 自付 Gas
   * 
   * 当所有 Bundler 不可用时，直接调用 EntryPoint 合约
   * 用户需要自付 Gas，账户需要有足够的余额
   * 
   * 注意：
   * - 需要用户确认（因为需要自付 Gas）
   * - 需要检查账户余额
   * - 如果切换了 RPC，需要重新计算 userOpHash 并重新签名
   * 
   * @param accountAddress 智能合约账户地址
   * @param chainId 链 ID
   * @param target 目标地址
   * @param data 调用数据
   * @param ownerPrivateKey owner 的私钥（用于签名 UserOperation）
   * @param signerPrivateKey 签名者私钥（用于发送交易，需要账户有余额）
   * @param value 转账金额
   * @param newRpcUrl 新的 RPC URL（如果切换了 RPC，需要重新计算 hash）
   * @returns 交易哈希
   */
  async sendTransactionWithFallback(
    accountAddress: Address,
    chainId: number,
    target: Address,
    data: string,
    ownerPrivateKey: `0x${string}`,
    signerPrivateKey: `0x${string}`,
    value: bigint = BigInt(0),
    newRpcUrl?: string
  ): Promise<Hash> {
    requireChainConfig(chainId, ['rpcUrl', 'entryPointAddress']);

    // 如果提供了新的 RPC URL，需要重新计算 userOpHash 并重新签名
    let userOp: UserOperation;
    if (newRpcUrl) {
      // 使用新的 RPC URL 重新构造 UserOperation
      userOp = await this.buildUserOperation(accountAddress, chainId, target, data, value);
      
      // 重新签名（因为 userOpHash 可能因为 RPC 切换而改变）
      userOp = await this.signUserOperation(userOp, chainId, ownerPrivateKey);
    } else {
      // 使用原有配置构造 UserOperation
      userOp = await this.buildUserOperation(accountAddress, chainId, target, data, value);
      userOp = await this.signUserOperation(userOp, chainId, ownerPrivateKey);
    }

    // 使用降级模式发送
    return await bundlerClient.sendUserOperationDirectly(userOp, chainId, signerPrivateKey);
  }

  /**
   * 获取账户 nonce
   * 
   * 对于未部署的账户，返回 0
   */
  private async getAccountNonce(accountAddress: Address, chainId: number): Promise<bigint> {
    const chainConfig = requireChainConfig(chainId, ['entryPointAddress', 'rpcUrl']);

    // 检查账户是否已部署
    const accountInfo = await accountManager.getAccountByAddress(accountAddress, chainId);
    
    if (!accountInfo || accountInfo.status !== 'deployed') {
      // 未部署账户，nonce 为 0
      return BigInt(0);
    }

    try {
      const { getAccountNonce } = await import('@/utils/kernel');
      return await getAccountNonce(
        chainConfig.entryPointAddress as Address,
        accountAddress,
        chainConfig.rpcUrl
      );
    } catch (error) {
      // 如果获取失败，可能是账户未部署，返回 0
      console.warn('Failed to get nonce, assuming 0:', error);
      return BigInt(0);
    }
  }

  /**
   * 构造 execute 调用数据
   */
  private async buildExecuteCallData(target: Address, value: bigint, data: string): Promise<string> {
    const { encodeExecuteCallData } = await import('@/utils/kernel');
    return encodeExecuteCallData(target, value, data as `0x${string}`);
  }

  /**
   * 估算 Gas
   */
  private async estimateGas(
    accountAddress: Address,
    chainId: number,
    callData: string,
    userOp: Partial<UserOperation>,
    bundlerUrl: string
  ): Promise<{
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
  }> {
    // 使用 Bundler 的 estimateUserOperationGas 方法
    const tempUserOp: UserOperation = {
      sender: accountAddress,
      nonce: userOp.nonce || BigInt(0),
      initCode: '0x',
      callData: callData as Hex,
      callGasLimit: BigInt(0),
      verificationGasLimit: BigInt(0),
      preVerificationGas: BigInt(0),
      maxFeePerGas: userOp.maxFeePerGas || BigInt(0),
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas || BigInt(0),
      paymasterAndData: (userOp.paymasterAndData || '0x') as Hex,
      signature: '0x',
    };

    try {
      bundlerClient.ensureBundler({
        url: bundlerUrl,
        name: bundlerUrl,
        priority: 1,
        chainId,
      });
      bundlerClient.setBundler(bundlerUrl, chainId);
      bundlerClient.setChainId(chainId);
      return await bundlerClient.estimateUserOperationGas(tempUserOp, chainId);
    } catch (error) {
      console.warn('Gas estimation failed, using fallback estimation:', error);
      
      // 降级方案：智能估算
      const chainConfig = requireChainConfig(chainId);

      // 使用链配置的默认值（如果配置了）
      if (chainConfig.defaultGasLimits) {
        return chainConfig.defaultGasLimits;
      }

      // 基于 callData 大小估算
      const callDataSize = (callData.length - 2) / 2; // 去除 0x 前缀
      const baseCallGas = BigInt(21000); // 基础交易 Gas
      const dataGas = BigInt(callDataSize) * BigInt(16); // 每字节 16 gas
      const callGasLimit = baseCallGas + dataGas + BigInt(50000); // 额外缓冲

      // 根据链类型估算 verificationGasLimit
      const baseVerificationGas = chainConfig.chainId === 5000 // Mantle
        ? BigInt(100000)
        : BigInt(150000);

      const preVerificationGas = BigInt(50000);

      return {
        callGasLimit,
        verificationGasLimit: baseVerificationGas,
        preVerificationGas,
      };
    }
  }

  /**
   * 记录 Paymaster 使用历史（仅当 paymasterAndData 非空时）
   */
  private async recordPaymasterUsageIfNeeded(
    userOp: UserOperation,
    chainConfig: ChainConfig,
    txHash: Hash
  ): Promise<void> {
    try {
      if (!userOp.paymasterAndData || userOp.paymasterAndData === '0x') {
        return;
      }

      // paymasterAndData 前 20 字节为地址
      const paymasterAddress = (`0x${userOp.paymasterAndData.slice(2, 42)}`) as Address;

      const { paymasterService } = await import('./PaymasterService');
      await paymasterService.recordUsage({
        txHash,
        chainId: chainConfig.chainId,
        paymasterAndData: userOp.paymasterAndData,
        paymasterAddress,
        sender: userOp.sender as Address,
        createdAt: Date.now(),
        status: 'pending',
      });
    } catch (error) {
      console.warn('Failed to record paymaster usage:', error);
    }
  }

  private async enforceSponsorPolicyGate(
    accountAddress: Address,
    chainId: number,
    targets: Address[],
    context?: SponsorPolicyContext
  ): Promise<void> {
    const chainConfig = requireChainConfig(chainId);
    if (context?.sponsored === false) {
      return;
    }
    if (!chainConfig.paymasterAddress) {
      return;
    }
    if (!applicationRegistryClient.isInitialized()) {
      throw new WalletError(
        'SPONSOR_POLICY_UNAVAILABLE: ApplicationRegistry contract is not initialized',
        ErrorCode.CONTRACT_ERROR
      );
    }

    const account = await accountManager.getAccountByAddress(accountAddress, chainId);
    if (!account) {
      throw new WalletError(
        `Account not found for sponsor policy gate: ${accountAddress}`,
        ErrorCode.ACCOUNT_NOT_FOUND
      );
    }

    const sponsorAddress = this.resolveSponsorAddress(context?.sponsorId || account.sponsorId);
    if (!sponsorAddress) {
      return;
    }

    const ownerAddress = context?.ownerAddress || account.owner as Address;
    const eoaAddress =
      typeof context?.eoaAddress !== 'undefined'
        ? context.eoaAddress
        : (account.eoaAddress ? account.eoaAddress as Address : null);
    for (const target of targets) {
      const allowed = await applicationRegistryClient.canSponsorFor(
        chainId,
        sponsorAddress,
        target,
        ownerAddress,
        eoaAddress
      );
      if (!allowed) {
        throw new WalletError(
          `SPONSOR_POLICY_BLOCKED: sponsor=${sponsorAddress} target=${target}`,
          ErrorCode.VALIDATION_ERROR
        );
      }
    }
  }

  private resolveSponsorAddress(sponsorId?: string): Address | null {
    if (!sponsorId) {
      return null;
    }
    if (/^0x[a-fA-F0-9]{40}$/.test(sponsorId)) {
      return sponsorId as Address;
    }
    const embeddedAddress = sponsorId.match(/sponsor-(0x[a-fA-F0-9]{40})-/);
    return embeddedAddress ? embeddedAddress[1] as Address : null;
  }
}

export const transactionRelayer = new TransactionRelayer();
