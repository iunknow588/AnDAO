#!/bin/bash

# AnDaoWallet H5 - 一键上传 GitHub 并部署到 Vercel 脚本
# 用法：
#   从项目根目录运行：
#     bash ./deploy/deploy-github-and-vercel.sh "本次提交说明"
#
# 说明：
#   1. 先执行 ./deploy/upload_to_github.sh 提交并推送代码到 GitHub
#   2. 再执行 ./deploy/deploy-vercel.sh 构建并部署到 Vercel

set -e  # 任一步失败则退出

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
  echo "   bash ./deploy/deploy-github-and-vercel.sh \"提交说明\""
  exit 1
fi

COMMIT_MESSAGE="${1:-"chore: update AnDaoWallet H5"}"

echo "=== 第一步：提交并推送到 GitHub ==="
echo "📝 提交信息: $COMMIT_MESSAGE"
echo ""

# 使用 bash 调用已有上传脚本，避免执行权限问题
bash ./deploy/upload_to_github.sh "$COMMIT_MESSAGE"

echo ""
echo "✅ 代码已提交并（尝试）推送到 GitHub"
echo ""

echo "=== 第二步：部署到 Vercel ==="
echo ""

# 使用 bash 调用已有 Vercel 部署脚本
bash ./deploy/deploy-vercel.sh

echo ""
echo "🎉 全部完成：GitHub 推送 + Vercel 部署 已执行"
echo ""

