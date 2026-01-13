# Kernel-dev 类型导入指南

## 文档信息
- **创建日期**: 2024年
- **状态**: 待完成
- **版本**: 1.0

---

## 一、概述

根据设计文档，AnDaoWallet H5 应该直接使用 kernel-dev 源码中的合约类型和 ABI，而不是本地定义。本文档说明如何完成这个任务。

---

## 二、前置条件

### 1. 安装 kernel-dev 依赖

```bash
cd /home/lc/luckee_dao/AnDaoWallet/kernel-dev
npm install
# 或
yarn install
```

### 2. 编译 kernel-dev

```bash
cd /home/lc/luckee_dao/AnDaoWallet/kernel-dev
npm run compile
# 或
yarn compile
```

这会生成 `artifacts` 目录，包含编译后的合约 ABI 和字节码。

---

## 三、生成 TypeScript 类型

### 1. 运行 TypeChain

H5 项目的 `package.json` 中已经配置了 TypeChain 脚本：

```json
{
  "scripts": {
    "typechain": "typechain --target ethers-v6 --out-dir src/types/contracts '../kernel-dev/out/**/*.json'"
  }
}
```

运行命令：

```bash
cd /home/lc/luckee_dao/AnDaoWallet/h5
npm run typechain
```

这会在 `src/types/contracts` 目录下生成 TypeScript 类型定义。

---

## 四、更新导入语句

### 1. 更新 `src/utils/kernel.ts`

**当前实现**:
```typescript
// 本地定义的 ABI
export const KERNEL_FACTORY_ABI = [...];
export const KERNEL_ABI = [...];
```

**应该改为**:
```typescript
// 从生成的类型导入
import KernelFactoryArtifact from '@kernel-dev/artifacts/KernelFactory.json';
import KernelArtifact from '@kernel-dev/artifacts/Kernel.json';
import type { KernelFactory } from '@/types/contracts/KernelFactory';
import type { Kernel } from '@/types/contracts/Kernel';

export const KERNEL_FACTORY_ABI = KernelFactoryArtifact.abi;
export const KERNEL_ABI = KernelArtifact.abi;
```

### 2. 更新 `src/services/AccountManager.ts`

**当前实现**:
```typescript
// TODO: 从 kernel-dev 导入合约类型和 ABI
```

**应该改为**:
```typescript
import KernelFactoryArtifact from '@kernel-dev/artifacts/KernelFactory.json';
import type { KernelFactory } from '@/types/contracts/KernelFactory';
```

### 3. 更新 `src/services/TransactionRelayer.ts`

**当前实现**:
```typescript
// TODO: 从 kernel-dev 导入 UserOperation 类型
```

**应该改为**:
```typescript
import type { PackedUserOperation } from '@kernel-dev/interfaces/PackedUserOperation.sol';
// 或从生成的类型导入
import type { UserOperation } from '@/types/contracts/EntryPoint';
```

### 4. 更新 `src/types/index.ts`

**当前实现**:
```typescript
// 本地定义的 UserOperation 接口
export interface UserOperation { ... }
```

**应该改为**:
```typescript
// 从 kernel-dev 导入
import type { UserOperation } from '@/types/contracts/EntryPoint';
// 或重新导出
export type { UserOperation } from '@/types/contracts/EntryPoint';
```

---

## 五、处理路径问题

### 1. 配置路径别名

在 `tsconfig.json` 或 `vite.config.ts` 中配置路径别名：

```json
{
  "compilerOptions": {
    "paths": {
      "@kernel-dev/*": ["../kernel-dev/*"]
    }
  }
}
```

### 2. 使用相对路径

如果路径别名不工作，可以使用相对路径：

```typescript
import KernelFactoryArtifact from '../../../kernel-dev/artifacts/KernelFactory.json';
```

---

## 六、验证步骤

### 1. 检查类型生成

确认 `src/types/contracts` 目录下有生成的文件：
- `KernelFactory.ts`
- `Kernel.ts`
- `EntryPoint.ts`
- 等等

### 2. 检查导入

运行类型检查：

```bash
cd /home/lc/luckee_dao/AnDaoWallet/h5
npm run type-check
```

### 3. 检查编译

尝试编译项目：

```bash
npm run build
```

---

## 七、注意事项

### 1. 合约版本兼容性

- 确保 kernel-dev 的版本与 H5 项目兼容
- 如果 kernel-dev 更新，需要重新生成类型

### 2. ABI 格式

- Hardhat 生成的 artifacts 格式可能与 TypeChain 期望的格式不同
- 可能需要调整 TypeChain 配置

### 3. 类型定义位置

- TypeChain 生成的类型在 `src/types/contracts`
- 合约 artifacts 在 `kernel-dev/artifacts` 或 `kernel-dev/out`

### 4. 构建配置

- 确保构建工具（Vite/Webpack）能正确处理这些导入
- 可能需要配置构建工具以支持这些路径

---

## 八、替代方案

如果直接从 kernel-dev 导入遇到问题，可以考虑：

### 1. 使用 npm 包

如果 kernel-dev 发布为 npm 包，可以直接安装：

```bash
npm install @kernel-dev/contracts
```

### 2. 使用 git submodule

将 kernel-dev 作为 git submodule，然后配置路径。

### 3. 复制必要文件

将必要的 ABI 和类型定义复制到 H5 项目中（不推荐，但可以作为临时方案）。

---

## 九、完成检查清单

- [ ] kernel-dev 依赖已安装
- [ ] kernel-dev 已编译
- [ ] TypeChain 已运行并生成类型
- [ ] 所有导入语句已更新
- [ ] 类型检查通过
- [ ] 项目编译成功
- [ ] 功能测试通过

---

## 十、相关文件

需要更新的文件列表：

1. `src/utils/kernel.ts`
2. `src/services/AccountManager.ts`
3. `src/services/TransactionRelayer.ts`
4. `src/types/index.ts`
5. `src/services/PluginService.ts` (如果需要)
6. 其他使用合约 ABI 的文件

---

**文档版本**: 1.0
**最后更新**: 2024年

