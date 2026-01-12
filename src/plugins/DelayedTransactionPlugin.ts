/**
 * 延迟交易插件
 * 
 * 支持延迟执行交易功能
 */

import type { Address, Hex } from 'viem';
import { IPlugin, PluginType } from '@/types/plugins';
import { getChainConfigByChainId } from '@/config/chains';

/**
 * 延迟交易配置
 */
export interface DelayedTransactionConfig {
  /**
   * 延迟时间（秒）
   */
  delaySeconds: number;

  /**
   * 目标地址
   */
  target: Address;

  /**
   * 调用数据
   */
  data: Hex;

  /**
   * 转账金额
   */
  value: bigint;
}

/**
 * 延迟交易信息
 */
export interface DelayedTransaction {
  /**
   * 交易 ID
   */
  id: string;

  /**
   * 账户地址
   */
  accountAddress: Address;

  /**
   * 链 ID
   */
  chainId: number;

  /**
   * 配置
   */
  config: DelayedTransactionConfig;

  /**
   * 计划执行时间
   */
  scheduledAt: number;

  /**
   * 状态
   */
  status: 'pending' | 'scheduled' | 'executed' | 'cancelled';

  /**
   * 交易哈希（执行后）
   */
  txHash?: string;
}

/**
 * 延迟交易插件
 */
export class DelayedTransactionPlugin {
  private plugin: IPlugin;
  private scheduledTransactions: Map<string, DelayedTransaction> = new Map();

  constructor(pluginAddress: Address) {
    this.plugin = {
      id: `delayed-transaction-${pluginAddress.toLowerCase()}`,
      name: 'Delayed Transaction Plugin',
      type: PluginType.EXECUTOR,
      address: pluginAddress,
      version: '1.0.0',
      description: '延迟交易插件：支持延迟执行交易',
      installed: false,
    };
  }

  /**
   * 获取插件信息
   */
  getPlugin(): IPlugin {
    return this.plugin;
  }

  /**
   * 调度延迟交易
   * 
   * 调用插件合约的 schedule 方法，将交易调度到指定时间执行
   * 
   * @param accountAddress 账户地址
   * @param chainId 链ID
   * @param config 延迟交易配置
   * @param signerPrivateKey 签名者私钥（用于发送调度交易）
   * @returns 延迟交易信息
   */
  async scheduleTransaction(
    accountAddress: Address,
    chainId: number,
    config: DelayedTransactionConfig,
    signerPrivateKey: `0x${string}`
  ): Promise<DelayedTransaction> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

    // 生成交易ID（使用交易哈希）
    const transactionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 构造交易数据（用于延迟执行）
    const { encodeExecuteCallData } = await import('@/utils/kernel');
    const executeCallData = encodeExecuteCallData(
      config.target,
      config.value,
      config.data
    );

    // 计算交易哈希（用于在插件合约中标识）
    const { keccak256, encodeAbiParameters, parseAbiParameters } = await import('viem');
    const transactionHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters('address, uint256, bytes, uint256'),
        [config.target, config.value, config.data, BigInt(config.delaySeconds)]
      )
    ) as `0x${string}`;

    const transaction: DelayedTransaction = {
      id: transactionId,
      accountAddress,
      chainId,
      config,
      scheduledAt: Date.now() + config.delaySeconds * 1000,
      status: 'scheduled',
    };

    this.scheduledTransactions.set(transaction.id, transaction);

    // 调用插件合约的 schedule 方法
    // 标准接口：function schedule(bytes32 transactionHash, address target, uint256 value, bytes calldata data, uint256 delay) external
    const { encodeFunctionData } = await import('viem');
    const { transactionRelayer } = await import('@/services/TransactionRelayer');
    
    const callData = encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: 'transactionHash', type: 'bytes32' },
            { name: 'target', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
            { name: 'delay', type: 'uint256' },
          ],
          name: 'schedule',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'schedule',
      args: [
        transactionHash,
        config.target,
        config.value,
        config.data,
        BigInt(config.delaySeconds),
      ],
    });

    // 发送交易到插件合约
    // 注意：插件应该已经安装在账户中，通过账户调用插件
    const txHash = await transactionRelayer.sendTransaction(
      accountAddress,
      chainId,
      this.plugin.address, // 调用插件合约
      callData,
      signerPrivateKey
    );

    // 更新交易哈希
    transaction.txHash = txHash;

    return transaction;
  }

  /**
   * 获取延迟交易
   */
  getDelayedTransaction(transactionId: string): DelayedTransaction | undefined {
    return this.scheduledTransactions.get(transactionId);
  }

  /**
   * 获取所有延迟交易
   */
  getAllDelayedTransactions(): DelayedTransaction[] {
    return Array.from(this.scheduledTransactions.values());
  }

  /**
   * 取消延迟交易
   * 
   * 调用插件合约的 cancel 方法，取消已调度的交易
   * 
   * @param transactionId 交易ID
   * @param accountAddress 账户地址
   * @param chainId 链ID
   * @param signerPrivateKey 签名者私钥
   * @returns 交易哈希
   */
  async cancelTransaction(
    transactionId: string,
    accountAddress: Address,
    chainId: number,
    signerPrivateKey: `0x${string}`
  ): Promise<string> {
    const transaction = this.scheduledTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    // 计算交易哈希（与schedule时一致）
    const { keccak256, encodeAbiParameters, parseAbiParameters } = await import('viem');
    const transactionHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters('address, uint256, bytes, uint256'),
        [
          transaction.config.target,
          transaction.config.value,
          transaction.config.data,
          BigInt(transaction.config.delaySeconds),
        ]
      )
    ) as `0x${string}`;

    // 调用插件合约的 cancel 方法
    // 标准接口：function cancel(bytes32 transactionHash) external
    const { encodeFunctionData } = await import('viem');
    const { transactionRelayer } = await import('@/services/TransactionRelayer');
    
    const callData = encodeFunctionData({
      abi: [
        {
          inputs: [{ name: 'transactionHash', type: 'bytes32' }],
          name: 'cancel',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'cancel',
      args: [transactionHash],
    });

    // 发送交易到插件合约
    const txHash = await transactionRelayer.sendTransaction(
      accountAddress,
      chainId,
      this.plugin.address,
      callData,
      signerPrivateKey
    );

    // 更新本地状态
    transaction.status = 'cancelled';
    transaction.txHash = txHash;

    return txHash;
  }

  /**
   * 检查并执行到期的交易
   * 
   * 自动检查到期的延迟交易并执行
   * 注意：需要提供签名者私钥
   * 
   * @param signerPrivateKey 签名者私钥
   * @returns 执行的交易数量
   */
  async checkAndExecuteDueTransactions(signerPrivateKey: `0x${string}`): Promise<number> {
    const now = Date.now();
    const dueTransactions = Array.from(this.scheduledTransactions.values()).filter(
      (tx) => tx.status === 'scheduled' && tx.scheduledAt <= now
    );

    let executedCount = 0;
    for (const transaction of dueTransactions) {
      try {
        await this.executeTransaction(transaction, signerPrivateKey);
        executedCount++;
      } catch (error) {
        console.error(`Failed to execute delayed transaction ${transaction.id}:`, error);
      }
    }

    return executedCount;
  }

  /**
   * 执行延迟交易
   * 
   * 调用插件合约的 execute 方法，执行到期的延迟交易
   * 
   * @param transaction 延迟交易信息
   * @param signerPrivateKey 签名者私钥
   * @returns 交易哈希
   */
  async executeTransaction(
    transaction: DelayedTransaction,
    signerPrivateKey: `0x${string}`
  ): Promise<string> {
    if (transaction.status !== 'scheduled') {
      throw new Error(`Transaction is not scheduled. Current status: ${transaction.status}`);
    }

    // 计算交易哈希（与schedule时一致）
    const { keccak256, encodeAbiParameters, parseAbiParameters } = await import('viem');
    const transactionHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters('address, uint256, bytes, uint256'),
        [
          transaction.config.target,
          transaction.config.value,
          transaction.config.data,
          BigInt(transaction.config.delaySeconds),
        ]
      )
    ) as `0x${string}`;

    // 调用插件合约的 execute 方法
    // 标准接口：function execute(bytes32 transactionHash) external
    const { encodeFunctionData } = await import('viem');
    const { transactionRelayer } = await import('@/services/TransactionRelayer');
    
    const callData = encodeFunctionData({
      abi: [
        {
          inputs: [{ name: 'transactionHash', type: 'bytes32' }],
          name: 'execute',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'execute',
      args: [transactionHash],
    });

    // 发送交易到插件合约
    const txHash = await transactionRelayer.sendTransaction(
      transaction.accountAddress,
      transaction.chainId,
      this.plugin.address,
      callData,
      signerPrivateKey
    );

    // 更新本地状态
    transaction.status = 'executed';
    transaction.txHash = txHash;

    return txHash;
  }
}

