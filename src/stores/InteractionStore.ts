/**
 * 交互 Store
 * 
 * 管理 DApp 请求队列和用户交互
 * 用于处理需要用户确认的 DApp 请求（如交易签名、消息签名等）
 * 
 * @module stores/InteractionStore
 */

import { makeAutoObservable } from 'mobx';

/**
 * 交互请求类型
 */
export type InteractionType =
  | 'eth_sendTransaction'
  | 'eth_sign'
  | 'personal_sign'
  | 'eth_signTypedData'
  | 'eth_requestAccounts'
  | 'wallet_switchEthereumChain'
  | 'wallet_addEthereumChain';

/**
 * 交互请求状态
 */
export type InteractionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * 交互请求接口
 */
export interface InteractionRequest {
  id: string;
  type: InteractionType;
  origin: string; // DApp 来源
  params: unknown;
  status: InteractionStatus;
  createdAt: number;
  resolvedAt?: number;
  result?: unknown;
  error?: string;
}

/**
 * 交互 Store
 */
export class InteractionStore {
  requests: InteractionRequest[] = [];
  currentRequest: InteractionRequest | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * 添加交互请求
   * 
   * @param type 请求类型
   * @param origin DApp 来源
   * @param params 请求参数
   * @returns 请求ID
   */
  addRequest(
    type: InteractionType,
    origin: string,
    params: unknown
  ): string {
    const request: InteractionRequest = {
      id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      origin,
      params,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.requests.push(request);
    this.currentRequest = request;

    // 触发新请求事件
    window.dispatchEvent(
      new CustomEvent('interaction:new-request', {
        detail: { request },
      })
    );

    return request.id;
  }

  /**
   * 批准请求
   * 
   * @param requestId 请求ID
   * @param result 请求结果
   */
  approveRequest(requestId: string, result: unknown): void {
    const request = this.requests.find((r) => r.id === requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    if (request.status !== 'pending') {
      throw new Error(`Request is not pending: ${request.status}`);
    }

    request.status = 'approved';
    request.result = result;
    request.resolvedAt = Date.now();

    if (this.currentRequest?.id === requestId) {
      this.currentRequest = null;
    }

    // 触发请求批准事件
    window.dispatchEvent(
      new CustomEvent('interaction:approved', {
        detail: { request },
      })
    );
  }

  /**
   * 拒绝请求
   * 
   * @param requestId 请求ID
   * @param error 错误信息（可选）
   */
  rejectRequest(requestId: string, error?: string): void {
    const request = this.requests.find((r) => r.id === requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    if (request.status !== 'pending') {
      throw new Error(`Request is not pending: ${request.status}`);
    }

    request.status = 'rejected';
    request.error = error || 'User rejected the request';
    request.resolvedAt = Date.now();

    if (this.currentRequest?.id === requestId) {
      this.currentRequest = null;
    }

    // 触发请求拒绝事件
    window.dispatchEvent(
      new CustomEvent('interaction:rejected', {
        detail: { request },
      })
    );
  }

  /**
   * 取消请求
   * 
   * @param requestId 请求ID
   */
  cancelRequest(requestId: string): void {
    const request = this.requests.find((r) => r.id === requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    request.status = 'cancelled';
    request.resolvedAt = Date.now();

    if (this.currentRequest?.id === requestId) {
      this.currentRequest = null;
    }
  }

  /**
   * 获取待处理的请求
   */
  getPendingRequests(): InteractionRequest[] {
    return this.requests.filter((r) => r.status === 'pending');
  }

  /**
   * 获取请求
   */
  getRequest(requestId: string): InteractionRequest | undefined {
    return this.requests.find((r) => r.id === requestId);
  }

  /**
   * 清除已完成的请求
   * 
   * @param olderThan 清除早于此时间的已完成请求（毫秒，可选）
   */
  clearCompletedRequests(olderThan?: number): void {
    const cutoff = olderThan || Date.now() - 24 * 60 * 60 * 1000; // 默认24小时前

    this.requests = this.requests.filter((r) => {
      if (r.status === 'pending') {
        return true; // 保留待处理请求
      }
      if (r.resolvedAt && r.resolvedAt < cutoff) {
        return false; // 删除过期的已完成请求
      }
      return true; // 保留最近的已完成请求
    });
  }

  /**
   * 清除所有请求
   */
  clearAllRequests(): void {
    this.requests = [];
    this.currentRequest = null;
  }
}

export const interactionStore = new InteractionStore();
