# AnDaoWallet H5

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-blue)](https://reactjs.org/)

> 基于账户抽象（ERC-4337）的智能合约钱包 PWA

## 📋 简介

AnDaoWallet 是一个现代化的智能合约钱包，基于 **账户抽象（Account Abstraction）** 和 **ERC-4337** 标准构建。与传统钱包不同，AnDaoWallet 提供无 Gas 代币使用、社交恢复、批量交易等高级功能。

### ✨ 核心特性

- ✅ **账户抽象**: 基于 ERC-4337 和 Kernel 智能合约账户
- ✅ **多链支持**: Mantle、Injective（按 ERC-4337 能力启用）、Avalanche（配置基线保留，按能力分级启用）
- ✅ **三路径账户创建**:
  - 路径A：极简体验（推荐新手，无需 Gas 代币）
  - 路径B：标准模式（有 EOA 钱包的用户）
  - 路径C：成为赞助商（帮助他人创建账户）
- ✅ **社交恢复**: 守护人投票恢复机制
- ✅ **Gas 代付**: 支持 Paymaster 代付 Gas 费用
- ✅ **插件系统**: 基于 ERC-7579 的可扩展插件架构
- ✅ **PWA 支持**: 可作为应用安装到设备
- ✅ **DApp 集成**: 标准 Ethereum Provider 接口（EIP-1193、EIP-6963）

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0 或 **pnpm**: >= 8.0.0

### 安装依赖

```bash
npm install
```

### 环境配置

复制 `.env.example` 并创建 `.env.local` 文件：

```bash
cp .env.example .env.local
```

配置环境变量（参考 `docs/01_背景与需求分析/环境配置指南.md`）：

```env
# Mantle 测试网（默认开发网络）
VITE_MANTLE_TESTNET_RPC_URL=https://rpc.sepolia.mantle.xyz
VITE_MANTLE_TESTNET_BUNDLER_URL=
VITE_MANTLE_TESTNET_PAYMASTER_ADDRESS=
VITE_MANTLE_TESTNET_KERNEL_FACTORY_ADDRESS=
VITE_MANTLE_TESTNET_ENTRYPOINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
VITE_MANTLE_TESTNET_MULTI_CHAIN_VALIDATOR_ADDRESS=

# 多链扩展（按需启用）
VITE_INJECTIVE_TESTNET_RPC_URL=https://k8s.testnet.json-rpc.injective.network
VITE_AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
```

### 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000` 查看应用。

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

## 📚 文档

### 用户文档

- **[用户使用指南](docs/04_功能设计/用户使用指南.md)**: 完整的使用说明，包括账户创建、日常使用、高级功能等
- **[常见问题](docs/04_功能设计/用户使用指南.md#7-常见问题)**: 常见问题解答

### 开发者文档

- **[开发者文档](docs/04_功能设计/开发者文档.md)**: 架构设计、API 参考、插件开发等
- **[API 接口文档](docs/04_功能设计/API接口文档.md)**: 完整的 API 接口说明
- **[系统设计文档](docs/03_详细设计/系统详细设计.md)**: 系统详细设计说明

### 技术文档

- **[系统需求规格说明书](docs/01_背景与需求分析/系统需求规格说明书.md)**: 系统需求和功能规格
- **[系统概要设计](docs/02_概要设计/系统概要设计说明书.md)**: 系统架构和整体设计
- **[环境配置指南](docs/01_背景与需求分析/环境配置指南.md)**: 环境配置说明

## 🏗️ 项目结构

```
h5/
├── src/
│   ├── services/        # 核心服务层
│   │   ├── AccountManager.ts          # 账户管理
│   │   ├── TransactionRelayer.ts      # 交易中继
│   │   ├── BundlerClient.ts           # Bundler 客户端
│   │   ├── GuardianService.ts         # 守护人服务
│   │   ├── TwoPhaseCommitService.ts   # 两阶段提交
│   │   └── ...
│   ├── stores/          # MobX 状态管理
│   │   ├── AccountStore.ts            # 账户状态
│   │   └── InteractionStore.ts        # DApp 请求队列
│   ├── pages/           # 页面组件
│   │   ├── WelcomePage.tsx            # 欢迎页面
│   │   ├── HomePage.tsx               # 首页
│   │   ├── CreateAccountPathAPage.tsx # 路径A创建
│   │   └── ...
│   ├── components/      # UI 组件
│   ├── adapters/        # 适配器层
│   │   ├── ProviderAdapter.ts         # Provider 适配器
│   │   └── StorageAdapter.ts          # 存储适配器
│   ├── utils/           # 工具函数
│   ├── types/           # 类型定义
│   ├── config/          # 配置文件
│   └── plugins/         # 插件实现
├── docs/                # 文档目录
├── public/              # 静态资源
└── package.json
```

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# UI 模式
npm run test:ui
```

### 测试覆盖

- ✅ 单元测试：核心服务和工具函数
- ✅ 集成测试：账户创建、交易流程
- ✅ 端到端测试：完整用户流程

## 🛠️ 开发指南

### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 使用 Prettier 格式化
- 添加 JSDoc 注释

### 提交规范

- 使用有意义的提交信息
- 提交前运行测试和 Lint

```bash
# 运行 Lint
npm run lint

# 修复 Lint 错误
npm run lint-fix

# 类型检查
npm run type-check
```

## 📦 构建与部署

### 构建

```bash
npm run build
```

### PWA 配置

PWA 配置在 `vite.config.ts` 中，使用 `vite-plugin-pwa`。

### 部署

可以将 `dist/` 目录部署到：
- GitHub Pages
- Vercel
- Netlify
- 自建服务器（Nginx/Apache）

详细部署指南请参考 `docs/04_功能设计/开发者文档.md#9-部署指南`。

## 🔧 配置

### 链配置

链配置在 `src/config/chains.ts` 中，支持：
- Mantle 主网和测试网
- Injective 主网和测试网（如果支持 ERC-4337）
- Avalanche 主网和 Fuji 测试网（基线保留，按能力分级启用）

### 合约地址

合约地址配置请参考 `docs/04_功能设计/前端合约地址配置说明.md`。

## 🔐 安全

- ✅ 私钥本地加密存储（AES-GCM）
- ✅ 密码派生（PBKDF2）
- ✅ 安全会话管理
- ✅ 自动锁定机制

详细安全说明请参考 `docs/04_功能设计/用户使用指南.md#6-安全须知`。

## 🤝 贡献

欢迎贡献！请查看贡献指南：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE) 文件。

## 🔗 相关链接

- **ERC-4337**: https://eips.ethereum.org/EIPS/eip-4337
- **ERC-7579**: https://eips.ethereum.org/EIPS/eip-7579
- **Kernel (ZeroDev)**: https://docs.zerodev.app/
- **viem**: https://viem.sh/

## 📞 支持

- **文档**: 查看 `docs/` 目录
- **问题报告**: 提交 GitHub Issue
- **讨论**: 加入社区讨论

---

**版本**: 0.1.0  
**最后更新**: 2025-01
