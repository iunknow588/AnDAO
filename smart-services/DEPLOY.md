# 智能合约部署指南

## 网络配置

根据 [Mantle 官方文档](https://docs.mantle.xyz/network/for-developers/quick-access) 配置：

### Mantle 主网
- **RPC URL**: https://rpc.mantle.xyz
- **Chain ID**: 5000
- **Explorer**: https://mantlescan.xyz/
- **Token Symbol**: MNT

### Mantle Sepolia 测试网
- **RPC URL**: https://rpc.sepolia.mantle.xyz
- **Chain ID**: 5003
- **Explorer**: https://sepolia.mantlescan.xyz/
- **Token Symbol**: MNT
- **Faucet**: https://faucet.sepolia.mantle.xyz/

## 环境变量配置

创建 `.env` 文件（不要提交到 Git）：

```bash
# 部署私钥（用于签名交易）
PRIVATE_KEY=your_private_key_here

# 可选：使用自定义 RPC URL
MANTLE_MAINNET_RPC_URL=https://rpc.mantle.xyz
MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
```

## 部署步骤

### 1. 安装依赖

**重要**: 所有部署操作都在 `smart-services` 目录下进行，项目已配置好所有必要的依赖。

#### 1.1 安装 Foundry 依赖

项目使用 Foundry 进行合约开发和部署，需要安装以下依赖：

```bash
cd smart-services
forge install foundry-rs/forge-std
forge install Vectorized/solady
forge install nomad-xyz/ExcessivelySafeCall
```

如果依赖已安装，可以跳过此步骤。

#### 1.2 安装 Node.js 依赖（可选，用于 Hardhat）

```bash
npm install
```

### 2. 编译合约

```bash
# 使用 Foundry 编译（推荐）
forge build

# 或使用 Hardhat 编译
npm run compile
```

### 3. 获取测试币（仅测试网）

部署到测试网前，需要获取测试币：
- 访问 https://faucet.sepolia.mantle.xyz/
- 或使用第三方 Faucet（参考官方文档）

### 4. 部署合约

#### 使用 Foundry Script 部署（推荐）

**部署到 Mantle Sepolia 测试网：**

确保在 `smart-services` 目录下运行所有命令。

在主部署脚本中，部署 Kernel、Factory 等核心合约：
```bash
cd smart-services
# 如果已配置 ETHERSCAN_API_KEY，可以使用 --verify 参数验证合约
forge script scripts/Deploy.s.sol:Deploy \
  --rpc-url mantle_sepolia \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --verify \
  -vvvv

# 如果未配置 ETHERSCAN_API_KEY，去掉 --verify 参数即可
forge script scripts/Deploy.s.sol:Deploy \
  --rpc-url mantle_sepolia \
  --broadcast \
  --private-key $PRIVATE_KEY \
  -vvvv
```

部署 MultiChainValidator 验证器：
```bash
# 如果已配置 ETHERSCAN_API_KEY，可以使用 --verify 参数验证合约
forge script scripts/DeployMultiChain.s.sol:DeployMultiChain \
  --rpc-url mantle_sepolia \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --verify \
  -vvvv

# 如果未配置 ETHERSCAN_API_KEY，去掉 --verify 参数即可
forge script scripts/DeployMultiChain.s.sol:DeployMultiChain \
  --rpc-url mantle_sepolia \
  --broadcast \
  --private-key $PRIVATE_KEY \
  -vvvv
```

**部署到 Mantle 主网：**

部署核心合约：
```bash
cd smart-services
forge script scripts/Deploy.s.sol:Deploy \
  --rpc-url mantle_mainnet \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --verify \
  -vvvv
```

部署 MultiChainValidator：
```bash
forge script scripts/DeployMultiChain.s.sol:DeployMultiChain \
  --rpc-url mantle_mainnet \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --verify \
  -vvvv
```

**注意**: 
- 使用 `--private-key $PRIVATE_KEY` 参数指定部署私钥
- 或者设置环境变量 `export PRIVATE_KEY=your_private_key`
- 确保部署账户有足够的 MNT 代币支付 Gas 费用

#### 使用 Hardhat 部署（可选）

如果使用 Hardhat，需要先在 `hardhat.config.ts` 中配置网络。

**部署到 Mantle Sepolia 测试网：**
```bash
cd smart-services
npx hardhat run scripts/deploy.ts --network mantle_sepolia
```

**部署到 Mantle 主网：**
```bash
cd smart-services
npx hardhat run scripts/deploy.ts --network mantle_mainnet
```

**注意**: 
- 推荐使用 Foundry 进行部署，因为所有脚本和配置都已针对 Foundry 优化
- 所有部署操作都在 `smart-services` 目录下进行，无需切换到其他目录

### 5. 验证部署

部署完成后，合约地址会输出到控制台。可以：
1. 在区块链浏览器上查看：
   - 测试网: https://sepolia.mantlescan.xyz/
   - 主网: https://mantlescan.xyz/
2. 验证合约代码（如果使用了 `--verify` 参数）
3. 更新前端配置中的合约地址

## 部署脚本说明

### Deploy.s.sol
主部署脚本，部署以下合约：
- FactoryStaker (Meta Factory)
- Kernel 实现合约
- KernelFactory
- 配置 EntryPoint 质押

### DeployKernel.s.sol
部署 Kernel 和 KernelFactory 的简化脚本

### DeployECDSA.s.sol
部署 ECDSAValidator 验证器合约

### DeployMultiChain.s.sol
部署 MultiChainValidator 验证器合约（用于多链验证功能）

## 注意事项

1. **私钥安全**: 不要将私钥提交到 Git，使用环境变量
2. **Gas 费用**: 确保账户有足够的 MNT 支付 Gas 费用
3. **合约地址**: 部署后记录所有合约地址，用于前端配置
4. **验证合约**: 建议使用 `--verify` 参数验证合约代码

## 参考链接

- [Mantle 开发者文档](https://docs.mantle.xyz/network/for-developers/quick-access)
- [Mantle 合约地址列表](https://docs.mantle.xyz/network/for-developers/quick-access#contract-address)
- [Kernel 部署门户](https://kernel.zerodev.app/)
