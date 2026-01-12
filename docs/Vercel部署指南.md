# AnDaoWallet H5 Vercel 部署指南

## 文档信息

- **项目名称**: AnDaoWallet HTML5 版本
- **部署平台**: Vercel
- **文档版本**: 1.0
- **创建日期**: 2026-01-13

## 概述

本文档说明如何将 AnDaoWallet H5 项目部署到 Vercel。项目已配置为独立部署，**仅包含钱包 UI 部分**，合约代码已独立到外部目录。

## 项目结构说明

### 独立部署结构

```
AnDaoWallet/
├── kernel-dev/          # 合约代码源码目录（开发用）
│   └── ...
└── h5/                  # 钱包 UI 项目（Vercel 部署目录）
    ├── src/             # 源代码
    ├── public/          # 静态资源
    ├── smart-services/  # 智能合约服务目录（不包含在 Vercel 部署中）
    │   ├── contracts/   # 合约源码（从 kernel-dev 复制）
    │   ├── scripts/     # 部署脚本
    │   └── ...
    ├── scripts/         # 部署脚本
    │   ├── deploy-vercel.sh
    │   └── check-deployment.sh
    ├── dist/            # 构建输出（Vercel 自动生成）
    ├── vercel.json      # Vercel 配置文件
    ├── .vercelignore    # Vercel 忽略文件
    └── package.json     # 项目依赖
```

### 合约代码独立性

- ✅ **合约代码已独立**: 合约代码位于 `smart-services/` 目录，不包含在 Vercel 部署中
- ✅ **使用本地 ABI**: 项目使用 `src/utils/kernel-types.ts` 中定义的本地 ABI
- ✅ **无外部依赖**: 项目不依赖 `kernel-dev` 或 `smart-services` 目录的源码或编译产物
- ✅ **Vercel 部署**: 仅部署 `h5/` 目录，`smart-services/` 目录已在 `.vercelignore` 中排除

## 部署前准备

### 1. 环境变量配置

在 Vercel 项目设置中配置以下环境变量：

#### 必需环境变量

```bash
# Mantle 链配置
VITE_MANTLE_RPC_URL=https://rpc.mantle.xyz
VITE_MANTLE_CHAIN_ID=5000
VITE_MANTLE_KERNEL_FACTORY_ADDRESS=0x...
VITE_MANTLE_ENTRY_POINT_ADDRESS=0x...
VITE_MANTLE_BUNDLER_URL=https://...
VITE_MANTLE_MULTI_CHAIN_VALIDATOR_ADDRESS=0x...

# 可选：Paymaster 配置
VITE_MANTLE_PAYMASTER_ADDRESS=0x...

# 可选：监控服务
VITE_ENABLE_SENTRY=false
VITE_SENTRY_DSN=...
```

#### 环境变量说明

- **RPC_URL**: 区块链 RPC 节点地址
- **CHAIN_ID**: 链 ID（Mantle 主网: 5000）
- **KERNEL_FACTORY_ADDRESS**: Kernel Factory 合约地址
- **ENTRY_POINT_ADDRESS**: ERC-4337 EntryPoint 合约地址
- **BUNDLER_URL**: Bundler 服务地址
- **MULTI_CHAIN_VALIDATOR_ADDRESS**: MultiChainValidator 合约地址
- **PAYMASTER_ADDRESS**: Paymaster 合约地址（可选）

### 2. 检查项目配置

确保以下文件已正确配置：

- ✅ `vercel.json` - Vercel 部署配置
- ✅ `.vercelignore` - Vercel 忽略文件
- ✅ `vite.config.ts` - 已移除 `@kernel-dev` 路径别名
- ✅ `tsconfig.json` - 已移除 `@kernel-dev` 路径映射
- ✅ `package.json` - typechain 脚本已禁用

## 部署步骤

### 方法一：通过 Vercel Dashboard 部署

1. **登录 Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 使用 GitHub/GitLab/Bitbucket 账号登录

2. **导入项目**
   - 点击 "Add New Project"
   - 选择包含 `h5` 目录的 Git 仓库
   - 配置项目设置：
     - **Root Directory**: `h5`
     - **Framework Preset**: Vite
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
     - **Install Command**: `npm install`

3. **配置环境变量**
   - 在项目设置中添加环境变量（见上方"环境变量配置"）

4. **部署**
   - 点击 "Deploy" 开始部署
   - 等待构建完成

### 方法二：通过 Vercel CLI 部署

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **进入项目目录**
   ```bash
   cd /home/lc/luckee_dao/AnDaoWallet/h5
   ```

4. **运行部署前检查（可选）**
   ```bash
   ./scripts/check-deployment.sh
   ```

5. **部署**
   ```bash
   # 使用部署脚本（推荐）
   ./scripts/deploy-vercel.sh
   
   # 或直接使用 Vercel CLI
   vercel --prod
   ```

6. **配置环境变量**
   ```bash
   vercel env add VITE_MANTLE_RPC_URL
   vercel env add VITE_MANTLE_CHAIN_ID
   # ... 添加其他环境变量
   ```

### 方法三：通过 Git 推送自动部署

1. **连接 Git 仓库**
   - 在 Vercel Dashboard 中连接 Git 仓库
   - 配置自动部署：
     - **Production Branch**: `main` 或 `master`
     - **Root Directory**: `h5`

2. **推送代码**
   ```bash
   git push origin main
   ```

3. **自动部署**
   - Vercel 会自动检测推送并触发部署
   - 部署状态会在 Vercel Dashboard 中显示

## 部署配置说明

### vercel.json 配置

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**配置说明**:
- **buildCommand**: 构建命令（`npm run build`）
- **outputDirectory**: 构建输出目录（`dist`）
- **framework**: 框架类型（`vite`）
- **rewrites**: SPA 路由重写规则（所有路由重定向到 `index.html`）

### .vercelignore 配置

`.vercelignore` 文件确保以下内容不会被部署：

- ✅ `../kernel-dev/` - 合约代码目录
- ✅ `node_modules/` - 依赖包（Vercel 会自动安装）
- ✅ `docs/` - 文档目录
- ✅ 测试文件和配置文件

## 部署后验证

### 1. 检查部署状态

- 访问 Vercel Dashboard 查看部署状态
- 确认构建成功，无错误

### 2. 功能验证

访问部署后的 URL，验证以下功能：

- ✅ 页面正常加载
- ✅ 创建账户功能
- ✅ 导入钱包功能
- ✅ 发送交易功能
- ✅ PWA 功能（可安装、离线支持）

### 3. 环境变量验证

在浏览器控制台检查：

```javascript
// 检查环境变量是否正确注入
console.log(import.meta.env.VITE_MANTLE_RPC_URL);
console.log(import.meta.env.VITE_MANTLE_CHAIN_ID);
```

## 常见问题

### Q1: 构建失败，提示找不到 `kernel-dev` 或 `smart-services` 目录

**原因**: 配置文件中仍引用了合约代码目录

**解决方案**:
1. 检查 `vite.config.ts` 是否已移除 `@kernel-dev` 路径别名
2. 检查 `tsconfig.json` 是否已移除 `@kernel-dev` 路径映射
3. 检查代码中是否有直接引用 `../kernel-dev` 或 `smart-services` 的导入语句
4. 确认 `smart-services` 目录已在 `.vercelignore` 中排除

### Q2: 环境变量未生效

**原因**: 环境变量未正确配置或未重新部署

**解决方案**:
1. 在 Vercel Dashboard 中检查环境变量配置
2. 确保环境变量名称以 `VITE_` 开头（Vite 要求）
3. 重新部署项目使环境变量生效

### Q3: PWA 功能不工作

**原因**: Service Worker 缓存策略问题

**解决方案**:
1. 检查 `vercel.json` 中的 Service Worker 缓存头配置
2. 确保 `manifest.json` 和 `service-worker.js` 的缓存策略正确
3. 清除浏览器缓存后重试

### Q4: 路由 404 错误

**原因**: SPA 路由未正确配置

**解决方案**:
1. 检查 `vercel.json` 中的 `rewrites` 配置
2. 确保所有路由都重定向到 `index.html`

## 持续集成/持续部署 (CI/CD)

### GitHub Actions 示例

如果需要使用 GitHub Actions 进行自动化部署，可以创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]
    paths:
      - 'h5/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./h5
```

## 性能优化建议

### 1. 启用 Vercel Edge Functions

对于需要低延迟的 API 调用，可以考虑使用 Vercel Edge Functions。

### 2. 启用 CDN 缓存

Vercel 自动提供全球 CDN，确保静态资源快速加载。

### 3. 启用压缩

Vercel 自动启用 Gzip/Brotli 压缩，无需额外配置。

## 监控和日志

### Vercel Analytics

- 启用 Vercel Analytics 监控应用性能
- 查看访问量、性能指标等

### 错误监控

- 配置 Sentry 进行错误监控（通过环境变量 `VITE_ENABLE_SENTRY`）
- 查看 Vercel 构建日志和运行时日志

## 总结

AnDaoWallet H5 项目已配置为独立部署到 Vercel：

- ✅ **合约代码独立**: 合约代码位于外部目录，不包含在部署中
- ✅ **配置完整**: `vercel.json` 和 `.vercelignore` 已配置
- ✅ **环境变量**: 支持通过环境变量配置链参数
- ✅ **PWA 支持**: 支持 PWA 功能，包括 Service Worker 和 Manifest
- ✅ **路由支持**: 支持 SPA 路由重写

按照本文档的步骤，可以顺利将项目部署到 Vercel。

---

**文档版本**: v1.0  
**最后更新**: 2026-01-13
