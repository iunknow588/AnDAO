#!/usr/bin/env tsx
/**
 * 测试账号生成工具运行脚本（简化版）
 * 
 * 不依赖项目配置，可以直接运行生成EOA和助记词账户
 * 
 * 使用方法:
 *   npm run test:accounts:simple
 *   或
 *   tsx scripts/functional/generate-test-accounts-simple.ts [选项]
 * 
 * 选项:
 *   --count <number>     批量生成账号数量 (默认: 5)
 *   --type <type>        生成类型: eoa, mnemonic (默认: eoa)
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';
import { Wallet } from 'ethers';

/**
 * 生成EOA账户
 */
function generateEOA(seed?: string): { address: Address; privateKey: Hex } {
  let privateKey: Hex;
  
  if (seed) {
    // 使用种子生成确定性私钥（简单实现）
    const encoder = new TextEncoder();
    const seedBytes = encoder.encode(seed);
    const hash = seedBytes.reduce((acc, byte) => acc + byte, 0);
    privateKey = `0x${hash.toString(16).padStart(64, '0')}` as Hex;
  } else {
    privateKey = generatePrivateKey();
  }

  const account = privateKeyToAccount(privateKey);
  
  return {
    address: account.address,
    privateKey,
  };
}

/**
 * 生成助记词账户
 */
function generateMnemonicAccount(): {
  mnemonic: string;
  address: Address;
  privateKey: Hex;
} {
  const wallet = Wallet.createRandom();
  const mnemonic = wallet.mnemonic?.phrase;
  
  if (!mnemonic) {
    throw new Error('Failed to generate mnemonic phrase');
  }
  
  return {
    mnemonic,
    address: wallet.address as Address,
    privateKey: wallet.privateKey as Hex,
  };
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
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const type = args.find(arg => arg.startsWith('--type='))?.split('=')[1] || 
               (args.includes('--type') && args[args.indexOf('--type') + 1]) || 
               'eoa';
  const count = parseInt(
    args.find(arg => arg.startsWith('--count='))?.split('=')[1] || 
    (args.includes('--count') && args[args.indexOf('--count') + 1]) || 
    '5'
  );

  console.log('🚀 测试账号生成工具（简化版）');
  console.log(`\n配置:`);
  console.log(`  类型: ${type}`);
  console.log(`  数量: ${count}`);
  console.log('');

  try {
    if (type === 'eoa') {
      console.log('='.repeat(80));
      console.log('  生成 EOA 账户');
      console.log('='.repeat(80));
      for (let i = 0; i < count; i++) {
        const eoa = generateEOA();
        printAccount(eoa, i);
        console.log('');
      }
    } else if (type === 'mnemonic') {
      console.log('='.repeat(80));
      console.log('  生成助记词账户');
      console.log('='.repeat(80));
      for (let i = 0; i < Math.min(count, 5); i++) {
        const account = generateMnemonicAccount();
        printAccount(account, i);
        console.log('');
      }
    } else {
      console.error(`❌ 未知类型: ${type}`);
      console.log('\n支持的类型:');
      console.log('  eoa       - 生成 EOA 账户');
      console.log('  mnemonic  - 生成助记词账户');
      process.exit(1);
    }

    console.log('='.repeat(80));
    console.log('  ✅ 生成完成');
    console.log('='.repeat(80));
    console.log('\n提示:');
    console.log('  - 私钥和助记词请妥善保管，不要在生产环境使用');
    console.log('  - 测试账号仅用于开发和测试目的');

  } catch (error) {
    console.error('\n❌ 生成失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('未处理的错误:', error);
  process.exit(1);
});
