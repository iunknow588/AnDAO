# Vercel 部署配置说明

## 配置完成时间

2026-01-13

## 配置目标

将 AnDaoWallet H5 项目配置为独立部署到 Vercel，**仅包含钱包 UI 部分**，合约代码已独立到外部目录。

## 已完成的配置

### 1. 移除 kernel-dev 依赖 ✅

#### vite.config.ts
- ✅ 移除了 `@kernel-dev` 路径别名配置
- ✅ 添加了注释说明，说明合约代码已独立

**修改前**:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@kernel-dev': path.resolve(__dirname, '../kernel-dev/src')
  }
}
```

**修改后**:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    // 注意：已移除 @kernel-dev 路径别名，项目使用本地定义的 ABI（kernel-types.ts）
    // 合约代码已独立到外部目录，Vercel 部署仅包含 UI 部分
  }
}
```

#### tsconfig.json
- ✅ 移除了 `@kernel-dev/*` 路径映射
- ✅ 添加了注释说明

**修改前**:
```json
"paths": {
  "@/*": ["src/*"],
  "@kernel-dev/*": ["../kernel-dev/src/*"]
}
```

**修改后**:
```json
"paths": {
  "@/*": ["src/*"]
  // 注意：已移除 @kernel-dev 路径映射，项目使用本地定义的 ABI（kernel-types.ts）
  // 合约代码已独立到外部目录，Vercel 部署仅包含 UI 部分
}
```

#### package.json
- ✅ 禁用了 typechain 脚本中对 `../kernel-dev` 的引用
- ✅ 添加了说明性输出

**修改前**:
```json
"typechain": "typechain --target ethers-v6 --out-dir src/types/contracts '../kernel-dev/out/**/*.json'"
```

**修改后**:
```json
"typechain": "echo 'TypeChain script disabled for Vercel deployment. Contract types are defined locally in src/utils/kernel-types.ts'"
```

### 2. 创建 Vercel 配置文件 ✅

#### vercel.json
- ✅ 创建了完整的 Vercel 部署配置
- ✅ 配置了构建命令、输出目录、框架类型
- ✅ 配置了 SPA 路由重写规则
- ✅ 配置了缓存策略（Service Worker、Manifest、静态资源）
- ✅ 配置了环境变量默认值

**配置内容**:
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
  ],
  "headers": [
    {
      "source": "/service-worker.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
    {
      "source": "/(.*\\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico))",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "env": {
    "VITE_ENABLE_SENTRY": "false"
  }
}
```

### 3. 创建 .vercelignore 文件 ✅

- ✅ 忽略 `../kernel-dev/` 合约代码目录
- ✅ 忽略开发相关文件（node_modules、dist、coverage 等）
- ✅ 忽略测试文件（可选）
- ✅ 忽略文档目录（可选）
- ✅ 忽略配置文件
- ✅ 忽略其他项目目录

**关键配置**:
```
# 忽略合约代码目录（合约代码已独立到外部目录）
../kernel-dev/
kernel-dev/
```

### 4. 创建部署文档 ✅

#### docs/Vercel部署指南.md
- ✅ 创建了完整的 Vercel 部署指南
- ✅ 包含部署前准备、部署步骤、配置说明、常见问题等
- ✅ 提供了三种部署方法（Dashboard、CLI、Git 推送）

### 5. 更新文档 ✅

#### docs/README.md
- ✅ 添加了部署说明章节
- ✅ 说明了合约代码独立性和 Vercel 配置

## 项目独立性验证

### 代码检查结果 ✅

1. **无 kernel-dev 导入**: 
   - ✅ 代码中无 `from '@kernel-dev'` 或 `import '@kernel-dev'` 语句
   - ✅ 所有合约相关类型和 ABI 都在 `src/utils/kernel-types.ts` 中本地定义

2. **使用降级方案**:
   - ✅ `kernel-types.ts` 使用本地定义的 ABI（降级方案）
   - ✅ 不依赖 `../kernel-dev` 目录的源码或编译产物

3. **路径配置已移除**:
   - ✅ `vite.config.ts` 中无 `@kernel-dev` 路径别名
   - ✅ `tsconfig.json` 中无 `@kernel-dev` 路径映射

## 部署验证清单

部署前请确认：

- [ ] `vite.config.ts` 中已移除 `@kernel-dev` 路径别名
- [ ] `tsconfig.json` 中已移除 `@kernel-dev` 路径映射
- [ ] `package.json` 中 typechain 脚本已禁用
- [ ] `vercel.json` 配置文件已创建
- [ ] `.vercelignore` 文件已创建
- [ ] 环境变量已在 Vercel Dashboard 中配置
- [ ] 代码中无直接引用 `../kernel-dev` 的导入语句

## 部署步骤

1. **配置环境变量**（在 Vercel Dashboard 中）:
   ```
   VITE_MANTLE_RPC_URL=https://rpc.mantle.xyz
   VITE_MANTLE_CHAIN_ID=5000
   VITE_MANTLE_KERNEL_FACTORY_ADDRESS=0x...
   VITE_MANTLE_ENTRY_POINT_ADDRESS=0x...
   VITE_MANTLE_BUNDLER_URL=https://...
   VITE_MANTLE_MULTI_CHAIN_VALIDATOR_ADDRESS=0x...
   ```

2. **部署项目**:
   - 方法一：通过 Vercel Dashboard 导入项目，设置 Root Directory 为 `h5`
   - 方法二：使用 Vercel CLI：`cd h5 && vercel`
   - 方法三：推送代码到 Git，Vercel 自动部署

3. **验证部署**:
   - 访问部署后的 URL
   - 检查页面是否正常加载
   - 验证功能是否正常

## 注意事项

1. **合约代码独立性**:
   - 合约代码位于 `../kernel-dev/` 目录，不在 `h5/` 目录中
   - Vercel 部署仅包含 `h5/` 目录，不包含合约代码
   - 项目使用本地定义的 ABI（`src/utils/kernel-types.ts`）

2. **环境变量**:
   - 所有环境变量必须以 `VITE_` 开头（Vite 要求）
   - 环境变量需要在 Vercel Dashboard 中配置
   - 修改环境变量后需要重新部署

3. **路由配置**:
   - SPA 路由已配置重写规则，所有路由重定向到 `index.html`
   - 如果遇到 404 错误，检查 `vercel.json` 中的 `rewrites` 配置

4. **PWA 功能**:
   - Service Worker 和 Manifest 的缓存策略已配置
   - 如果 PWA 功能不工作，检查缓存策略配置

## 相关文档

- [Vercel部署指南](./Vercel部署指南.md) - 详细的部署步骤和配置说明
- [系统概述](./系统概述.md) - 项目架构和设计说明
- [开发检查清单](../check/check_list.md) - 开发任务清单

---

**配置完成时间**: 2026-01-13  
**配置版本**: v1.0
