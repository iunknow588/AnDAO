#!/bin/bash

# MultiChainValidator 多链部署脚本（支持增量部署）
# 此脚本用于部署 MultiChainValidator 到多个链
# 支持自动检查已部署状态，避免重复部署

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 解析命令行参数
FORCE_DEPLOY=false
REDEPLOY_ALL=false
CHECK_ONLY=false
SPECIFIC_CHAINS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_DEPLOY=true
            shift
            ;;
        --redeploy-all)
            REDEPLOY_ALL=true
            FORCE_DEPLOY=true  # 重新部署全部链时，自动启用强制模式
            shift
            ;;
        --check)
            CHECK_ONLY=true
            shift
            ;;
        --chain)
            SPECIFIC_CHAINS+=("$2")
            shift 2
            ;;
        --help)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --redeploy-all    重新部署全部链（智能合约更新时使用，忽略已部署检查）"
            echo "  --force           强制重新部署指定链（忽略已部署检查）"
            echo "  --check           仅检查部署状态，不执行部署"
            echo "  --chain <链名>    只部署指定的链（可多次使用，默认增量部署）"
            echo "  --help            显示此帮助信息"
            echo ""
            echo "示例:"
            echo "  $0                                    # 增量部署所有链（自动跳过已部署，默认模式）"
            echo "  $0 --chain mantle_sepolia            # 只部署 Mantle Sepolia 测试网（增量部署）"
            echo "  $0 --force --chain mantle_sepolia    # 强制重新部署 Mantle Sepolia 测试网"
            echo "  $0 --redeploy-all                    # 重新部署全部链（智能合约更新后使用）"
            echo "  $0 --check                           # 检查所有链的部署状态"
            exit 0
            ;;
        *)
            echo "❌ 未知参数: $1"
            echo "使用 --help 查看帮助信息"
            exit 1
            ;;
    esac
done

echo "=========================================="
echo "多链验证器部署脚本（支持增量部署）"
echo "=========================================="
if [ "$REDEPLOY_ALL" = true ]; then
    echo -e "${YELLOW}⚠️  全量部署模式：将重新部署所有链${NC}"
    # 全量部署模式忽略 --chain 参数
    if [ ${#SPECIFIC_CHAINS[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  注意：--redeploy-all 模式将忽略 --chain 参数，重新部署所有链${NC}"
        SPECIFIC_CHAINS=()
    fi
elif [ "$FORCE_DEPLOY" = true ]; then
    echo -e "${YELLOW}⚠️  强制部署模式${NC}"
else
    echo -e "${GREEN}✅ 增量部署模式：自动跳过已部署的链${NC}"
fi
echo ""

# 从 .env 文件加载环境变量（如果存在）
if [ -f ".env" ]; then
    echo "📄 从 .env 文件加载环境变量..."
    set -a
    source .env
    set +a
    echo "✅ 环境变量加载完成"
    echo ""
fi

# 检查环境变量
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ 错误: 私钥环境变量未设置"
    echo "请设置: export PRIVATE_KEY=your_private_key_here"
    echo "或者在 .env 文件中设置: PRIVATE_KEY=your_private_key_here"
    exit 1
fi

# 检查是否在正确的目录
if [ ! -f "foundry.toml" ]; then
    echo "❌ 错误: 请在 smart-services 目录下运行此脚本"
    exit 1
fi

# 读取本地环境变量文件（优先 .env.local，兼容历史 env.local）
ENV_LOCAL_FILE="../.env.local"
if [ ! -f "$ENV_LOCAL_FILE" ]; then
    ENV_LOCAL_FILE="../env.local"
fi
if [ ! -f "$ENV_LOCAL_FILE" ]; then
    ENV_LOCAL_FILE=".env.local"
fi
if [ ! -f "$ENV_LOCAL_FILE" ]; then
    ENV_LOCAL_FILE="env.local"
fi

# 获取已配置的地址
get_configured_address() {
    local env_var=$1
    if [ -f "$ENV_LOCAL_FILE" ]; then
        grep "^${env_var}=" "$ENV_LOCAL_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo ""
    else
        echo ""
    fi
}

# 检查部署状态
check_deployment_status() {
    local chain_name=$1
    local env_var=$2
    local rpc_alias=$3
    
    local configured_addr=$(get_configured_address "$env_var")
    
    if [ -n "$configured_addr" ] && [ "$configured_addr" != "" ]; then
        echo -e "${YELLOW}⚠️  检测到已配置地址: ${configured_addr}${NC}"
        
        # 如果只是检查模式，验证链上状态
        if [ "$CHECK_ONLY" = true ]; then
            echo "正在验证链上状态..."
            local code=$(cast code "$configured_addr" --rpc-url "$rpc_alias" 2>/dev/null || echo "0x")
            if [ -n "$code" ] && [ "$code" != "0x" ]; then
                echo -e "${GREEN}✅ 链上验证成功：合约已部署${NC}"
            else
                echo -e "${RED}❌ 链上验证失败：地址无代码（可能配置错误）${NC}"
            fi
        fi
        
        return 0  # 已部署
    else
        return 1  # 未部署
    fi
}

# 编译合约
if [ "$CHECK_ONLY" != true ]; then
    echo "=== 步骤 1: 编译合约 ==="
    forge build --via-ir
    echo "✅ 合约编译完成"
    echo ""
fi

# 部署函数
deploy_to_chain() {
    local chain_name=$1
    local rpc_alias=$2
    local chain_id=$3
    local env_var=$4
    
    echo "=========================================="
    echo "部署到: $chain_name (链 ID: $chain_id)"
    echo "=========================================="
    
    # 检查是否已部署（除非强制模式或全量部署模式）
    if [ "$FORCE_DEPLOY" != true ] && [ "$CHECK_ONLY" != true ]; then
        if check_deployment_status "$chain_name" "$env_var" "$rpc_alias"; then
            echo -e "${YELLOW}检测到已部署，默认跳过（增量部署模式）${NC}"
            echo "如需重新部署，请使用:"
            echo "  - 重新部署单个链: $0 --force --chain $rpc_alias"
            echo "  - 重新部署全部链: $0 --redeploy-all"
            echo ""
            return 0
        fi
    fi
    
    if [ "$CHECK_ONLY" = true ]; then
        check_deployment_status "$chain_name" "$env_var" "$rpc_alias"
        echo ""
        return 0
    fi
    
    # 如果不是强制模式或全量部署模式，询问确认
    if [ "$FORCE_DEPLOY" != true ] && [ "$REDEPLOY_ALL" != true ]; then
        echo "5秒后自动开始部署，输入 n 可取消..."
        read -t 5 -p "是否部署到 $chain_name? (是/否，默认是): " confirm || confirm=""
        if [ "$confirm" = "n" ] || [ "$confirm" = "N" ] || [ "$confirm" = "否" ]; then
            echo "⏭️  跳过 $chain_name"
            echo ""
            return 0
        fi
    elif [ "$REDEPLOY_ALL" = true ]; then
        echo -e "${YELLOW}全量部署模式：将重新部署此链${NC}"
    fi
    
    echo "正在部署..."
    
    # 构建部署命令
    local deploy_cmd="forge script scripts/DeployMultiChainValidator.s.sol:DeployMultiChainValidator \
        --rpc-url $rpc_alias \
        --broadcast \
        --private-key $PRIVATE_KEY \
        --via-ir \
        -vvvv"
    
    # 如果设置了 ETHERSCAN_API_KEY，则添加验证选项
    if [ -n "$ETHERSCAN_API_KEY" ]; then
        echo "📝 将进行合约验证..."
        deploy_cmd="$deploy_cmd --verify"
    else
        echo "⚠️  未设置 ETHERSCAN_API_KEY，跳过合约验证"
    fi
    
    # 执行部署
    eval $deploy_cmd
    
    echo ""
    echo "✅ $chain_name 部署完成"
    echo "⚠️  请手动更新 $ENV_LOCAL_FILE 文件中的 $env_var 地址"
    echo ""
}

# 链配置：链名|RPC别名|链ID|环境变量名
declare -a CHAIN_CONFIGS=(
    "Mantle Sepolia 测试网|mantle_sepolia|5003|VITE_MANTLE_TESTNET_MULTI_CHAIN_VALIDATOR_ADDRESS"
    "Mantle 主网|mantle_mainnet|5000|VITE_MANTLE_MULTI_CHAIN_VALIDATOR_ADDRESS"
    "Injective 测试网|injective_testnet|1439|VITE_INJECTIVE_TESTNET_MULTI_CHAIN_VALIDATOR_ADDRESS"
    "Injective 主网|injective_mainnet|1776|VITE_INJECTIVE_MULTI_CHAIN_VALIDATOR_ADDRESS"
)

# 部署到各个链
if [ "$CHECK_ONLY" = true ]; then
    echo "=== 检查部署状态 ==="
else
    echo "=== 步骤 2: 开始部署 ==="
fi
echo ""

deployed_count=0
skipped_count=0
total_processed=0

for config in "${CHAIN_CONFIGS[@]}"; do
    IFS='|' read -r chain_name rpc_alias chain_id env_var <<< "$config"
    
    # 如果指定了特定链，检查是否匹配（全量部署模式时已清空 SPECIFIC_CHAINS）
    if [ ${#SPECIFIC_CHAINS[@]} -gt 0 ]; then
        local match=false
        for specified_chain in "${SPECIFIC_CHAINS[@]}"; do
            if [ "$rpc_alias" = "$specified_chain" ]; then
                match=true
                break
            fi
        done
        if [ "$match" = false ]; then
            continue
        fi
    fi
    
    # 记录是否在处理前已部署
    local was_deployed=false
    if check_deployment_status "$chain_name" "$env_var" "$rpc_alias" >/dev/null 2>&1; then
        was_deployed=true
    fi
    
    # 执行部署
    if deploy_to_chain "$chain_name" "$rpc_alias" "$chain_id" "$env_var"; then
        ((total_processed++))
        # 统计：如果是全量部署模式，所有处理的链都算作部署
        if [ "$REDEPLOY_ALL" = true ]; then
            ((deployed_count++))
        # 如果是增量部署模式，根据是否实际部署来判断
        elif [ "$FORCE_DEPLOY" = true ]; then
            # 强制模式总是部署
            ((deployed_count++))
        elif [ "$was_deployed" = true ]; then
            # 已部署的链被跳过
            ((skipped_count++))
        else
            # 新部署的链
            ((deployed_count++))
        fi
    fi
done

    echo "=========================================="
    if [ "$CHECK_ONLY" = true ]; then
        echo "检查完成！"
    else
        echo "部署完成！"
        echo ""
        echo "📊 统计:"
        if [ "$REDEPLOY_ALL" = true ]; then
            echo "  - 重新部署: $deployed_count 个链（全量部署模式）"
        elif [ "$FORCE_DEPLOY" = true ]; then
            echo "  - 强制部署: $deployed_count 个链"
        else
            echo "  - 新部署: $deployed_count 个链"
            echo "  - 已跳过: $skipped_count 个链（增量部署模式）"
        fi
        echo "  - 总计处理: $total_processed 个链"
    fi
echo "=========================================="
echo ""
echo "📝 下一步操作："
echo "1. 记录每个链的多链验证器部署地址"
echo "2. 更新 $ENV_LOCAL_FILE 文件中的地址配置"
echo "3. 更新 docs/多链部署地址记录.md"
echo "4. 重启开发服务器（如果正在运行）"
echo ""
echo "💡 提示:"
echo "  - 使用 --check 参数检查部署状态"
echo "  - 默认增量部署模式，自动跳过已部署的链"
echo "  - 使用 --redeploy-all 重新部署全部链（智能合约更新后使用）"
echo "  - 使用 --force --chain <链名> 强制重新部署指定链"
echo "  - 使用 --chain <链名> 只部署指定链（增量部署）"
echo ""
