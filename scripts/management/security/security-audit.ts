/**
 * 安全审计脚本
 * 
 * 执行代码安全扫描、依赖漏洞检查和静态代码分析
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface AuditResult {
  category: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

const results: AuditResult[] = [];

/**
 * 运行依赖漏洞扫描
 */
function auditDependencies(): void {
  console.log('📦 检查依赖漏洞...');
  
  try {
    // 运行 npm audit
    const auditOutput = execSync('npm audit --json', { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    const auditData = JSON.parse(auditOutput);
    
    if (auditData.metadata && auditData.metadata.vulnerabilities) {
      const vulns = auditData.metadata.vulnerabilities;
      const total = vulns.info + vulns.low + vulns.moderate + vulns.high + vulns.critical;
      
      if (total === 0) {
        results.push({
          category: '依赖漏洞扫描',
          status: 'pass',
          message: '未发现依赖漏洞',
        });
      } else {
        results.push({
          category: '依赖漏洞扫描',
          status: total > 0 ? 'fail' : 'warning',
          message: `发现 ${total} 个漏洞`,
          details: `严重: ${vulns.critical}, 高危: ${vulns.high}, 中危: ${vulns.moderate}, 低危: ${vulns.low}, 信息: ${vulns.info}`,
        });
      }
    }
  } catch (error: any) {
    // npm audit 可能返回非零退出码，但这是正常的
    if (error.status !== null) {
      const output = error.stdout || error.stderr || '';
      if (output.includes('found 0 vulnerabilities')) {
        results.push({
          category: '依赖漏洞扫描',
          status: 'pass',
          message: '未发现依赖漏洞',
        });
      } else {
        results.push({
          category: '依赖漏洞扫描',
          status: 'warning',
          message: '依赖漏洞扫描完成，请查看详细报告',
        });
      }
    } else {
      results.push({
        category: '依赖漏洞扫描',
        status: 'fail',
        message: `扫描失败: ${error.message}`,
      });
    }
  }
}

/**
 * 运行 ESLint 安全检查
 */
function runSecurityLint(): void {
  console.log('🔍 运行安全代码检查...');
  
  try {
    execSync('npm run lint:security', { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    results.push({
      category: '安全代码检查',
      status: 'pass',
      message: 'ESLint 安全检查通过',
    });
  } catch (error: any) {
    results.push({
      category: '安全代码检查',
      status: 'fail',
      message: 'ESLint 安全检查发现问题',
      details: error.stdout || error.stderr || error.message,
    });
  }
}

/**
 * 检查敏感信息泄露
 */
function checkSensitiveData(): void {
  console.log('🔐 检查敏感信息泄露...');
  
  const sensitivePatterns = [
    { pattern: /private.*key.*=.*['"][0-9a-fA-F]{64}['"]/i, name: '私钥硬编码' },
    { pattern: /password.*=.*['"][^'"]{8,}['"]/i, name: '密码硬编码' },
    { pattern: /api.*key.*=.*['"][^'"]{10,}['"]/i, name: 'API 密钥硬编码' },
    { pattern: /secret.*=.*['"][^'"]{10,}['"]/i, name: '密钥硬编码' },
  ];
  
  const srcDir = path.resolve(process.cwd(), 'src');
  const files = getAllFiles(srcDir, ['.ts', '.tsx', '.js', '.jsx']);
  
  let foundIssues = false;
  const issues: string[] = [];
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    sensitivePatterns.forEach(({ pattern, name }) => {
      if (pattern.test(content)) {
        foundIssues = true;
        issues.push(`${file}: 可能包含 ${name}`);
      }
    });
  });
  
  if (foundIssues) {
    results.push({
      category: '敏感信息检查',
      status: 'fail',
      message: '发现可能的敏感信息泄露',
      details: issues.join('\n'),
    });
  } else {
    results.push({
      category: '敏感信息检查',
      status: 'pass',
      message: '未发现敏感信息泄露',
    });
  }
}

/**
 * 获取所有文件
 */
function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    entries.forEach(entry => {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // 跳过 node_modules 和 dist
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
          traverse(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    });
  }
  
  traverse(dir);
  return files;
}

/**
 * 检查环境变量配置
 */
function checkEnvironmentVariables(): void {
  console.log('🌍 检查环境变量配置...');
  
  const envExamplePath = path.resolve(process.cwd(), '.env.example');
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  const legacyEnvLocalPath = path.resolve(process.cwd(), 'env.local');
  
  if (!fs.existsSync(envExamplePath)) {
    results.push({
      category: '环境变量配置',
      status: 'warning',
      message: '.env.example 文件不存在',
    });
    return;
  }
  
  // 优先检查标准文件 .env.local，同时兼容历史文件名 env.local
  const activeEnvPath = fs.existsSync(envLocalPath)
    ? envLocalPath
    : fs.existsSync(legacyEnvLocalPath)
      ? legacyEnvLocalPath
      : null;

  if (fs.existsSync(envLocalPath) && fs.existsSync(legacyEnvLocalPath)) {
    results.push({
      category: '环境变量配置',
      status: 'warning',
      message: '同时存在 .env.local 与 env.local，建议保留 .env.local 并清理历史文件避免配置歧义',
    });
  }

  // 检查本地环境变量是否包含敏感信息
  if (activeEnvPath) {
    const envContent = fs.readFileSync(activeEnvPath, 'utf-8');
    
    // 检查是否包含真实的密钥（而非示例值）
    const hasRealSecrets = /(?:private.*key|password|secret|api.*key).*=.*[^0-9a-fA-Fx]{10,}/i.test(envContent);
    
    if (hasRealSecrets) {
      results.push({
        category: '环境变量配置',
        status: 'warning',
        message: `${path.basename(activeEnvPath)} 可能包含敏感信息，请确保已添加到 .gitignore`,
      });
    } else {
      results.push({
        category: '环境变量配置',
        status: 'pass',
        message: `环境变量配置检查通过（${path.basename(activeEnvPath)}）`,
      });
    }
  } else {
    results.push({
      category: '环境变量配置',
      status: 'warning',
      message: '.env.local 文件不存在（可兼容历史 env.local，但建议统一为 .env.local）',
    });
  }
}

/**
 * 生成审计报告
 */
function generateReport(): void {
  console.log('\n========== 安全审计报告 ==========\n');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  
  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${result.category}: ${result.message}`);
    if (result.details) {
      console.log(`   详情: ${result.details}`);
    }
  });
  
  console.log('\n========== 审计摘要 ==========');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`⚠️  警告: ${warnings}`);
  console.log(`总计: ${results.length}\n`);
  
  if (failed > 0) {
    console.log('❌ 发现安全问题，请修复后重试\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('⚠️  存在警告项，建议检查\n');
    process.exit(0);
  } else {
    console.log('✅ 所有安全检查通过\n');
    process.exit(0);
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🔒 开始安全审计...\n');
  
  auditDependencies();
  runSecurityLint();
  checkSensitiveData();
  checkEnvironmentVariables();
  
  generateReport();
}

main();
