#!/usr/bin/env bash
set -euo pipefail

print_vercel_config_checks() {
  echo "=== 检查Vercel配置 ==="
  if [ -f "vercel.json" ]; then
    echo "✅ vercel.json 配置文件存在"
  else
    echo "⚠️  vercel.json 配置文件不存在"
  fi

  if [ -f ".vercelignore" ]; then
    echo "✅ .vercelignore 文件存在"
  else
    echo "⚠️  .vercelignore 文件不存在"
  fi
  echo ""
}

print_vercel_env_hints() {
  echo "=== 检查环境变量配置 ==="
  if [ -f ".env.example" ] || [ -f ".env.local" ]; then
    echo "✅ 环境变量配置文件存在"
    echo "⚠️  请确保在Vercel Dashboard中配置了以下环境变量："
    echo "   - VITE_MANTLE_RPC_URL"
    echo "   - VITE_MANTLE_CHAIN_ID"
    echo "   - VITE_MANTLE_KERNEL_FACTORY_ADDRESS"
    echo "   - VITE_MANTLE_ENTRY_POINT_ADDRESS"
    echo "   - VITE_MANTLE_BUNDLER_URL"
    echo "   - VITE_MANTLE_MULTI_CHAIN_VALIDATOR_ADDRESS"
  else
    echo "⚠️  环境变量配置文件不存在"
  fi
  echo ""
}

check_dist_artifacts() {
  echo "=== 检查构建产物 ==="
  if [ ! -d "dist" ]; then
    echo "❌ dist 目录不存在"
    return 1
  fi

  if [ -f "dist/index.html" ]; then
    echo "✅ index.html 存在"
    if grep -q 'href="/favicon.ico"' dist/index.html || grep -q 'href="./favicon.ico"' dist/index.html; then
      echo "✅ 路径配置正确"
    else
      echo "⚠️  路径配置可能需要检查"
    fi
  else
    echo "❌ index.html 不存在"
    return 1
  fi

  if [ -d "dist/assets" ]; then
    echo "✅ assets 目录存在"
    local js_count css_count
    js_count=$(find dist/assets -name "*.js" | wc -l)
    css_count=$(find dist/assets -name "*.css" | wc -l)
    echo "   JavaScript文件: $js_count"
    echo "   CSS文件: $css_count"
  else
    echo "⚠️  assets 目录不存在"
  fi
  echo ""
}
