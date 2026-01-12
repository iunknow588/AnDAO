/**
 * Bundler 客户端
 * 
 * 负责与 ERC-4337 Bundler 服务交互
 * 支持多服务商故障转移
 */

import { UserOperation } from '@/types';
import type { Hash } from 'viem';
import { getChainConfigByChainId } from '@/config/chains';

export class BundlerUnavailableError extends Error {
  code = 'BUNDLER_UNAVAILABLE';
  constructor(message: string) {
    super(message);
    this.name = 'BundlerUnavailableError';
  }
}

export interface BundlerConfig {
  url: string;
  name: string;
  priority: number; // 优先级，数字越小优先级越高
  chainId?: number; // 关联的链ID，用于获取EntryPoint地址
}

export class BundlerClient {
  private bundlers: BundlerConfig[] = [];
  private currentBundler: BundlerConfig | null = null;
  private currentChainId: number | null = null;

  /**
   * 添加 Bundler 服务
   */
  addBundler(config: BundlerConfig): void {
    this.bundlers.push(config);
    this.bundlers.sort((a, b) => a.priority - b.priority);
    
    // 如果没有当前 Bundler，设置为第一个
    if (!this.currentBundler) {
      this.currentBundler = this.bundlers[0];
    }
  }

  /**
   * 确保 bundler 已注册（幂等）
   */
  ensureBundler(config: BundlerConfig): void {
    const exists = this.bundlers.some((b) => b.url === config.url);
    if (!exists) {
      this.addBundler(config);
    }
  }

  /**
   * 设置当前使用的 Bundler
   */
  setBundler(url: string, chainId?: number): void {
    const bundler = this.bundlers.find((b) => b.url === url);
    if (bundler) {
      this.currentBundler = bundler;
      if (chainId) {
        this.currentChainId = chainId;
      }
    }
  }

  /**
   * 设置当前链ID（用于获取EntryPoint地址）
   */
  setChainId(chainId: number): void {
    this.currentChainId = chainId;
  }

  /**
   * 发送 UserOperation
   * 
   * 优先使用 currentBundler，如果失败则尝试其他 bundlers
   */
  async sendUserOperation(userOp: UserOperation, chainId?: number): Promise<Hash> {
    if (this.bundlers.length === 0) {
      throw new BundlerUnavailableError('No bundler configured');
    }

    const entryPointAddress = this.getEntryPointAddress(chainId);

    // 构建尝试列表：优先使用 currentBundler
    const bundlersToTry: BundlerConfig[] = [];
    if (this.currentBundler) {
      bundlersToTry.push(this.currentBundler);
    }
    // 添加其他 bundlers（排除已添加的 currentBundler）
    for (const bundler of this.bundlers) {
      if (bundler.url !== this.currentBundler?.url) {
        bundlersToTry.push(bundler);
      }
    }

    // 如果 currentBundler 未设置，使用列表顺序
    if (bundlersToTry.length === 0) {
      bundlersToTry.push(...this.bundlers);
    }

    // 尝试发送，如果失败则尝试下一个
    let lastError: Error | null = null;
    for (const bundler of bundlersToTry) {
      try {
        const hash = await this.sendToBundler(userOp, bundler.url, entryPointAddress);
        // 成功时更新 currentBundler
        this.currentBundler = bundler;
        return hash;
      } catch (error) {
        console.warn(`Bundler ${bundler.name} failed, trying next...`, error);
        lastError = error as Error;
        continue;
      }
    }

    throw new BundlerUnavailableError(`All bundlers failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * 发送到指定的 Bundler
   */
  private async sendToBundler(userOp: UserOperation, bundlerUrl: string, entryPointAddress: string): Promise<Hash> {
    // ERC-4337 Bundler RPC 格式
    // method: eth_sendUserOperation
    // params: [userOp, entryPointAddress]
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'eth_sendUserOperation',
      params: [this.formatUserOperation(userOp), entryPointAddress],
    };

    const response = await fetch(bundlerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bundler request failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message || `Bundler error: ${JSON.stringify(result.error)}`);
    }

    return result.result as Hash;
  }

  /**
   * 获取 EntryPoint 地址
   * 从链配置中获取，如果未配置则使用默认地址
   */
  private getEntryPointAddress(chainId?: number): string {
    const targetChainId = chainId || this.currentChainId;
    if (targetChainId) {
      const chainConfig = getChainConfigByChainId(targetChainId);
      if (chainConfig?.entryPointAddress) {
        return chainConfig.entryPointAddress;
      }
    }
    // 降级方案：使用标准的 EntryPoint 地址（ERC-4337 v0.6）
    return '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
  }

  /**
   * 估算 UserOperation Gas
   */
  async estimateUserOperationGas(userOp: UserOperation, chainId?: number): Promise<{
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
  }> {
    if (!this.currentBundler) {
      throw new BundlerUnavailableError('No bundler configured');
    }

    const entryPointAddress = this.getEntryPointAddress(chainId);
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'eth_estimateUserOperationGas',
      params: [this.formatUserOperation(userOp), entryPointAddress],
    };

    const response = await fetch(this.currentBundler.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bundler request failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message || `Bundler error: ${JSON.stringify(result.error)}`);
    }

    // 处理不同格式的返回值
    const gasResult = result.result;
    return {
      callGasLimit: typeof gasResult.callGasLimit === 'string' 
        ? BigInt(gasResult.callGasLimit) 
        : BigInt(gasResult.callGasLimit || 0),
      verificationGasLimit: typeof gasResult.verificationGasLimit === 'string'
        ? BigInt(gasResult.verificationGasLimit)
        : BigInt(gasResult.verificationGasLimit || 0),
      preVerificationGas: typeof gasResult.preVerificationGas === 'string'
        ? BigInt(gasResult.preVerificationGas)
        : BigInt(gasResult.preVerificationGas || 0),
    };
  }

  /**
   * 格式化 UserOperation 为 Bundler 期望的格式
   */
  private formatUserOperation(userOp: UserOperation): any {
    return {
      sender: userOp.sender,
      nonce: `0x${userOp.nonce.toString(16)}`,
      initCode: userOp.initCode,
      callData: userOp.callData,
      callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
      verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
      preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
      maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(bundlerUrl?: string): Promise<boolean> {
    const url = bundlerUrl || this.currentBundler?.url;
    if (!url) {
      return false;
    }

    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      // 如果 /health 端点不存在，尝试 ping 端点
      try {
        const response = await fetch(`${url}/ping`, {
          method: 'GET',
        });
        return response.ok;
      } catch {
        return false;
      }
    }
  }

  /**
   * 获取 UserOperation 状态
   */
  async getUserOperationReceipt(userOpHash: Hash): Promise<any> {
    if (!this.currentBundler) {
      throw new Error('No bundler configured');
    }

    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'eth_getUserOperationReceipt',
      params: [userOpHash],
    };

    const response = await fetch(this.currentBundler.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bundler request failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message || `Bundler error: ${JSON.stringify(result.error)}`);
    }

    return result.result;
  }
}

export const bundlerClient = new BundlerClient();

