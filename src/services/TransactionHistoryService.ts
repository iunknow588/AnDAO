/**
 * 交易历史服务
 * 
 * 管理交易历史记录、查询、筛选等功能
 */

import { storageAdapter } from '@/adapters/StorageAdapter';
import { StorageKey } from '@/types';

export interface TransactionHistory {
  hash: string;
  chainId: number;
  from: string;
  to: string;
  value: bigint;
  status: 'pending' | 'success' | 'failed';
  timestamp: number;
  blockNumber?: number;
  gasUsed?: bigint;
  gasPrice?: bigint;
  data?: string;
  type?: 'transfer' | 'contract' | 'batch';
}

export class TransactionHistoryService {
  private transactions: Map<string, TransactionHistory> = new Map();

  /**
   * 初始化交易历史服务
   */
  async init(): Promise<void> {
    const storedTransactions = await storageAdapter.get<TransactionHistory[]>(
      StorageKey.SETTINGS + ':transactions'
    );
    if (storedTransactions) {
      storedTransactions.forEach((tx) => {
        this.transactions.set(tx.hash, tx);
      });
    }
  }

  /**
   * 添加交易记录
   */
  async addTransaction(tx: TransactionHistory): Promise<void> {
    this.transactions.set(tx.hash, tx);
    await this.saveTransactions();
  }

  /**
   * 更新交易状态
   */
  async updateTransactionStatus(
    hash: string,
    status: TransactionHistory['status'],
    blockNumber?: number,
    gasUsed?: bigint
  ): Promise<void> {
    const tx = this.transactions.get(hash);
    if (!tx) {
      return;
    }

    tx.status = status;
    if (blockNumber !== undefined) {
      tx.blockNumber = blockNumber;
    }
    if (gasUsed !== undefined) {
      tx.gasUsed = gasUsed;
    }

    this.transactions.set(hash, tx);
    await this.saveTransactions();
  }

  /**
   * 获取交易历史
   */
  async getTransactions(options?: {
    chainId?: number;
    accountAddress?: string;
    status?: TransactionHistory['status'];
    limit?: number;
    offset?: number;
  }): Promise<TransactionHistory[]> {
    let transactions = Array.from(this.transactions.values());

    // 按时间倒序排序
    transactions.sort((a, b) => b.timestamp - a.timestamp);

    // 筛选
    if (options?.chainId !== undefined) {
      transactions = transactions.filter((tx) => tx.chainId === options.chainId);
    }

    if (options?.accountAddress) {
      const address = options.accountAddress.toLowerCase();
      transactions = transactions.filter(
        (tx) => tx.from.toLowerCase() === address || tx.to.toLowerCase() === address
      );
    }

    if (options?.status) {
      transactions = transactions.filter((tx) => tx.status === options.status);
    }

    // 分页
    if (options?.offset !== undefined) {
      transactions = transactions.slice(options.offset);
    }

    if (options?.limit !== undefined) {
      transactions = transactions.slice(0, options.limit);
    }

    return transactions;
  }

  /**
   * 获取交易详情
   */
  async getTransaction(hash: string): Promise<TransactionHistory | null> {
    return this.transactions.get(hash) || null;
  }

  /**
   * 删除交易记录
   */
  async removeTransaction(hash: string): Promise<void> {
    this.transactions.delete(hash);
    await this.saveTransactions();
  }

  /**
   * 清空交易历史
   */
  async clearTransactions(chainId?: number): Promise<void> {
    if (chainId !== undefined) {
      // 只清空指定链的交易
      const toDelete: string[] = [];
      this.transactions.forEach((tx, hash) => {
        if (tx.chainId === chainId) {
          toDelete.push(hash);
        }
      });
      toDelete.forEach((hash) => this.transactions.delete(hash));
    } else {
      // 清空所有交易
      this.transactions.clear();
    }
    await this.saveTransactions();
  }

  /**
   * 保存交易历史
   */
  private async saveTransactions(): Promise<void> {
    const transactions = Array.from(this.transactions.values());
    await storageAdapter.set(StorageKey.SETTINGS + ':transactions', transactions);
  }
}

export const transactionHistoryService = new TransactionHistoryService();
