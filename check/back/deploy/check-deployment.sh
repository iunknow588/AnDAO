#!/bin/bash

# AnDaoWallet H5 - 部署前检查脚本
echo "=== AnDaoWallet H5 - 部署前检查 ==="
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

echo "✅ 项目目录检查通过"
echo ""

# 检查构建
echo "=== 检查构建 ==="
if [ ! -d "dist" ]; then
    echo "⚠️  dist目录不存在，正在构建..."
    if npm run build; then
        echo "✅ 构建成功"
    else
        echo "❌ 构建失败"
        exit 1
    fi
else
    echo "✅ dist目录存在"
fi

echo ""

# 检查Vercel配置
echo "=== 检查Vercel配置 ==="
if [ -f "vercel.json" ]; then
    echo "✅ vercel.json 配置文件存在"
else
    echo "⚠️  vercel.json 配置文件不存在"
fi

if [ -f ".vercelignore" ]; then
    echo "✅ .vercelignore 文件存在"
    if grep -q "smart-services" .vercelignore; then
        echo "✅ smart-services 目录已在 .vercelignore 中排除"
    else
        echo "⚠️  smart-services 目录未在 .vercelignore 中排除"
    fi
else
    echo "⚠️  .vercelignore 文件不存在"
fi

echo ""

# 检查智能合约目录
echo "=== 检查智能合约目录 ==="
if [ -d "smart-services" ]; then
    echo "✅ smart-services 目录存在"
    if [ -d "smart-services/contracts/src" ]; then
        echo "✅ 合约源码目录存在"
    else
        echo "⚠️  合约源码目录不存在"
    fi
else
    echo "⚠️  smart-services 目录不存在"
fi

echo ""

# 检查环境变量配置
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

# 检查构建产物
echo "=== 检查构建产物 ==="
if [ -d "dist" ]; then
    if [ -f "dist/index.html" ]; then
        echo "✅ index.html 存在"
        
        # 检查路径配置
        if grep -q 'href="/favicon.ico"' dist/index.html || grep -q 'href="./favicon.ico"' dist/index.html; then
            echo "✅ 路径配置正确"
        else
            echo "⚠️  路径配置可能需要检查"
        fi
    else
        echo "❌ index.html 不存在"
    fi
    
    if [ -d "dist/assets" ]; then
        echo "✅ assets 目录存在"
        JS_COUNT=$(find dist/assets -name "*.js" | wc -l)
        CSS_COUNT=$(find dist/assets -name "*.css" | wc -l)
        echo "   JavaScript文件: $JS_COUNT"
        echo "   CSS文件: $CSS_COUNT"
    else
        echo "⚠️  assets 目录不存在"
    fi
else
    echo "❌ dist 目录不存在"
fi

echo ""

# 总结
echo "=== 检查总结 ==="
echo "如果所有检查都通过，可以部署到Vercel："
echo ""
echo "方法1 - 使用脚本："
echo "  ./deploy/deploy-vercel.sh"
echo ""
echo "方法2 - 使用Vercel CLI："
echo "  vercel --prod"
echo ""
echo "方法3 - 通过Git推送："
echo "  git push origin main"
echo ""
