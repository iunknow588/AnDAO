#!/bin/bash

# Vercel 项目重命名脚本
# 使用方法: ./deploy/rename-vercel-project.sh <old-name> <new-name>
# 示例: ./deploy/rename-vercel-project.sh h5 an-dao

set -e

OLD_NAME="${1:-h5}"
NEW_NAME="${2:-an-dao}"

echo "=== Vercel 项目重命名 ==="
echo "原项目名称: $OLD_NAME"
echo "新项目名称: $NEW_NAME"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 检查 Vercel CLI 是否安装
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI未安装，请先安装："
    echo "npm install -g vercel"
    exit 1
fi

echo "⚠️  注意: Vercel CLI 不支持直接重命名项目"
echo "📋 重命名项目需要通过以下方式之一："
echo ""
echo "方法一：通过 Vercel 控制台（推荐）"
echo "1. 访问 https://vercel.com/iunknow588s-projects/$OLD_NAME/settings"
echo "2. 在 'General' 部分找到 'Project Name' 字段"
echo "3. 将项目名称从 '$OLD_NAME' 修改为 '$NEW_NAME'"
echo "4. 点击 'Save' 保存更改"
echo ""
echo "方法二：使用 Vercel API（需要 API Token）"
echo "1. 获取 Vercel API Token: https://vercel.com/account/tokens"
echo "2. 使用以下命令重命名："
echo "   curl -X PATCH 'https://api.vercel.com/v9/projects/prj_2hgxFCPph1MYENUSResjZtWj128v' \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"name\":\"$NEW_NAME\"}'"
echo ""
echo "当前项目 ID: prj_2hgxFCPph1MYENUSResjZtWj128v"
echo "项目 URL: https://vercel.com/iunknow588s-projects/$OLD_NAME"
echo ""
echo "✅ 请按照上述方法之一完成项目重命名"