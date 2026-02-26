/**
 * 测试网验证脚本
 * 
 * 用于在测试网上验证钱包功能
 * 包括：账户创建、交易发送、社交恢复、插件系统等
 */

import { accountManager } from '../src/services/AccountManager';
import { transactionRelayer } from '../src/services/TransactionRelayer';
import { guardianService } from '../src/services/GuardianService';
import { pluginService } from '../src/services/PluginService';
import { bundlerClient } from '../src/services/BundlerClient';
import { getChainConfigByChainId } from '../src/config/chains';
import type { Address, Hex } from 'viem';
import { createPublicClient, http } from 'viem';

/**
 * 测试网验证配置
 */
interface TestnetVerificationConfig {
  chainId: number;
  ownerAddress: Address;
  signerPrivateKey: Hex;
  testRecipientAddress?: Address;
  guardianAddress?: Address;
}

/**
 * 验证结果
 */
interface VerificationResult {
  test: string;
  success: boolean;
  message: string;
  data?: any;
}

/**
 * 测试网验证器
 */
export class TestnetVerifier {
  private results: VerificationResult[] = [];

  /**
   * 运行所有验证测试
   */
  async runAllTests(config: TestnetVerificationConfig): Promise<VerificationResult[]> {
    console.log('🚀 开始测试网验证...\n');
    console.log(`链 ID: ${config.chainId}`);
    console.log(`所有者地址: ${config.ownerAddress}\n`);

    // 1. 验证链配置
    await this.verifyChainConfig(config.chainId);

    // 2. 验证账户创建
    await this.verifyAccountCreation(config);

    // 3. 验证交易发送
    if (config.testRecipientAddress) {
      await this.verifyTransactionSending(config);
    }

    // 4. 验证社交恢复
    if (config.guardianAddress) {
      await this.verifySocialRecovery(config);
    }

    // 5. 验证 Bundler 连接
    await this.verifyBundlerConnection(config.chainId);

    // 6. 验证插件系统
    await this.verifyPluginSystem(config);

    // 打印结果摘要
    this.printSummary();

    return this.results;
  }

  /**
   * 验证链配置
   */
  private async verifyChainConfig(chainId: number): Promise<void> {
    const testName = '链配置验证';
    try {
      const chainConfig = getChainConfigByChainId(chainId);
      if (!chainConfig) {
        this.addResult(testName, false, `链配置未找到: ${chainId}`);
        return;
      }

      // 验证 RPC 连接
      const publicClient = createPublicClient({
        transport: http(chainConfig.rpcUrl),
      });

      const blockNumber = await publicClient.getBlockNumber();
      this.addResult(testName, true, `链配置正确，当前区块: ${blockNumber}`, {
        chainId,
        chainName: chainConfig.name,
        rpcUrl: chainConfig.rpcUrl,
        blockNumber: Number(blockNumber),
      });
    } catch (error) {
      this.addResult(testName, false, `链配置验证失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证账户创建
   */
  private async verifyAccountCreation(config: TestnetVerificationConfig): Promise<void> {
    const testName = '账户创建验证';
    try {
      await accountManager.init();

      // 预测地址
      const predictedAddress = await accountManager.getAccountAddress(config.ownerAddress, config.chainId);
      console.log(`  预测地址: ${predictedAddress}`);

      // 创建账户
      const account = await accountManager.createAccount(config.ownerAddress, config.chainId);
      console.log(`  创建账户: ${account.address}`);

      // 验证地址一致性
      if (account.address.toLowerCase() !== predictedAddress.toLowerCase()) {
        this.addResult(testName, false, '预测地址与创建地址不一致');
        return;
      }

      // 验证账户已保存
      const savedAccount = await accountManager.getAccount(account.address, config.chainId);
      if (!savedAccount) {
        this.addResult(testName, false, '账户未保存到本地存储');
        return;
      }

      // 验证链上账户状态（如果已部署）
      const chainConfig = getChainConfigByChainId(config.chainId);
      if (chainConfig) {
        const publicClient = createPublicClient({
          transport: http(chainConfig.rpcUrl),
        });

        const code = await publicClient.getBytecode({ address: account.address });
        const isDeployed = code && code !== '0x';

        this.addResult(testName, true, '账户创建成功', {
          address: account.address,
          chainId: account.chainId,
          owner: account.owner,
          deployed: isDeployed,
        });
      } else {
        this.addResult(testName, true, '账户创建成功（未验证链上状态）', {
          address: account.address,
          chainId: account.chainId,
        });
      }
    } catch (error) {
      this.addResult(testName, false, `账户创建失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证交易发送
   */
  private async verifyTransactionSending(config: TestnetVerificationConfig): Promise<void> {
    const testName = '交易发送验证';
    try {
      const account = await accountManager.getAccount(
        (await accountManager.getAccountAddress(config.ownerAddress, config.chainId)) as Address,
        config.chainId
      );

      if (!account) {
        this.addResult(testName, false, '账户不存在，请先创建账户');
        return;
      }

      // 发送测试交易（小额转账）
      // 注意：TransactionRelayer.sendTransaction 不直接支持 value 参数
      // 需要通过 callData 构造转账交易
      const txHash = await transactionRelayer.sendTransaction(
        account.address as Address,
        config.chainId,
        config.testRecipientAddress!,
        '0x' as Hex,
        config.signerPrivateKey
      );

      console.log(`  交易哈希: ${txHash}`);

      // 等待交易确认
      const chainConfig = getChainConfigByChainId(config.chainId);
      if (chainConfig) {
        const receipt = await this.waitForTransaction(txHash, chainConfig.rpcUrl);
        this.addResult(testName, true, '交易发送成功', {
          txHash,
          receipt,
        });
      } else {
        this.addResult(testName, true, '交易已发送（未验证确认）', { txHash });
      }
    } catch (error) {
      this.addResult(testName, false, `交易发送失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证社交恢复
   */
  private async verifySocialRecovery(config: TestnetVerificationConfig): Promise<void> {
    const testName = '社交恢复验证';
    try {
      const account = await accountManager.getAccount(
        (await accountManager.getAccountAddress(config.ownerAddress, config.chainId)) as Address,
        config.chainId
      );

      if (!account) {
        this.addResult(testName, false, '账户不存在，请先创建账户');
        return;
      }

      // 添加守护人
      console.log(`  添加守护人: ${config.guardianAddress}`);
      const addTxHash = await guardianService.addGuardian(
        account.address as Address,
        config.chainId,
        config.guardianAddress!,
        config.signerPrivateKey
      );
      console.log(`  添加守护人交易: ${addTxHash}`);

      // 获取守护人列表
      const guardians = await guardianService.getGuardians(account.address as Address, config.chainId);
      console.log(`  守护人数量: ${guardians.length}`);

      this.addResult(testName, true, '社交恢复功能正常', {
        guardianAdded: true,
        guardianCount: guardians.length,
        addTxHash,
      });
    } catch (error) {
      this.addResult(testName, false, `社交恢复验证失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证 Bundler 连接
   */
  private async verifyBundlerConnection(chainId: number): Promise<void> {
    const testName = 'Bundler 连接验证';
    try {
      const chainConfig = getChainConfigByChainId(chainId);
      if (!chainConfig || !chainConfig.bundlerUrl) {
        this.addResult(testName, false, 'Bundler URL 未配置');
        return;
      }

      // 测试 Bundler 连接
      const isConnected = await bundlerClient.healthCheck(chainConfig.bundlerUrl);
      if (isConnected) {
        this.addResult(testName, true, 'Bundler 连接正常', {
          bundlerUrl: chainConfig.bundlerUrl,
        });
      } else {
        this.addResult(testName, false, 'Bundler 连接失败');
      }
    } catch (error) {
      this.addResult(testName, false, `Bundler 连接验证失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证插件系统
   */
  private async verifyPluginSystem(config: TestnetVerificationConfig): Promise<void> {
    const testName = '插件系统验证';
    try {
      const account = await accountManager.getAccount(
        (await accountManager.getAccountAddress(config.ownerAddress, config.chainId)) as Address,
        config.chainId
      );

      if (!account) {
        this.addResult(testName, false, '账户不存在，请先创建账户');
        return;
      }

      // 初始化插件服务
      await pluginService.init(account.address as Address, config.chainId);

      // 获取已安装的插件
      const installedPlugins = pluginService.getInstalledPlugins();
      const allPlugins = pluginService.getAllPlugins();

      this.addResult(testName, true, '插件系统正常', {
        installedCount: installedPlugins.length,
        totalCount: allPlugins.length,
      });
    } catch (error) {
      this.addResult(testName, false, `插件系统验证失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 等待交易确认
   */
  private async waitForTransaction(txHash: Hex, rpcUrl: string, maxWaitTime = 60000): Promise<any> {
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        if (receipt) {
          return receipt;
        }
      } catch (error) {
        // 交易可能还未确认，继续等待
      }
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待 2 秒
    }

    throw new Error('交易确认超时');
  }

  /**
   * 添加验证结果
   */
  private addResult(test: string, success: boolean, message: string, data?: any): void {
    this.results.push({ test, success, message, data });
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${test}: ${message}`);
    if (data) {
      console.log(`   数据:`, JSON.stringify(data, null, 2));
    }
  }

  /**
   * 打印结果摘要
   */
  private printSummary(): void {
    console.log('\n📊 验证结果摘要:');
    const successCount = this.results.filter((r) => r.success).length;
    const totalCount = this.results.length;
    const successRate = ((successCount / totalCount) * 100).toFixed(1);

    console.log(`总测试数: ${totalCount}`);
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${totalCount - successCount}`);
    console.log(`成功率: ${successRate}%\n`);

    if (successCount === totalCount) {
      console.log('🎉 所有测试通过！');
    } else {
      console.log('⚠️  部分测试失败，请检查上述错误信息。');
    }
  }
}

/**
 * 运行测试网验证
 */
export async function runTestnetVerification(config: TestnetVerificationConfig): Promise<VerificationResult[]> {
  const verifier = new TestnetVerifier();
  return verifier.runAllTests(config);
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const config: TestnetVerificationConfig = {
    chainId: Number(process.env.TESTNET_CHAIN_ID || 5001),
    ownerAddress: (process.env.TESTNET_OWNER_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
    signerPrivateKey: (process.env.TESTNET_SIGNER_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000') as Hex,
    testRecipientAddress: (process.env.TESTNET_RECIPIENT_ADDRESS || undefined) as Address | undefined,
    guardianAddress: (process.env.TESTNET_GUARDIAN_ADDRESS || undefined) as Address | undefined,
  };

  runTestnetVerification(config)
    .then((results) => {
      process.exit(results.every((r) => r.success) ? 0 : 1);
    })
    .catch((error) => {
      console.error('验证过程出错:', error);
      process.exit(1);
    });
}

