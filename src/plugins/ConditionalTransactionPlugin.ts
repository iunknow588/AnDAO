/**
 * 条件交易插件
 * 
 * 支持条件触发的交易执行
 */

import type { Address, Hex } from 'viem';
import { IPlugin, PluginType } from '@/types/plugins';
import { getChainConfigByChainId } from '@/config/chains';
import { createPublicClient, http } from 'viem';

/**
 * 条件类型
 */
export enum ConditionType {
  BLOCK_NUMBER = 'block_number',      // 区块号条件
  TIMESTAMP = 'timestamp',            // 时间戳条件
  BALANCE = 'balance',               // 余额条件
  CONTRACT_STATE = 'contract_state',  // 合约状态条件
  CUSTOM = 'custom',                 // 自定义条件
}

/**
 * 条件定义
 */
export interface Condition {
  /**
   * 条件类型
   */
  type: ConditionType;

  /**
   * 条件参数
   */
  params: Record<string, unknown>;

  /**
   * 比较操作符
   */
  operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ne';

  /**
   * 期望值
   */
  expectedValue: unknown;
}

type ContractStateParams = {
  address?: Address;
  functionName?: string;
  abi?: readonly unknown[];
  args?: readonly unknown[];
};

/**
 * 条件交易配置
 */
export interface ConditionalTransactionConfig {
  /**
   * 条件列表（所有条件必须满足）
   */
  conditions: Condition[];

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
 * 条件交易信息
 */
export interface ConditionalTransaction {
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
  config: ConditionalTransactionConfig;

  /**
   * 状态
   */
  status: 'pending' | 'monitoring' | 'ready' | 'executed' | 'cancelled';

  /**
   * 创建时间
   */
  createdAt: number;

  /**
   * 执行时间
   */
  executedAt?: number;

  /**
   * 交易哈希
   */
  txHash?: string;
}

/**
 * 条件交易插件
 */
export class ConditionalTransactionPlugin {
  private plugin: IPlugin;
  private conditionalTransactions: Map<string, ConditionalTransaction> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(pluginAddress: Address) {
    this.plugin = {
      id: `conditional-transaction-${pluginAddress.toLowerCase()}`,
      name: 'Conditional Transaction Plugin',
      type: PluginType.EXECUTOR,
      address: pluginAddress,
      version: '1.0.0',
      description: '条件交易插件：支持条件触发的交易执行',
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
   * 创建条件交易
   */
  async createConditionalTransaction(
    accountAddress: Address,
    chainId: number,
    config: ConditionalTransactionConfig
  ): Promise<ConditionalTransaction> {
    const transaction: ConditionalTransaction = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      accountAddress,
      chainId,
      config,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.conditionalTransactions.set(transaction.id, transaction);

    // 开始监控条件
    await this.startMonitoring(transaction);

    return transaction;
  }

  /**
   * 开始监控条件
   */
  private async startMonitoring(transaction: ConditionalTransaction): Promise<void> {
    transaction.status = 'monitoring';

    const interval = setInterval(async () => {
      try {
        const allConditionsMet = await this.checkConditions(transaction);
        if (allConditionsMet) {
          transaction.status = 'ready';
          this.stopMonitoring(transaction.id);

          // 触发事件通知
          window.dispatchEvent(
            new CustomEvent('conditional-transaction:ready', {
              detail: { transactionId: transaction.id },
            })
          );
        }
      } catch (error) {
        console.error(`Error checking conditions for transaction ${transaction.id}:`, error);
      }
    }, 5000); // 每5秒检查一次

    this.monitoringIntervals.set(transaction.id, interval);
  }

  /**
   * 停止监控
   */
  private stopMonitoring(transactionId: string): void {
    const interval = this.monitoringIntervals.get(transactionId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(transactionId);
    }
  }

  /**
   * 检查条件
   */
  private async checkConditions(transaction: ConditionalTransaction): Promise<boolean> {
    const chainConfig = getChainConfigByChainId(transaction.chainId);
    if (!chainConfig) {
      return false;
    }

    const publicClient = createPublicClient({
      transport: http(chainConfig.rpcUrl),
    });

    for (const condition of transaction.config.conditions) {
      const conditionMet = await this.checkCondition(condition, publicClient, transaction.chainId);
      if (!conditionMet) {
        return false;
      }
    }

    return true;
  }

  /**
   * 检查单个条件
   */
  private async checkCondition(
    condition: Condition,
    publicClient: ReturnType<typeof createPublicClient>,
    _chainId: number
  ): Promise<boolean> {
    let actualValue: unknown;

    switch (condition.type) {
      case ConditionType.BLOCK_NUMBER: {
        const blockNumber = await publicClient.getBlockNumber();
        actualValue = Number(blockNumber);
        break;
      }

      case ConditionType.TIMESTAMP: {
        const block = await publicClient.getBlock({ blockTag: 'latest' });
        actualValue = Number(block.timestamp);
        break;
      }

      case ConditionType.BALANCE: {
        const address = condition.params.address as Address;
        const balance = await publicClient.getBalance({ address });
        actualValue = Number(balance);
        break;
      }

      case ConditionType.CONTRACT_STATE: {
        // 合约状态检查
        // 支持查询合约的任意状态变量或调用view函数
        // params格式: { address: Address, functionName: string, abi: unknown[], args?: unknown[] }
        const contractStateParams = condition.params as ContractStateParams;
        const contractAddress = contractStateParams.address;
        const functionName = contractStateParams.functionName;
        const abi = contractStateParams.abi;
        const args = contractStateParams.args || [];

        if (!contractAddress || !functionName || !abi) {
          console.warn('Invalid contract state condition params');
          return false;
        }

        try {
          const result = await publicClient.readContract({
            address: contractAddress,
            abi,
            functionName,
            args,
          });
          
          // 将结果转换为数字进行比较
          actualValue = typeof result === 'bigint' ? Number(result) : Number(result);
        } catch (error) {
          console.error('Failed to read contract state:', error);
          return false;
        }
        break;
      }

      default:
        return false;
    }

    // 比较值
    return this.compareValues(actualValue, condition.operator, condition.expectedValue);
  }

  /**
   * 比较值
   */
  private compareValues(
    actual: unknown,
    operator: Condition['operator'],
    expected: unknown
  ): boolean {
    const asNumeric = (value: unknown): number | null => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }
      if (typeof value === 'bigint') {
        return Number(value);
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? null : parsed;
      }
      return null;
    };

    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'gt': {
        const actualNum = asNumeric(actual);
        const expectedNum = asNumeric(expected);
        return actualNum !== null && expectedNum !== null && actualNum > expectedNum;
      }
      case 'gte': {
        const actualNum = asNumeric(actual);
        const expectedNum = asNumeric(expected);
        return actualNum !== null && expectedNum !== null && actualNum >= expectedNum;
      }
      case 'lt': {
        const actualNum = asNumeric(actual);
        const expectedNum = asNumeric(expected);
        return actualNum !== null && expectedNum !== null && actualNum < expectedNum;
      }
      case 'lte': {
        const actualNum = asNumeric(actual);
        const expectedNum = asNumeric(expected);
        return actualNum !== null && expectedNum !== null && actualNum <= expectedNum;
      }
      case 'ne':
        return actual !== expected;
      default:
        return false;
    }
  }

  /**
   * 执行条件交易
   * 
   * 当条件满足时，调用插件合约执行交易
   * 
   * @param transactionId 交易ID
   * @param signerPrivateKey 签名者私钥
   * @returns 交易哈希
   */
  async executeTransaction(
    transactionId: string,
    signerPrivateKey: Hex
  ): Promise<string> {
    const transaction = this.conditionalTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.status !== 'ready') {
      throw new Error(`Transaction is not ready. Current status: ${transaction.status}`);
    }

    // 再次检查条件（确保条件仍然满足）
    const conditionsStillMet = await this.checkConditions(transaction);
    if (!conditionsStillMet) {
      throw new Error('Conditions are no longer met');
    }

    // 计算交易哈希（用于在插件合约中标识）
    const { keccak256, encodeAbiParameters, parseAbiParameters, toBytes } = await import('viem');
    const transactionHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters('address, uint256, bytes, bytes32'),
        [
          transaction.config.target,
          transaction.config.value,
          transaction.config.data,
          keccak256(toBytes(JSON.stringify(transaction.config.conditions))) as `0x${string}`, // 条件哈希
        ]
      )
    ) as `0x${string}`;

    // 调用插件合约的 execute 方法
    // 标准接口：function execute(bytes32 transactionHash, address target, uint256 value, bytes calldata data) external
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
          ],
          name: 'execute',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'execute',
      args: [
        transactionHash,
        transaction.config.target,
        transaction.config.value,
        transaction.config.data,
      ],
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
    transaction.executedAt = Date.now();
    transaction.txHash = txHash;

    // 停止监控
    this.stopMonitoring(transactionId);

    return txHash;
  }

  /**
   * 获取条件交易
   */
  getConditionalTransaction(transactionId: string): ConditionalTransaction | undefined {
    return this.conditionalTransactions.get(transactionId);
  }

  /**
   * 获取所有条件交易
   */
  getAllConditionalTransactions(): ConditionalTransaction[] {
    return Array.from(this.conditionalTransactions.values());
  }

  /**
   * 取消条件交易
   * 
   * 取消条件交易并停止监控
   * 
   * @param transactionId 交易ID
   * @param accountAddress 账户地址
   * @param chainId 链ID
   * @param signerPrivateKey 签名者私钥（可选，如果提供则调用插件合约取消）
   * @returns 交易哈希（如果调用了插件合约）
   */
  async cancelTransaction(
    transactionId: string,
    accountAddress: Address,
    chainId: number,
    signerPrivateKey?: Hex
  ): Promise<string | void> {
    const transaction = this.conditionalTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    // 如果提供了私钥，调用插件合约取消
    if (signerPrivateKey) {
      // 计算交易哈希（与execute时一致）
      const { keccak256, encodeAbiParameters, parseAbiParameters, toBytes } = await import('viem');
      const transactionHash = keccak256(
        encodeAbiParameters(
          parseAbiParameters('address, uint256, bytes, bytes32'),
          [
            transaction.config.target,
            transaction.config.value,
            transaction.config.data,
            keccak256(toBytes(JSON.stringify(transaction.config.conditions))) as `0x${string}`,
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

      transaction.txHash = txHash;
      transaction.status = 'cancelled';
      this.stopMonitoring(transactionId);

      return txHash;
    } else {
      // 仅更新本地状态
      transaction.status = 'cancelled';
      this.stopMonitoring(transactionId);
    }
  }
}
