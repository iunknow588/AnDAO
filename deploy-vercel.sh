#!/bin/bash

# AnDaoWallet H5 - Vercel部署脚本
echo "=== AnDaoWallet H5 - Vercel部署脚本 ==="
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 检查Vercel CLI是否安装
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI未安装，请先安装："
    echo "npm install -g vercel"
    exit 1
fi

echo "✅ 环境检查通过"
echo ""

# 构建项目
echo "=== 构建项目 ==="
echo "正在构建项目（Vercel部署）..."
if npm run build; then
    echo "✅ 构建成功"
else
    echo "❌ 构建失败"
    exit 1
fi

echo ""

# 检查构建结果
echo "=== 检查构建结果 ==="
if [ ! -d "dist" ]; then
    echo "❌ dist目录不存在"
    exit 1
fi

# 检查HTML文件路径
if grep -q 'href="/favicon.ico"' dist/index.html || grep -q 'href="./favicon.ico"' dist/index.html; then
    echo "✅ 路径配置正确（Vercel根路径）"
else
    echo "⚠️  路径配置可能需要检查"
fi

echo "✅ 构建结果检查通过"
echo ""

# 检查智能合约目录是否被排除
echo "=== 检查部署配置 ==="
if [ -f ".vercelignore" ] && grep -q "smart-services" .vercelignore; then
    echo "✅ smart-services 目录已在 .vercelignore 中排除"
else
    echo "⚠️  建议将 smart-services 目录添加到 .vercelignore"
fi

if [ -f "vercel.json" ]; then
    echo "✅ vercel.json 配置文件存在"
else
    echo "⚠️  vercel.json 配置文件不存在，将使用默认配置"
fi

echo ""

# 检查 Git 状态
echo "=== 检查 Git 同步状态 ==="
if [ -d ".git" ]; then
    # 检查是否有未提交的更改
    if ! git diff-index --quiet HEAD --; then
        echo "⚠️  警告: 检测到未提交的更改"
        echo "   使用 CLI 部署会部署本地未提交的版本"
        echo "   建议先提交并推送到 GitHub，然后通过 Git 触发 Vercel 自动部署"
        echo ""
        read -p "是否继续使用 CLI 部署本地版本？(y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ 部署已取消，请先提交代码"
            exit 1
        fi
    fi
    
    # 检查本地和远程是否同步
    git fetch origin 2>/dev/null || true
    LOCAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
    REMOTE_COMMIT=$(git rev-parse origin/main 2>/dev/null || echo "")
    
    if [ -n "$LOCAL_COMMIT" ] && [ -n "$REMOTE_COMMIT" ] && [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
        echo "⚠️  警告: 本地代码与 GitHub 不同步"
        echo "   本地提交: ${LOCAL_COMMIT:0:8}"
        echo "   远程提交: ${REMOTE_COMMIT:0:8}"
        echo "   使用 CLI 部署会部署本地版本，而不是 GitHub 上的版本"
        echo ""
        read -p "是否继续使用 CLI 部署本地版本？(y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "💡 建议: 先推送代码到 GitHub，然后通过 Git 触发 Vercel 自动部署"
            echo "   git push origin main"
            exit 1
        fi
    else
        echo "✅ Git 同步状态正常"
    fi
else
    echo "⚠️  未检测到 Git 仓库，将直接部署本地版本"
fi

echo ""

# 部署到Vercel
echo "=== 部署到Vercel ==="
echo "正在部署到Vercel（使用本地构建版本）..."
echo ""
echo "💡 提示: 如果希望部署 GitHub 上的版本，请使用 Git 推送触发自动部署"
echo ""

if vercel --prod --yes; then
    echo ""
    echo "🎉 部署成功！"
    echo ""
    echo "=== 部署信息 ==="
    echo "🌐 项目域名: https://andao.cdao.online"
    echo "🌐 Vercel地址: 请查看上方Vercel输出的URL"
    echo "📁 构建目录: dist"
    echo "📦 智能合约目录: smart-services (已排除)"
    echo "⏰ 部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "=== 后续步骤 ==="
    echo "1. 访问项目域名: https://andao.cdao.online"
    echo "2. 访问Vercel控制台查看部署状态"
    echo "3. 测试应用功能是否正常"
    echo "4. 验证环境变量配置是否正确"
    echo ""
    echo "💡 如果域名未配置，请在Vercel Dashboard中添加:"
    echo "   https://vercel.com/iunknow588s-projects/an-dao/settings/domains"
    echo ""
else
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi
