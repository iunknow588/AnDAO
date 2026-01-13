#!/bin/bash

# 将 Vercel 项目从 h5 重命名为 an-dao
# 注意：此脚本需要 Vercel API Token
# 获取 Token: https://vercel.com/account/tokens

set -e

PROJECT_ID="prj_2hgxFCPph1MYENUSResjZtWj128v"
NEW_NAME="an-dao"

echo "=== 重命名 Vercel 项目 ==="
echo "项目 ID: $PROJECT_ID"
echo "新名称: $NEW_NAME"
echo ""

# 检查 API Token
if [ -z "$VERCEL_TOKEN" ]; then
    echo "❌ 错误: 未设置 VERCEL_TOKEN 环境变量"
    echo ""
    echo "请按以下步骤操作："
    echo "1. 访问 https://vercel.com/account/tokens 创建 API Token"
    echo "2. 设置环境变量: export VERCEL_TOKEN=your_token_here"
    echo "3. 重新运行此脚本"
    echo ""
    echo "或者，您可以通过 Vercel 控制台手动重命名："
    echo "1. 访问 https://vercel.com/iunknow588s-projects/h5/settings"
    echo "2. 在 'General' 部分找到 'Project Name' 字段"
    echo "3. 将项目名称从 'h5' 修改为 'an-dao'"
    echo "4. 点击 'Save' 保存更改"
    exit 1
fi

# 使用 API 重命名项目
echo "正在使用 Vercel API 重命名项目..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "https://api.vercel.com/v9/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$NEW_NAME\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ 项目已成功重命名为 '$NEW_NAME'"
    echo ""
    echo "响应: $BODY"
    echo ""
    
    # 更新本地 .vercel 配置
    if [ -f ".vercel/project.json" ]; then
        echo "更新本地配置..."
        cat > .vercel/project.json << EOF
{"projectId":"$PROJECT_ID","orgId":"team_1WS6odoWkVtMeWzwIbJgwYji","projectName":"$NEW_NAME"}
EOF
        echo "✅ 本地配置已更新"
    fi
    
    echo ""
    echo "🎉 重命名完成！"
    echo "项目 URL: https://vercel.com/iunknow588s-projects/$NEW_NAME"
else
    echo "❌ 重命名失败 (HTTP $HTTP_CODE)"
    echo "响应: $BODY"
    echo ""
    echo "请检查："
    echo "1. VERCEL_TOKEN 是否正确"
    echo "2. 项目 ID 是否正确"
    echo "3. 项目名称 'an-dao' 是否可用"
    exit 1
fi
