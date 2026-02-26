# Smart Services - 智能合约服务

## 目录说明

本目录包含 AnDaoWallet 项目相关的智能合约代码和服务。

## 目录结构

```
smart-services/
├── contracts/          # 智能合约源码
│   └── src/           # Kernel 合约源码（本地维护）
├── scripts/           # 部署和测试脚本
│   ├── Deploy.s.sol   # 主部署脚本（CREATE2_PROXY）
│   ├── DeployAllChains.s.sol  # 多链批量部署脚本（推荐）
│   ├── DeployWithCREATE2.s.sol  # CREATE2_PROXY 部署脚本
│   └── DeployApplicationRegistry.s.sol  # ApplicationRegistry 部署脚本
├── docs/              # 文档目录
│   ├── 部署指南.md      # 部署指南文档
│   ├── 多链部署地址记录.md  # 多链部署地址记录
│   └── ...            # 其他技术文档
├── artifacts/         # 编译产物（可选）
├── types/             # TypeScript 类型定义（可选）
├── package.json       # 合约项目依赖
├── hardhat.config.ts  # Hardhat 配置
├── foundry.toml       # Foundry 配置
├── remappings.txt     # Foundry 重映射配置
└── README.md          # 本文件
```

## 重要说明

### Vercel 部署

⚠️ **本目录不会被部署到 Vercel**

- `smart-services/` 目录已在 `.vercelignore` 中排除
- Vercel 部署仅包含钱包 UI 部分（`h5/` 目录）
- 智能合约代码独立管理，不包含在前端部署中

### 合约代码组成

本目录包含钱包项目所需的核心合约代码：

- **Kernel 合约**: ERC-4337 兼容的智能合约账户框架
- **Factory 合约**: 账户创建工厂合约
- **Validator 合约**: 验证器合约（MultiChainValidator）
- **EntryPoint 合约**: ERC-4337 EntryPoint 标准实现

### 使用方式

#### 1. 编译合约

```bash
cd smart-services
npm install
npm run compile
```

#### 2. 生成 TypeScript 类型

```bash
# 使用 TypeChain 生成类型
npx typechain --target ethers-v6 --out-dir types './artifacts/**/*.json'
```

#### 3. 部署合约

详细部署说明请参考 [部署指南](./docs/部署指南.md)

```bash
# 使用 Foundry 部署（推荐）
forge script scripts/Deploy.s.sol:Deploy --rpc-url mantle_sepolia --broadcast -vvvv

# 或使用 Hardhat 部署
npx hardhat run scripts/deploy.ts --network mantle_sepolia
```

## 与前端项目的集成

前端项目（`h5/`）使用本地定义的 ABI（`src/utils/kernel-types.ts`），不直接依赖本目录：

- ✅ **开发阶段**: 可以从本目录导入合约类型和 ABI
- ✅ **部署阶段**: 使用本地定义的 ABI，不依赖本目录
- ✅ **独立性**: 前端项目可以独立部署，不包含合约代码

## 更新合约代码

如果需要更新合约代码：

1. 在 `smart-services/contracts/src` 中直接修改
2. 重新编译并生成类型
3. 更新前端项目中的 ABI（`src/utils/kernel-types.ts`）

## 部署文档

- [部署指南](./docs/部署指南.md) - 详细的智能合约部署说明
- [多链部署地址记录](./docs/多链部署地址记录.md) - 各链部署地址记录
- [文档索引](./docs/文档索引.md) - 完整文档索引

## 相关说明

本目录是钱包项目的一部分，用于智能合约开发、编译与部署。
