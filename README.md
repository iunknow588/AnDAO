# AnDaoWallet H5

AnDaoWallet H5 是一个基于 ERC-4337 账户抽象的智能合约钱包前端（PWA），支持多链配置与钱包核心流程联调。

## 核心能力

- 账户抽象钱包（Kernel / EntryPoint）
- 多链配置（Avalanche、Mantle、Injective）
- 三路径账户创建流程（Path A/B/C）
- 社交恢复与守护人相关流程
- Sponsor 与桥接相关前端能力

## 目录结构

```text
h5/
├── src/                  # 前端源码
├── smart-services/       # 钱包合约与部署脚本
├── scripts/              # 功能/管理脚本
├── public/               # 静态资源
├── package.json
└── README.md
```

## 环境要求

- Node.js >= 18
- npm >= 9

## 快速开始

```bash
npm install
cp .env.example .env.local
npm run dev
```

默认开发地址：`http://localhost:3000`

## 常用命令

```bash
# 开发
npm run dev

# 构建
npm run build
npm run build:check

# 测试与检查
npm run test
npm run type-check
npm run lint

# 部署辅助
npm run deploy:github
npm run deploy:vercel
npm run deploy:all
```

## 多链配置说明

环境变量集中在 `.env.local`，建议至少配置：

- Avalanche Fuji RPC 与核心合约地址
- 需要联调的 Bundler / Paymaster 地址
- 可选的 Solana / Ming 桥接变量

## 智能合约与部署

`smart-services/` 为钱包项目不可分割的一部分，包含：

- Solidity 合约
- Foundry 配置
- 多链部署脚本
- Avalanche 部署与联调脚本

示例：

```bash
cd smart-services
./scripts/deploy/deploy-multichain-validator.sh --check --chain avalanche_fuji
```

## 项目边界

本 README 仅描述 `h5` 项目自身内容与运行方式，不依赖其他仓库文档。
