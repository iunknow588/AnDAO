/**
 * 插件服务
 * 
 * 管理 ERC-7579 插件的安装、卸载和执行
 * 支持多种插件类型：Validator、Executor、Hook、Policy、Signer
 */

import type { Address, Hex } from 'viem';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { IPlugin, PluginType, PluginConfig, PluginExecutionContext, PluginExecutionResult } from '@/types/plugins';
import { getChainConfigByChainId } from '@/config/chains';
import { storageAdapter } from '@/adapters/StorageAdapter';
import { StorageKey } from '@/types';
import { transactionRelayer } from './TransactionRelayer';

/**
 * Kernel 插件管理 ABI（ERC-7579）
 */
const KERNEL_PLUGIN_ABI = [
  {
    inputs: [
      { name: 'moduleTypeId', type: 'uint256' },
      { name: 'module', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'installModule',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'moduleTypeId', type: 'uint256' },
      { name: 'module', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'uninstallModule',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'moduleTypeId', type: 'uint256' },
    ],
    name: 'getModules',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * 插件服务
 */
export class PluginService {
  private plugins: Map<string, IPlugin> = new Map();

  /**
   * 初始化插件服务
   */
  async init(accountAddress: Address, chainId: number): Promise<void> {
    // 从存储加载已安装的插件
    const storageKey = `${StorageKey.PLUGINS}_${accountAddress}_${chainId}`;
    const storedPlugins = await storageAdapter.get<IPlugin[]>(storageKey);
    
    if (storedPlugins) {
      storedPlugins.forEach((plugin) => {
        this.plugins.set(plugin.id, plugin);
      });
    }

    // 从链上同步插件状态
    await this.syncPluginsFromChain(accountAddress, chainId);
  }

  /**
   * 从链上同步插件状态
   */
  private async syncPluginsFromChain(accountAddress: Address, chainId: number): Promise<void> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      return;
    }

    const publicClient = createPublicClient({
      transport: http(chainConfig.rpcUrl),
    });

    try {
      // 查询所有类型的已安装插件
      for (const pluginType of Object.values(PluginType)) {
        if (typeof pluginType === 'number') {
          const modules = await publicClient.readContract({
            address: accountAddress,
            abi: KERNEL_PLUGIN_ABI,
            functionName: 'getModules',
            args: [BigInt(pluginType)],
          });

          // 更新插件状态
          for (const moduleAddress of modules) {
            const plugin = this.plugins.get(moduleAddress.toLowerCase());
            if (plugin) {
              plugin.installed = true;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to sync plugins from chain:', error);
    }
  }

  /**
   * 安装插件
   */
  async installPlugin(
    accountAddress: Address,
    chainId: number,
    plugin: IPlugin,
    config: PluginConfig,
    signerPrivateKey: Hex
  ): Promise<string> {
    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

    // 构造安装数据
    const installData = config.installData || '0x';
    
    // 编码 installModule 调用
    const callData = encodeFunctionData({
      abi: KERNEL_PLUGIN_ABI,
      functionName: 'installModule',
      args: [
        BigInt(plugin.type),
        plugin.address,
        installData,
      ],
    });

    // 发送交易
    const txHash = await transactionRelayer.sendTransaction(
      accountAddress,
      chainId,
      accountAddress, // 调用自身（Kernel 合约）
      callData,
      signerPrivateKey
    );

    // 更新本地状态
    plugin.installed = true;
    plugin.installedAt = Date.now();
    this.plugins.set(plugin.id, plugin);
    await this.savePlugins(accountAddress, chainId);

    return txHash;
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin(
    accountAddress: Address,
    chainId: number,
    pluginId: string,
    signerPrivateKey: Hex
  ): Promise<string> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const chainConfig = getChainConfigByChainId(chainId);
    if (!chainConfig) {
      throw new Error(`Chain config not found for chainId: ${chainId}`);
    }

    // 编码 uninstallModule 调用
    const callData = encodeFunctionData({
      abi: KERNEL_PLUGIN_ABI,
      functionName: 'uninstallModule',
      args: [
        BigInt(plugin.type),
        plugin.address,
        '0x', // uninstall data
      ],
    });

    // 发送交易
    const txHash = await transactionRelayer.sendTransaction(
      accountAddress,
      chainId,
      accountAddress,
      callData,
      signerPrivateKey
    );

    // 更新本地状态
    plugin.installed = false;
    plugin.installedAt = undefined;
    await this.savePlugins(accountAddress, chainId);

    return txHash;
  }

  /**
   * 获取已安装的插件列表
   */
  getInstalledPlugins(): IPlugin[] {
    return Array.from(this.plugins.values()).filter((p) => p.installed);
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取插件
   */
  getPlugin(pluginId: string): IPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * 注册插件（添加到可用插件列表）
   */
  registerPlugin(plugin: IPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  /**
   * 执行插件
   * 
   * 根据插件类型执行相应的逻辑
   */
  async executePlugin(
    pluginId: string,
    context: PluginExecutionContext
  ): Promise<PluginExecutionResult> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return {
        success: false,
        error: `Plugin not found: ${pluginId}`,
      };
    }

    if (!plugin.installed) {
      return {
        success: false,
        error: `Plugin not installed: ${pluginId}`,
      };
    }

    // 根据插件类型执行不同的逻辑
    switch (plugin.type) {
      case PluginType.EXECUTOR:
        return this.executeExecutorPlugin(plugin, context);
      case PluginType.HOOK:
        return this.executeHookPlugin(plugin, context);
      default:
        return {
          success: false,
          error: `Unsupported plugin type: ${plugin.type}`,
        };
    }
  }

  /**
   * 执行执行器插件
   * 
   * Executor 插件用于执行交易
   * 根据 ERC-7579 标准，Executor 插件可以通过 Kernel 的 executeFromExecutor 方法执行
   * 
   * @param plugin 执行器插件
   * @param context 执行上下文
   * @returns 执行结果
   */
  private async executeExecutorPlugin(
    plugin: IPlugin,
    context: PluginExecutionContext
  ): Promise<PluginExecutionResult> {
    const chainConfig = getChainConfigByChainId(context.chainId);
    if (!chainConfig) {
      return {
        success: false,
        error: `Chain config not found for chainId: ${context.chainId}`,
      };
    }

    try {
      // 构造调用 Kernel.executeFromExecutor 的数据
      // Kernel.executeFromExecutor(executor, target, value, data)
      // 注意：这需要 Kernel 合约支持 executeFromExecutor 方法
      // 如果 Kernel 不支持，可能需要通过其他方式执行
      
      const { encodeFunctionData } = await import('viem');
      
      // 尝试使用 executeFromExecutor 方法
      // 如果 Kernel 不支持，降级使用 execute 方法
      const callData = encodeFunctionData({
        abi: [
          {
            inputs: [
              { name: 'executor', type: 'address' },
              { name: 'target', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'data', type: 'bytes' },
            ],
            name: 'executeFromExecutor',
            outputs: [],
            stateMutability: 'payable',
            type: 'function',
          },
        ],
        functionName: 'executeFromExecutor',
        args: [
          plugin.address,
          context.executionData as Address, // 假设 executionData 包含目标地址
          BigInt(0), // value
          context.executionData, // data
        ],
      });

      // 注意：实际执行需要通过 TransactionRelayer 发送交易
      // 这里返回调用数据，由调用者决定如何执行
      return {
        success: true,
        returnData: callData as Hex,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to execute executor plugin: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 执行钩子插件
   * 
   * Hook 插件用于在执行前后进行检查
   * 根据 ERC-7579 标准，Hook 插件有 preCheck 和 postCheck 方法
   * 
   * 注意：Hook 插件通常由 Kernel 自动调用，不需要手动执行
   * 这个方法主要用于测试或特殊场景
   * 
   * @param plugin 钩子插件
   * @param context 执行上下文
   * @returns 执行结果
   */
  private async executeHookPlugin(
    plugin: IPlugin,
    context: PluginExecutionContext
  ): Promise<PluginExecutionResult> {
    const chainConfig = getChainConfigByChainId(context.chainId);
    if (!chainConfig) {
      return {
        success: false,
        error: `Chain config not found for chainId: ${context.chainId}`,
      };
    }

    const publicClient = createPublicClient({
      transport: http(chainConfig.rpcUrl),
    });

    try {
      // Hook 插件的 preCheck 方法
      // function preCheck(address msgSender, uint256 msgValue, bytes calldata msgData)
      //   external payable returns (bytes memory hookData)
      
      const hookABI = [
        {
          inputs: [
            { name: 'msgSender', type: 'address' },
            { name: 'msgValue', type: 'uint256' },
            { name: 'msgData', type: 'bytes' },
          ],
          name: 'preCheck',
          outputs: [{ name: 'hookData', type: 'bytes' }],
          stateMutability: 'payable',
          type: 'function',
        },
        {
          inputs: [{ name: 'hookData', type: 'bytes' }],
          name: 'postCheck',
          outputs: [],
          stateMutability: 'payable',
          type: 'function',
        },
      ] as const;

      // 调用 preCheck
      const hookData = await publicClient.readContract({
        address: plugin.address,
        abi: hookABI,
        functionName: 'preCheck',
        args: [
          context.accountAddress,
          BigInt(0), // msgValue
          context.executionData,
        ],
      });

      return {
        success: true,
        returnData: hookData as Hex,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to execute hook plugin: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 保存插件列表
   */
  private async savePlugins(accountAddress: Address, chainId: number): Promise<void> {
    const storageKey = `${StorageKey.PLUGINS}_${accountAddress}_${chainId}`;
    const plugins = Array.from(this.plugins.values());
    await storageAdapter.set(storageKey, plugins);
  }
}

export const pluginService = new PluginService();

