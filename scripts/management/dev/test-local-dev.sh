#!/usr/bin/env bash
set -euo pipefail

# AnDaoWallet H5 - 本地开发服务器测试脚本
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/project-root.sh"
PROJECT_ROOT="$(resolve_h5_project_root "$SCRIPT_DIR" 3)"
cd "$PROJECT_ROOT"

echo "=== AnDaoWallet H5 - 本地开发服务器测试 ==="
echo ""

# 默认端口
PORT=${1:-3000}
URL="http://localhost:${PORT}"

echo "测试 URL: ${URL}"
echo ""

# 检查服务器是否运行
echo "=== 检查服务器状态 ==="
if curl -s -o /dev/null -w "%{http_code}" "${URL}" | grep -q "200"; then
    echo "✅ 服务器正在运行 (HTTP 200)"
else
    echo "❌ 服务器未运行或无法访问"
    echo "   请先运行: npm run dev"
    exit 1
fi

echo ""

# 检查 HTML 内容
echo "=== 检查页面内容 ==="
HTML_CONTENT=$(curl -s "${URL}")

if echo "$HTML_CONTENT" | grep -q "AnDaoWallet"; then
    echo "✅ 页面标题正确"
else
    echo "⚠️  页面标题可能有问题"
fi

if echo "$HTML_CONTENT" | grep -q "root"; then
    echo "✅ React 根元素存在"
else
    echo "❌ React 根元素缺失"
fi

if echo "$HTML_CONTENT" | grep -q "/src/main.tsx"; then
    echo "✅ 入口文件引用正确"
else
    echo "❌ 入口文件引用缺失"
fi

echo ""

# 检查资源文件
echo "=== 检查资源文件 ==="
if curl -s -o /dev/null -w "%{http_code}" "${URL}/src/main.tsx" | grep -q "200"; then
    echo "✅ 入口文件可访问"
else
    echo "⚠️  入口文件可能无法访问"
fi

echo ""

# 总结
echo "=== 测试总结 ==="
echo "✅ 本地开发服务器测试完成"
echo ""
echo "📝 访问地址："
echo "   - 本地: ${URL}"
echo "   - 网络: http://$(hostname -I | awk '{print $1}'):${PORT}"
echo ""
echo "💡 提示："
echo "   - 在浏览器中打开上述地址查看页面"
echo "   - 修改代码后会自动热更新"
echo "   - 按 Ctrl+C 停止开发服务器"
echo ""
