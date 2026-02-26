# MultiChainValidator 多链部署指南

## 📋 部署前准备

### 1. 设置环境变量

**方式 1: 使用 .env 文件（推荐）**

在 `smart-services/.env` 文件中设置：

```bash
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key  # 可选，用于合约验证
```

脚本会自动从 `.env` 文件加载环境变量。

**方式 2: 手动设置环境变量**

```bash
export PRIVATE_KEY=your_private_key_here
export ETHERSCAN_API_KEY=your_etherscan_api_key  # 可选，用于合约验证
```

### 2. 确保账户有足够的 Gas 代币

- **Mantle Sepolia**: 需要 MNT 测试币
- **Mantle Mainnet**: 需要 MNT
- **Injective Testnet**: 需要 INJ 测试币
- **Injective Mainnet**: 需要 INJ

---

## 🚀 部署步骤

### 方式 1: 使用交互式脚本（推荐）

```bash
cd smart-services
./deploy-multichain-validator.sh
```

脚本会依次询问是否部署到每个链，您可以选择性地部署。

### 方式 2: 手动部署到单个链

#### 部署到 Mantle Sepolia Testnet（推荐先部署测试网）

```bash
cd smart-services
forge script scripts/DeployMultiChainValidator.s.sol:DeployMultiChainValidator \
  --rpc-url mantle_sepolia \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --verify \
  -vvvv
```

#### 部署到 Mantle Mainnet

```bash
forge script scripts/DeployMultiChainValidator.s.sol:DeployMultiChainValidator \
  --rpc-url mantle_mainnet \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --verify \
  -vvvv
```

#### 部署到 Injective Testnet

```bash
forge script scripts/DeployMultiChainValidator.s.sol:DeployMultiChainValidator \
  --rpc-url injective_testnet \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --verify \
  -vvvv
```

#### 部署到 Injective Mainnet

```bash
forge script scripts/DeployMultiChainValidator.s.sol:DeployMultiChainValidator \
  --rpc-url injective_mainnet \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --verify \
  -vvvv
```

---

## 📝 部署后操作

### 1. 记录部署地址

部署成功后，脚本会输出类似以下信息：

```
=== Deployment Summary ===
Chain ID: 5003
MultiChainValidator: 0x...（部署地址）
```

请记录每个链的部署地址。

### 2. 更新 .env.local

编辑 `/home/lc/luckee_dao/AnDaoWallet/h5/.env.local`，更新对应链的地址：

```bash
# Mantle Sepolia Testnet
VITE_MANTLE_TESTNET_MULTI_CHAIN_VALIDATOR_ADDRESS=0x...（部署后的地址）

# Mantle Mainnet
VITE_MANTLE_MULTI_CHAIN_VALIDATOR_ADDRESS=0x...（部署后的地址）

# Injective Testnet
VITE_INJECTIVE_TESTNET_MULTI_CHAIN_VALIDATOR_ADDRESS=0x...（部署后的地址）

# Injective Mainnet
VITE_INJECTIVE_MULTI_CHAIN_VALIDATOR_ADDRESS=0x...（部署后的地址）
```

### 3. 更新部署记录文档

编辑 `docs/多链部署地址记录.md`，更新每个链的 MultiChainValidator 地址和状态。

### 4. 重启开发服务器

如果开发服务器正在运行，需要重启以加载新的环境变量：

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

---

## ✅ 验证部署

### 1. 在区块链浏览器查看

- **Mantle Sepolia**: https://sepolia.mantlescan.xyz/address/{部署地址}
- **Mantle Mainnet**: https://mantlescan.xyz/address/{部署地址}
- **Injective Testnet**: https://testnet.blockscout.injective.network/address/{部署地址}
- **Injective Mainnet**: https://blockscout.injective.network/address/{部署地址}

### 2. 验证合约代码

```bash
cast code {部署地址} --rpc-url {RPC_URL}
```

应该返回非空的字节码。

### 3. 测试账户创建

在前端应用中测试账户创建功能，确认不再出现 "MultiChainValidator 地址未配置" 的错误。

---

## 🔍 故障排查

### 问题 1: 编译错误

如果遇到编译错误，确保：
- Foundry 已正确安装：`forge --version`
- 依赖已安装：`forge install`
- Solidity 版本兼容

### 问题 2: 部署失败

如果部署失败，检查：
- 私钥是否正确设置
- 账户是否有足够的 Gas 代币
- RPC 端点是否可访问
- 网络连接是否正常

### 问题 3: 验证失败

如果合约验证失败：
- 检查 `ETHERSCAN_API_KEY` 是否正确设置
- 确认 API Key 有足够的配额
- 某些链可能需要等待一段时间才能验证

---

## 📚 相关文档

- [独立部署指南.md](./docs/独立部署指南.md)
- [多链部署地址记录.md](./docs/多链部署地址记录.md)
- [部署指南.md](./docs/部署指南.md)
