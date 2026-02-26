#!/usr/bin/env tsx
/**
 * 测试账号生成工具运行脚本
 * 
 * 用于演示和验证 TestAccountGenerator 的功能
 * 可以生成各种类型的测试账号，用于开发、测试和测试网验证
 * 
 * 使用方法:
 *   npm run test:accounts
 *   或
 *   tsx scripts/functional/generate-test-accounts.ts [选项]
 * 
 * 选项:
 *   --count <number>     批量生成账号数量 (默认: 10)
 *   --chain-id <number>  链 ID (默认: 5000 - Mantle)
 *   --type <type>        生成类型: eoa, mnemonic, set, batch, testnet (默认: eoa)
 *   --include-sponsor    包含赞助商账户 (仅对 set 和 testnet 类型有效)
 * 
 * 注意:
 *   - eoa 和 mnemonic 类型不需要链配置，可以在任何环境中运行
 *   - set 和 testnet 类型需要链配置，需要在有环境变量的环境中运行
 */

// 设置 Node.js 环境变量（如果不存在）
if (typeof process !== 'undefined' && !process.env.VITE_MANTLE_RPC_URL) {
  // 设置默认值，避免在 Node.js 环境中报错
  (globalThis as any).import = { meta: { env: {} } };
}

import { TestAccountGenerator } from '../src/utils/TestAccountGenerator';
import type { TestAccountSet } from '../src/utils/TestAccountGenerator';

// 创建一个不依赖 AccountManager 的实例（仅用于 EOA 和助记词生成）
const generator = new TestAccountGenerator();

/**
 * 打印分隔线
 */
function printSeparator(title?: string): void {
  console.log('\n' + '='.repeat(80));
  if (title) {
    console.log(`  ${title}`);
    console.log('='.repeat(80));
  }
}

/**
 * 打印账户信息
 */
function printAccount(account: any, index?: number): void {
  const prefix = index !== undefined ? `  ${index + 1}. ` : '  ';
  console.log(`${prefix}地址: ${account.address}`);
  if (account.privateKey) {
    console.log(`${' '.repeat(prefix.length)}私钥: ${account.privateKey}`);
  }
  if (account.mnemonic) {
    console.log(`${' '.repeat(prefix.length)}助记词: ${account.mnemonic}`);
  }
  if (account.type) {
    console.log(`${' '.repeat(prefix.length)}类型: ${account.type}`);
  }
  if (account.owner) {
    console.log(`${' '.repeat(prefix.length)}所有者: ${account.owner}`);
  }
}

/**
 * 打印账号集合信息
 */
function printAccountSet(set: TestAccountSet, index?: number): void {
  const prefix = index !== undefined ? `集合 ${index + 1}` : '集合';
  printSeparator(`${prefix}`);
  
  console.log('\n主账户（智能合约账户）:');
  printAccount(set.mainAccount);
  
  console.log('\n辅助账户（EOA）:');
  set.auxiliaryAccounts.forEach((account, i) => {
    printAccount(account, i);
  });
  
  console.log('\n守护人账户（EOA）:');
  set.guardians.forEach((account, i) => {
    printAccount(account, i);
  });
  
  if (set.sponsorAccount) {
    console.log('\n赞助商账户（EOA）:');
    printAccount(set.sponsorAccount);
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  // 解析命令行参数
  const args = process.argv.slice(2);
  const type = args.find(arg => arg.startsWith('--type='))?.split('=')[1] || 
               (args.includes('--type') && args[args.indexOf('--type') + 1]) || 
               'eoa';
  const count = parseInt(
    args.find(arg => arg.startsWith('--count='))?.split('=')[1] || 
    (args.includes('--count') && args[args.indexOf('--count') + 1]) || 
    '10'
  );
  const chainId = parseInt(
    args.find(arg => arg.startsWith('--chain-id='))?.split('=')[1] || 
    (args.includes('--chain-id') && args[args.indexOf('--chain-id') + 1]) || 
    '5000'
  );
  const includeSponsor = args.includes('--include-sponsor');

  console.log('🚀 测试账号生成工具');
  console.log(`\n配置:`);
  console.log(`  类型: ${type}`);
  console.log(`  链 ID: ${chainId}`);
  console.log(`  数量: ${count}`);
  if (type === 'set' || type === 'testnet') {
    console.log(`  包含赞助商: ${includeSponsor ? '是' : '否'}`);
  }

  try {
    switch (type) {
      case 'eoa': {
        printSeparator('生成 EOA 账户');
        for (let i = 0; i < Math.min(count, 10); i++) {
          const eoa = testAccountGenerator.generateEOA();
          printAccount(eoa, i);
        }
        break;
      }

      case 'mnemonic': {
        printSeparator('生成助记词账户');
        for (let i = 0; i < Math.min(count, 5); i++) {
          const account = testAccountGenerator.generateMnemonicAccount();
          printAccount(account, i);
          console.log('');
        }
        break;
      }

      case 'set': {
        printSeparator('生成测试账号集合');
        try {
          const accountSet = await generator.generateAccountSet(chainId, includeSponsor);
          printAccountSet(accountSet);
        } catch (error) {
          console.error('❌ 生成测试账号集合失败（需要链配置）:', error);
          console.log('\n提示: set 和 testnet 类型需要在有环境变量的环境中运行');
          console.log('可以尝试使用 eoa 或 mnemonic 类型，它们不需要链配置');
          process.exit(1);
        }
        break;
      }

      case 'batch': {
        printSeparator(`批量生成 ${count} 个 EOA 账户`);
        const accounts = generator.generateBatch(count, chainId);
        accounts.forEach((account, i) => {
          printAccount(account, i);
        });
        console.log(`\n总共生成了 ${accounts.length} 个账户`);
        break;
      }

      case 'testnet': {
        printSeparator('生成测试网账号集合');
        try {
          const testSets = await generator.generateTestnetAccounts(chainId);
          testSets.forEach((set, i) => {
            printAccountSet(set, i);
            console.log('');
          });
          console.log(`\n总共生成了 ${testSets.length} 组账号集合`);
        } catch (error) {
          console.error('❌ 生成测试网账号集合失败（需要链配置）:', error);
          console.log('\n提示: set 和 testnet 类型需要在有环境变量的环境中运行');
          console.log('可以尝试使用 eoa 或 mnemonic 类型，它们不需要链配置');
          process.exit(1);
        }
        break;
      }

      default:
        console.error(`❌ 未知类型: ${type}`);
        console.log('\n支持的类型:');
        console.log('  eoa       - 生成 EOA 账户');
        console.log('  mnemonic  - 生成助记词账户');
        console.log('  set       - 生成测试账号集合（默认）');
        console.log('  batch     - 批量生成 EOA 账户');
        console.log('  testnet   - 生成测试网账号集合');
        process.exit(1);
    }

    printSeparator('✅ 生成完成');
    console.log('\n提示:');
    console.log('  - 私钥和助记词请妥善保管，不要在生产环境使用');
    console.log('  - 测试账号仅用于开发和测试目的');
    console.log('  - 批量生成大量账号可能需要较长时间');

  } catch (error) {
    console.error('\n❌ 生成失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
      if (error.stack) {
        console.error('堆栈:', error.stack);
      }
    }
    process.exit(1);
  }
}

// 运行主函数
main().catch((error) => {
  console.error('未处理的错误:', error);
  process.exit(1);
});
