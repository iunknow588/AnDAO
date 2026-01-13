# 快速部署指南

## ✅ 项目已配置完成

项目现在可以在 `smart-services` 目录下独立运行，无需依赖 `kernel-dev` 目录。

## 📦 已安装的依赖

- ✅ forge-std (Foundry 标准库)
- ✅ solady (Solidity 工具库)
- ✅ ExcessivelySafeCall (安全调用库)

## 🚀 快速部署到测试网

### 1. 设置环境变量

```bash
export PRIVATE_KEY=your_private_key_here
export ETHERSCAN_API_KEY=your_etherscan_api_key  # 可选，用于合约验证
```

### 2. 编译合约

```bash
cd smart-services
forge build
```

### 3. 部署 MultiChainValidator

```bash
forge script scripts/DeployMultiChain.s.sol:DeployMultiChain \
  --rpc-url mantle_sepolia \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --verify \
  -vvvv
```

### 4. 部署核心合约（如果需要）

```bash
forge script scripts/Deploy.s.sol:Deploy \
  --rpc-url mantle_sepolia \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --verify \
  -vvvv
```

## 📝 注意事项

1. 确保部署账户有足够的 MNT 测试币
2. 部署后记录合约地址，用于更新前端配置
3. 所有操作都在 `smart-services` 目录下进行

## 🔍 验证部署

部署成功后，可以在以下地址查看：
- 测试网: https://sepolia.mantlescan.xyz/
- 主网: https://mantlescan.xyz/
