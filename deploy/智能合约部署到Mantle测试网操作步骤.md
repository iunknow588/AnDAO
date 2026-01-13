# 智能合约部署到 Mantle 测试网操作步骤

## 📋 前置条件

1. **环境要求**
   - Node.js 和 npm 已安装
   - Foundry (forge) 或 Hardhat 已安装
   - Git 已安装

2. **账户准备**
   - 准备一个用于部署的以太坊账户（包含私钥）
   - 该账户需要足够的 MNT 测试币用于支付 Gas 费用

## 🌐 Mantle Sepolia 测试网配置

- **网络名称**: Mantle Sepolia Testnet
- **RPC URL**: https://rpc.sepolia.mantle.xyz
- **Chain ID**: 5003
- **区块浏览器**: https://sepolia.mantlescan.xyz/
- **测试币水龙头**: https://faucet.sepolia.mantle.xyz/
- **原生代币**: MNT

## 📝 部署步骤

### 步骤 1: 获取测试币

在部署前，需要确保部署账户有足够的测试币：

1. 访问测试币水龙头：https://faucet.sepolia.mantle.xyz/
2. 输入你的钱包地址
3. 领取测试 MNT（建议至少 0.1 MNT）

### 步骤 2: 进入 kernel-dev 目录

根据文档说明，部署脚本需要在 `kernel-dev` 目录中运行：

```bash
cd /home/lc/luckee_dao/AnDaoWallet/kernel-dev
```

### 步骤 3: 安装依赖

```bash
npm install
```

### 步骤 4: 配置环境变量

在 `kernel-dev` 目录下创建 `.env` 文件（如果不存在）：

```bash
# 部署私钥（用于签名交易）
PRIVATE_KEY=your_private_key_here

# Mantle Sepolia 测试网 RPC URL（可选，如果 foundry.toml 已配置）
MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
```

**⚠️ 重要安全提示**:
- 不要将 `.env` 文件提交到 Git
- 确保 `.env` 已在 `.gitignore` 中
- 使用专门用于测试的账户私钥，不要使用主网账户

### 步骤 5: 配置 Foundry

检查 `foundry.toml` 文件，确保已配置 Mantle Sepolia 网络：

```toml
[rpc_endpoints]
mantle_sepolia = "https://rpc.sepolia.mantle.xyz"

[etherscan]
mantle_sepolia = { key = "YOUR_API_KEY", url = "https://api-sepolia.mantlescan.xyz/api" }
```

### 步骤 6: 编译合约

使用 Foundry 编译合约：

```bash
forge build
```

或使用 Hardhat：

```bash
npm run compile
```

### 步骤 7: 部署合约

#### 方式 A: 使用 Foundry Script 部署（推荐）

部署到 Mantle Sepolia 测试网：

```bash
# 使用 Foundry 部署
forge script script/Deploy.s.sol:Deploy \
  --rpc-url mantle_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

**参数说明**:
- `--rpc-url mantle_sepolia`: 使用 Mantle Sepolia 测试网
- `--broadcast`: 广播交易到网络
- `--verify`: 自动验证合约代码（需要配置 Etherscan API Key）
- `-vvvv`: 详细输出级别

#### 方式 B: 使用 Hardhat 部署

如果使用 Hardhat，需要先在 `hardhat.config.ts` 中配置网络：

```bash
npx hardhat run scripts/deploy.ts --network mantle_sepolia
```

### 步骤 8: 记录部署的合约地址

部署成功后，脚本会输出所有部署的合约地址。请记录以下地址：

- **FactoryStaker 地址**: `0x...`
- **Kernel 实现地址**: `0x...`
- **KernelFactory 地址**: `0x...`
- **EntryPoint 地址**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`（ERC-4337 标准地址）

### 步骤 9: 验证部署

1. **在区块浏览器查看**:
   - 访问 https://sepolia.mantlescan.xyz/
   - 输入合约地址查看部署状态和交易详情

2. **验证合约代码**:
   - 如果使用了 `--verify` 参数，合约代码会自动验证
   - 或在区块浏览器上手动提交验证

### 步骤 10: 更新前端配置

部署完成后，需要更新前端项目的配置：

1. 在 `src/config/chains.ts` 中更新测试网配置：

```typescript
export const MANTLE_TESTNET_CHAIN: ChainConfig = {
  chainId: 5003,
  name: 'Mantle Sepolia Testnet',
  rpcUrl: 'https://rpc.sepolia.mantle.xyz',
  kernelFactoryAddress: '0x...', // 更新为部署的 Factory 地址
  entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  // ... 其他配置
};
```

2. 或通过环境变量配置（推荐）：

创建 `.env.local` 文件：

```bash
VITE_MANTLE_TESTNET_RPC_URL=https://rpc.sepolia.mantle.xyz
VITE_MANTLE_TESTNET_KERNEL_FACTORY_ADDRESS=0x...
VITE_MANTLE_TESTNET_ENTRY_POINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

## 📋 部署的合约列表

根据 `Deploy.s.sol` 脚本，将部署以下合约：

1. **FactoryStaker** (Meta Factory)
   - 用于管理 Factory 的质押

2. **Kernel 实现合约**
   - ERC-4337 兼容的智能合约账户实现

3. **KernelFactory**
   - 用于创建新的 Kernel 账户实例

4. **EntryPoint 配置**
   - 配置 EntryPoint 的质押（如果适用）

## ⚠️ 注意事项

1. **私钥安全**
   - 永远不要将私钥提交到 Git
   - 使用环境变量存储私钥
   - 测试网使用专门的测试账户

2. **Gas 费用**
   - 确保账户有足够的 MNT 支付 Gas 费用
   - 测试网 Gas 费用较低，但建议至少准备 0.1 MNT

3. **合约地址记录**
   - 部署后立即记录所有合约地址
   - 建议保存到文档或配置文件中

4. **网络配置**
   - 确保 RPC URL 正确
   - 验证 Chain ID 为 5003

5. **合约验证**
   - 建议启用 `--verify` 参数自动验证
   - 或部署后手动在区块浏览器验证

## 🔍 故障排查

### 问题 1: RPC 连接失败

**解决方案**:
- 检查网络连接
- 验证 RPC URL 是否正确
- 尝试使用其他 RPC 端点

### 问题 2: 账户余额不足

**解决方案**:
- 访问水龙头获取测试币
- 检查账户地址是否正确

### 问题 3: 合约部署失败

**解决方案**:
- 检查合约代码是否编译成功
- 查看详细的错误信息（使用 `-vvvv` 参数）
- 验证私钥和账户配置

### 问题 4: 合约验证失败

**解决方案**:
- 检查 Etherscan API Key 是否正确配置
- 确认合约已成功部署
- 手动在区块浏览器提交验证

## 📚 参考资源

- [Mantle 官方文档](https://docs.mantle.xyz/network/for-developers/quick-access)
- [Mantle Sepolia 测试网水龙头](https://faucet.sepolia.mantle.xyz/)
- [Mantle Sepolia 区块浏览器](https://sepolia.mantlescan.xyz/)
- [ERC-4337 标准文档](https://eips.ethereum.org/EIPS/eip-4337)
- [Kernel 部署门户](https://kernel.zerodev.app/)

## 🔄 下一步

部署完成后：

1. ✅ 验证所有合约已成功部署
2. ✅ 记录所有合约地址
3. ✅ 更新前端配置
4. ✅ 测试合约功能
5. ✅ 编写部署报告

---

**部署完成后，请更新项目文档中的合约地址信息！**
