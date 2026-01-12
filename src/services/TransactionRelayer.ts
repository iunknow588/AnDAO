/**
 * 交易中继器
 * 
 * 负责构造和发送 UserOperation
 * 使用 kernel-dev 中的 UserOperation 类型定义
 * 支持多链（Mantle 优先）
 */

import { createPublicClient, http, type Address, type Hash } from 'viem';
import { Transaction, ChainConfig } from '@/types';
import { getChainConfigByChainId } from '@/config/chains';
import { bundlerClient } from './BundlerClient';
import { BundlerUnavailableError } from './BundlerClient';

/**
 * 从 kernel-types 导入 UserOperation 类型
 * 
 * 使用统一的类型导入辅助模块
 * 
 * @see utils/kernel-types.ts
 */
import type { UserOperation } from '@/utils/kernel-types';

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
    value: bigint = BigInt(0)
  ): Promise<Hash> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    if (!chainConfig.bundlerUrl) {
      throw new BundlerUnavailableError(`Bundler URL not configured for chain: ${chainId}`);
    }

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
    ownerPrivateKey: `0x${string}`
  ): Promise<Hash> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    if (!chainConfig.bundlerUrl) {
      throw new BundlerUnavailableError(`Bundler URL not configured for chain: ${chainId}`);
    }

    if (transactions.length === 0) {
      throw new Error('No transactions to batch');
    }

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
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    const publicClient = createPublicClient({
      transport: http(chainConfig.rpcUrl),
    });

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
      callData: callData,
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      paymasterAndData: chainConfig.paymasterAddress || '0x',
    };

    // 估算 Gas
    const gasEstimate = await this.estimateGas(accountAddress, chainId, callData, tempUserOp, chainConfig.bundlerUrl);

    // 构造完整的 UserOperation
    const userOp: UserOperation = {
      sender: accountAddress,
      nonce: nonce,
      initCode: '0x', // 账户已存在，不需要初始化代码
      callData: callData,
      callGasLimit: gasEstimate.callGasLimit,
      verificationGasLimit: gasEstimate.verificationGasLimit,
      preVerificationGas: gasEstimate.preVerificationGas,
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      paymasterAndData: chainConfig.paymasterAddress || '0x',
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
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig || !chainConfig.entryPointAddress) {
      throw new Error(`Chain config or EntryPoint address not found for chainId: ${chainId}`);
    }

    // 1. 计算 UserOperation 哈希（EIP-712）
    const { getUserOpHash } = await import('@/utils/eip712');
    const userOpHash = getUserOpHash(
      userOp,
      chainConfig.entryPointAddress as `0x${string}`,
      chainId
    );

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
        // 统一抛出可识别错误，便于前端提示「切换 RPC/改为自付 Gas」
        throw error;
      }
      throw error;
    }
  }

  /**
   * 获取账户 nonce
   * 
   * 对于未部署的账户，返回 0
   */
  private async getAccountNonce(accountAddress: Address, chainId: number): Promise<bigint> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig || !chainConfig.entryPointAddress) {
      throw new Error(`EntryPoint address not configured for chain: ${chainId}`);
    }

    // 检查账户是否已部署
    const { accountManager } = await import('./AccountManager');
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
      callData: callData,
      callGasLimit: BigInt(0),
      verificationGasLimit: BigInt(0),
      preVerificationGas: BigInt(0),
      maxFeePerGas: userOp.maxFeePerGas || BigInt(0),
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas || BigInt(0),
      paymasterAndData: userOp.paymasterAndData || '0x',
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
      const chainConfig = getChainConfigByChainId(chainId);
      if (!chainConfig) {
        throw new Error(`Chain config not found for chainId: ${chainId}`);
      }

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
}

export const transactionRelayer = new TransactionRelayer();

