/**
 * 链管理服务
 * 
 * 负责管理自定义链的添加、删除和切换
 * 支持 EIP-3085 (wallet_addEthereumChain) 和 EIP-3326 (wallet_switchEthereumChain)
 * 
 * @module services/ChainService
 */

import { ChainConfig } from '@/types';
import { configStorage } from '@/adapters/StorageAdapter';

/**
 * 自定义链配置接口（EIP-3085）
 */
export interface AddEthereumChainParameter {
  chainId: string; // 0x 前缀的十六进制字符串
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  iconUrls?: string[];
}

/**
 * 链管理服务
 */
export class ChainService {
  private readonly CUSTOM_CHAINS_KEY = 'custom_chains';
  private customChains: Map<number, ChainConfig> = new Map();

  /**
   * 初始化链管理服务
   */
  async init(): Promise<void> {
    await this.loadCustomChains();
  }

  /**
   * 添加自定义链
   * 
   * 根据 EIP-3085 标准添加新链
   * 
   * @param params 链配置参数
   * @returns 添加的链配置
   * 
   * @throws {Error} 如果链已存在或参数无效
   */
  async addChain(params: AddEthereumChainParameter): Promise<ChainConfig> {
    // 验证参数
    this.validateChainParams(params);

    // 解析 chainId
    const chainId = parseInt(params.chainId, 16);
    
    // 检查链是否已存在
    if (this.customChains.has(chainId)) {
      throw new Error(`Chain with chainId ${chainId} already exists`);
    }

    // 构造链配置
    const chainConfig: ChainConfig = {
      chainId,
      name: params.chainName,
      rpcUrl: params.rpcUrls[0], // 使用第一个 RPC URL
      bundlerUrl: '', // 需要用户配置或自动发现
      paymasterAddress: '', // 可选
      kernelFactoryAddress: '', // 需要用户配置或自动发现
      entryPointAddress: '', // 需要用户配置或使用默认值
      multiChainValidatorAddress: '', // 需要用户配置
      nativeCurrency: params.nativeCurrency,
    };

    // 保存到存储
    this.customChains.set(chainId, chainConfig);
    await this.saveCustomChains();

    return chainConfig;
  }

  /**
   * 获取自定义链配置
   */
  getCustomChain(chainId: number): ChainConfig | undefined {
    return this.customChains.get(chainId);
  }

  /**
   * 获取所有自定义链
   */
  getAllCustomChains(): ChainConfig[] {
    return Array.from(this.customChains.values());
  }

  /**
   * 删除自定义链
   */
  async removeChain(chainId: number): Promise<void> {
    if (!this.customChains.has(chainId)) {
      throw new Error(`Chain with chainId ${chainId} not found`);
    }

    this.customChains.delete(chainId);
    await this.saveCustomChains();
  }

  /**
   * 检查链是否存在
   */
  hasChain(chainId: number): boolean {
    return this.customChains.has(chainId);
  }

  /**
   * 验证链参数
   */
  private validateChainParams(params: AddEthereumChainParameter): void {
    if (!params.chainId) {
      throw new Error('chainId is required');
    }

    if (!params.chainName) {
      throw new Error('chainName is required');
    }

    if (!params.nativeCurrency) {
      throw new Error('nativeCurrency is required');
    }

    if (!params.nativeCurrency.name) {
      throw new Error('nativeCurrency.name is required');
    }

    if (!params.nativeCurrency.symbol) {
      throw new Error('nativeCurrency.symbol is required');
    }

    if (typeof params.nativeCurrency.decimals !== 'number') {
      throw new Error('nativeCurrency.decimals must be a number');
    }

    if (!params.rpcUrls || params.rpcUrls.length === 0) {
      throw new Error('rpcUrls is required and must not be empty');
    }

    // 验证 chainId 格式
    if (!params.chainId.startsWith('0x')) {
      throw new Error('chainId must be a hexadecimal string starting with 0x');
    }

    const chainId = parseInt(params.chainId, 16);
    if (isNaN(chainId) || chainId <= 0) {
      throw new Error('chainId must be a valid positive number');
    }
  }

  /**
   * 加载自定义链
   */
  private async loadCustomChains(): Promise<void> {
    try {
      const stored = await configStorage.get<Array<{ chainId: number; config: ChainConfig }>>(
        this.CUSTOM_CHAINS_KEY
      );
      
      if (stored) {
        stored.forEach(({ chainId, config }) => {
          this.customChains.set(chainId, config);
        });
      }
    } catch (error) {
      console.error('Failed to load custom chains:', error);
    }
  }

  /**
   * 保存自定义链
   */
  private async saveCustomChains(): Promise<void> {
    const chains = Array.from(this.customChains.entries()).map(([chainId, config]) => ({
      chainId,
      config,
    }));
    
    await configStorage.set(this.CUSTOM_CHAINS_KEY, chains);
  }
}

export const chainService = new ChainService();
