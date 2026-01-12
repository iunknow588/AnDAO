/**
 * PWA 功能验证脚本
 * 
 * 验证 PWA 的可安装性、离线访问和更新机制
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

const results: VerificationResult[] = [];

/**
 * 检查文件是否存在
 */
function checkFileExists(filePath: string, description: string): boolean {
  const fullPath = path.resolve(process.cwd(), filePath);
  const exists = fs.existsSync(fullPath);
  
  results.push({
    name: description,
    status: exists ? 'pass' : 'fail',
    message: exists 
      ? `文件存在: ${filePath}`
      : `文件不存在: ${filePath}`
  });
  
  return exists;
}

/**
 * 检查 manifest.json 配置
 */
function checkManifest(): void {
  const manifestPath = 'public/manifest.json';
  
  if (!checkFileExists(manifestPath, 'manifest.json 文件')) {
    return;
  }
  
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    
    // 检查必需字段
    const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
    requiredFields.forEach(field => {
      const hasField = manifest[field] !== undefined;
      results.push({
        name: `manifest.json: ${field}`,
        status: hasField ? 'pass' : 'fail',
        message: hasField 
          ? `字段 ${field} 存在`
          : `字段 ${field} 缺失`
      });
    });
    
    // 检查图标
    if (manifest.icons && Array.isArray(manifest.icons)) {
      manifest.icons.forEach((icon: any, index: number) => {
        const iconPath = path.resolve(process.cwd(), 'public', icon.src);
        const iconExists = fs.existsSync(iconPath);
        results.push({
          name: `manifest.json: 图标 ${index + 1}`,
          status: iconExists ? 'pass' : 'fail',
          message: iconExists 
            ? `图标文件存在: ${icon.src}`
            : `图标文件不存在: ${icon.src}`
        });
      });
    }
  } catch (error) {
    results.push({
      name: 'manifest.json 解析',
      status: 'fail',
      message: `无法解析 manifest.json: ${error}`
    });
  }
}

/**
 * 检查 Service Worker 配置
 */
function checkServiceWorker(): void {
  // 检查 vite.config.ts 中的 PWA 配置
  const viteConfigPath = 'vite.config.ts';
  
  if (!checkFileExists(viteConfigPath, 'vite.config.ts 文件')) {
    return;
  }
  
  try {
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');
    
    // 检查 vite-plugin-pwa 配置
    const hasPWAPlugin = viteConfig.includes('VitePWA') || viteConfig.includes('vite-plugin-pwa');
    results.push({
      name: 'VitePWA 插件配置',
      status: hasPWAPlugin ? 'pass' : 'fail',
      message: hasPWAPlugin 
        ? 'VitePWA 插件已配置'
        : 'VitePWA 插件未配置'
    });
    
    // 检查 workbox 配置
    const hasWorkbox = viteConfig.includes('workbox');
    results.push({
      name: 'Workbox 配置',
      status: hasWorkbox ? 'pass' : 'warning',
      message: hasWorkbox 
        ? 'Workbox 配置已存在'
        : 'Workbox 配置未找到（可选）'
    });
  } catch (error) {
    results.push({
      name: 'vite.config.ts 读取',
      status: 'fail',
      message: `无法读取 vite.config.ts: ${error}`
    });
  }
}

/**
 * 检查 HTTPS 配置（PWA 需要 HTTPS）
 */
function checkHTTPS(): void {
  results.push({
    name: 'HTTPS 配置',
    status: 'warning',
    message: 'HTTPS 配置需要在生产环境验证（本地开发可以使用 localhost）'
  });
}

/**
 * 检查图标文件
 */
function checkIcons(): void {
  const iconSizes = [
    { size: '192x192', file: 'pwa-192x192.png' },
    { size: '512x512', file: 'pwa-512x512.png' },
  ];
  
  iconSizes.forEach(({ size, file }) => {
    const iconPath = path.resolve(process.cwd(), 'public', file);
    const exists = fs.existsSync(iconPath);
    results.push({
      name: `PWA 图标 ${size}`,
      status: exists ? 'pass' : 'warning',
      message: exists 
        ? `图标文件存在: ${file}`
        : `图标文件不存在: ${file}（需要创建）`
    });
  });
}

/**
 * 生成验证报告
 */
function generateReport(): void {
  console.log('\n========== PWA 功能验证报告 ==========\n');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  
  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${result.name}: ${result.message}`);
  });
  
  console.log('\n========== 验证摘要 ==========');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`⚠️  警告: ${warnings}`);
  console.log(`总计: ${results.length}\n`);
  
  if (failed > 0) {
    console.log('⚠️  存在失败的检查项，请修复后重试\n');
    process.exit(1);
  } else {
    console.log('✅ 所有必需检查项通过\n');
  }
}

/**
 * 主函数
 */
function main() {
  console.log('开始 PWA 功能验证...\n');
  
  checkManifest();
  checkServiceWorker();
  checkIcons();
  checkHTTPS();
  
  generateReport();
}

main();

