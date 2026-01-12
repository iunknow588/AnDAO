# Smart Services - 智能合约服务

## 目录说明

本目录包含 AnDaoWallet 项目相关的智能合约代码和服务。

## 目录结构

```
smart-services/
├── contracts/          # 智能合约源码
│   └── src/           # Kernel 合约源码（从 kernel-dev 复制）
├── scripts/           # 部署和测试脚本
├── artifacts/         # 编译产物（可选）
├── types/             # TypeScript 类型定义（可选）
├── package.json       # 合约项目依赖
├── hardhat.config.ts  # Hardhat 配置
├── foundry.toml       # Foundry 配置
└── remappings.txt     # Foundry 重映射配置
```

## 重要说明

### Vercel 部署

⚠️ **本目录不会被部署到 Vercel**

- `smart-services/` 目录已在 `.vercelignore` 中排除
- Vercel 部署仅包含钱包 UI 部分（`h5/` 目录）
- 智能合约代码独立管理，不包含在前端部署中

### 合约代码来源

智能合约代码来自 `../kernel-dev/` 目录：

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

```bash
# 使用 Hardhat 部署
npx hardhat run scripts/deploy.ts --network mantle
```

## 与前端项目的集成

前端项目（`h5/`）使用本地定义的 ABI（`src/utils/kernel-types.ts`），不直接依赖本目录：

- ✅ **开发阶段**: 可以从本目录导入合约类型和 ABI
- ✅ **部署阶段**: 使用本地定义的 ABI，不依赖本目录
- ✅ **独立性**: 前端项目可以独立部署，不包含合约代码

## 更新合约代码

如果需要更新合约代码：

1. 更新 `../kernel-dev/` 目录中的合约源码
2. 复制到本目录：
   ```bash
   cp -r ../kernel-dev/src smart-services/contracts/src
   ```
3. 重新编译和生成类型
4. 更新前端项目中的 ABI（`src/utils/kernel-types.ts`）

## 相关文档

- [Vercel部署指南](../docs/Vercel部署指南.md)
- [系统概述](../docs/系统概述.md)
- [开发指南](../docs/开发指南.md)

---

**注意**: 本目录仅用于开发和维护智能合约代码，不包含在 Vercel 部署中。
