/**
 * 插件系统类型定义
 * 
 * 基于 ERC-7579 标准
 */

import type { Address, Hex } from 'viem';

/**
 * 插件类型枚举（ERC-7579）
 */
export enum PluginType {
  VALIDATOR = 1,      // 验证器插件
  EXECUTOR = 2,       // 执行器插件
  FALLBACK = 3,       // 回退插件
  HOOK = 4,          // 钩子插件
  POLICY = 5,        // 策略插件
  SIGNER = 6,        // 签名器插件
}

/**
 * 插件接口
 */
export interface IPlugin {
  /**
   * 插件唯一标识
   */
  id: string;

  /**
   * 插件名称
   */
  name: string;

  /**
   * 插件类型
   */
  type: PluginType;

  /**
   * 插件合约地址
   */
  address: Address;

  /**
   * 插件版本
   */
  version: string;

  /**
   * 插件描述
   */
  description?: string;

  /**
   * 是否已安装
   */
  installed: boolean;

  /**
   * 安装时间
   */
  installedAt?: number;
}

/**
 * 插件配置
 */
export interface PluginConfig {
  /**
   * 插件安装数据
   */
  installData?: Hex;

  /**
   * 插件初始化数据
   */
  initData?: Hex;

  /**
   * 插件依赖
   */
  dependencies?: string[];
}

/**
 * 插件执行上下文
 */
export interface PluginExecutionContext {
  /**
   * 账户地址
   */
  accountAddress: Address;

  /**
   * 链 ID
   */
  chainId: number;

  /**
   * 执行数据
   */
  executionData: Hex;

  /**
   * 执行模式
   */
  executionMode?: string;
}

/**
 * 插件执行结果
 */
export interface PluginExecutionResult {
  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 返回数据
   */
  returnData?: Hex;

  /**
   * 错误信息
   */
  error?: string;
}

