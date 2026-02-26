#!/bin/bash

# AnDaoWallet H5 - 一键上传 GitHub 并部署到 Vercel 脚本
# 用法：
#   从项目根目录运行：
#     bash ./scripts/management/deploy-github-and-vercel.sh "本次提交说明"
#
# 说明：
#   1. 先执行 ./scripts/management/upload_to_github.sh 提交并推送代码到 GitHub
#   2. 再执行项目根目录的 ./deploy-vercel.sh 构建并部署到 Vercel

# 注意：不使用 set -e，因为需要处理用户交互

echo "=== AnDaoWallet H5 - 一键部署（GitHub + Vercel） ==="
echo ""

# 计算脚本所在目录与项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📁 脚本目录: $SCRIPT_DIR"
echo "📁 项目根目录: $PROJECT_ROOT"
echo ""

cd "$PROJECT_ROOT"

# 再次确认在项目根目录
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
  echo "❌ 未在项目根目录，请在项目根目录运行此脚本："
  echo "   cd /home/lc/luckee_dao/AnDaoWallet/h5"
  echo "   bash ./scripts/management/deploy-github-and-vercel.sh \"提交说明\""
  exit 1
fi

COMMIT_MESSAGE="${1:-"chore: update AnDaoWallet H5"}"

echo "=== 第一步：提交并推送到 GitHub ==="
echo "📝 提交信息: $COMMIT_MESSAGE"
echo ""

# 使用 bash 调用已有上传脚本，避免执行权限问题
bash ./scripts/management/upload_to_github.sh "$COMMIT_MESSAGE"

echo ""
echo "✅ 代码已提交并推送到 GitHub"
echo ""

echo "=== 第二步：部署到 Vercel ==="
echo ""
echo "💡 部署方式说明："
echo "   方式1: 通过 Git 推送触发 Vercel 自动部署（推荐）"
echo "         - 部署 GitHub 上的最新代码"
echo "         - 如果 Vercel 项目已连接 GitHub，会自动触发"
echo ""
echo "   方式2: 使用 CLI 直接部署本地版本"
echo "         - 部署本地构建的代码（可能与 GitHub 不一致）"
echo "         - 需要确保本地代码已同步到 GitHub"
echo ""
read -p "请选择部署方式 (1=Git自动部署, 2=CLI部署) [默认: 1]: " -n 1 -r
echo ""

if [[ $REPLY =~ ^[2]$ ]]; then
    # 使用 CLI 部署
    echo "使用 CLI 部署本地版本..."
    bash ./deploy-vercel.sh
else
    # 通过 Git 触发自动部署
    echo "✅ 已选择 Git 自动部署方式"
    echo ""
    echo "📋 部署信息："
    echo "   - GitHub 仓库: https://github.com/iunknow588/AnDAO"
    echo "   - 分支: main"
    echo "   - 最新提交: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
    echo ""
    echo "🔄 Vercel 将自动检测到推送并触发部署"
    echo ""
    echo "💡 提示："
    echo "   - 如果 Vercel 项目已连接 GitHub，会自动触发部署"
    echo "   - 查看部署状态: https://vercel.com/iunknow588s-projects/an-dao"
    echo "   - 如果未自动部署，请检查 Vercel 项目设置中的 Git 集成"
    echo "   - 或者手动在 Vercel Dashboard 中触发部署"
    echo ""
fi

echo ""
echo "🎉 全部完成：GitHub 推送 + Vercel 部署 已执行"
echo ""
echo "=== 部署信息 ==="
echo "🌐 项目域名: https://andao.cdao.online"
echo "📦 部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "💡 提示："
echo "   - 如果域名未在 Vercel 中配置，请访问 Vercel Dashboard 添加域名"
echo "   - Vercel Dashboard: https://vercel.com/iunknow588s-projects/an-dao/settings/domains"
echo "   - 添加域名: andao.cdao.online"
echo ""
