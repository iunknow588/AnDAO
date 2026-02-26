#!/bin/bash

# AnDaoWallet H5 - 本地开发服务器启动脚本
echo "=== AnDaoWallet H5 - 本地开发服务器 ==="
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules 不存在，正在安装依赖..."
    if npm install; then
        echo "✅ 依赖安装成功"
    else
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo ""
fi

echo "✅ 环境检查通过"
echo ""

# 启动开发服务器
echo "=== 启动开发服务器 ==="
echo "正在启动 Vite 开发服务器..."
echo ""
echo "📝 提示："
echo "   - 开发服务器将在 http://localhost:3000 启动"
echo "   - 按 Ctrl+C 停止服务器"
echo "   - 修改代码后会自动热更新"
echo ""

npm run dev
