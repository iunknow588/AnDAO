# AnDaoWallet HTML5 版本文档

本目录包含 AnDaoWallet HTML5 Web 应用版本的完整技术文档。

## 文档概述

**AnDaoWallet HTML5 版本**是基于账户抽象（ERC-4337）技术构建的智能合约钱包 PWA 应用，**完全无服务端，纯客户端实现**。与传统的 EOA（外部账户）钱包不同，AnDaoWallet 使用 Kernel 智能合约账户，提供更强大的功能、更高的安全性和更好的用户体验。

**核心架构原则**：
- ✅ **无自建服务端**：不提供任何后端 API，所有数据仅存储在本地或链上
- ✅ **纯客户端应用**：所有业务逻辑在前端执行，依赖外部 RPC/Bundler/Paymaster 服务
- ✅ **静态托管部署**：构建产物为纯静态文件，可部署到任何静态托管服务（Nginx/CDN/OSS）

### 核心特性

- 🔐 **账户抽象（ERC-4337）**: 基于 Kernel 智能合约账户，支持 Gas 代付、批量交易等高级功能
- 🏗️ **智能合约钱包**: 用户资产存储在链上智能合约账户中，而非传统的外部账户
- 🔄 **社交恢复**: 支持守护人机制，私钥丢失不再是资产末日（已实现框架）
- 🧩 **模块化设计**: 支持 ERC-7579 插件系统，可扩展钱包功能（已实现插件执行逻辑）
- ✅ **两阶段提交**: 支持加密存储原始数据的两阶段提交功能（已实现）
- 📝 **消息签名**: 支持 eth_sign、personal_sign、eth_signTypedData 等标准签名方法（已实现）
- 🔗 **链管理**: 支持 wallet_switchEthereumChain 和 wallet_addEthereumChain（已实现）
- 🌐 **PWA 应用**: 渐进式 Web 应用，支持离线访问和移动端体验
- ⚡ **Gas 优化**: Kernel 是业界最 Gas 高效的智能合约账户之一
- 🔗 **多链支持**: 优先支持 Mantle 链，Injective 链支持待技术验证

### 重要说明

1. **完全独立的架构**: 这是一个完全独立的智能合约钱包，不依赖任何传统钱包（如 Keplr、MetaMask）的核心代码
2. **无服务端设计**: 纯客户端应用，不提供自建后端 API，所有数据存储在本地（IndexedDB）或链上
3. **UI 设计参考**: 界面设计和用户体验参考 Keplr 钱包，但代码完全独立实现
4. **合约代码独立**: 合约代码位于 `smart-services/` 目录，使用 Foundry 和 Hardhat 进行开发和部署
5. **多链支持策略**: MVP 阶段仅支持 Mantle 链，Injective 链支持根据技术验证结果决定
6. **外部服务依赖**: 仅依赖链上 RPC、Bundler、Paymaster 等第三方服务，不落地任何用户数据到自有服务器

## 部署说明

### Vercel 部署

项目已配置为独立部署到 Vercel，**仅包含钱包 UI 部分**：

- ✅ **合约代码独立**: 合约代码位于 `smart-services/` 目录，不在部署范围内
- ✅ **Vercel 配置**: 已创建 `vercel.json` 和 `.vercelignore` 配置文件
- ✅ **部署脚本**: 
  - `deploy/upload_to_github.sh` - 上传代码到 GitHub
  - `deploy/deploy-vercel.sh` - 部署到 Vercel 生产环境
  - `deploy/check-deployment.sh` - 部署前检查脚本
- ✅ **环境变量**: 支持通过环境变量配置链参数

**部署文档**: 
- [Vercel部署指南](../deploy/Vercel部署指南.md) - 详细的部署步骤
- [智能合约部署到Mantle测试网操作步骤](../deploy/智能合约部署到Mantle测试网操作步骤.md) - 合约部署指南
- [合约部署总结](../smart-services/DEPLOYMENT_SUMMARY.md) - 已部署合约地址和状态

## 文档结构

### 核心文档

1. **[系统需求规格说明书（SRS）](./系统需求规格说明书.md)**
   - 需求边界与优先级（MUST/SHOULD/COULD）
   - 角色/场景/用例
   - 功能需求与非功能需求
   - 验收标准与测试大纲

2. **[系统概要设计说明书](./系统概要设计说明书.md)**
   - 系统架构与分层
   - 技术选型与关键约束
   - 模块/子模块划分与职责边界
   - 关键接口/数据流/控制流/数据模型（外部行为视角）

3. **[系统详细设计](./系统详细设计.md)**
   - 内部设计与实现规格（怎么做）
   - 详细的数据结构、接口规格、算法与逻辑

### 设计文档

3. **账户创建与存储设计（已并入系统设计文档）**
   - 账户三路径、关键外部行为：见 [系统概要设计说明书](./系统概要设计说明书.md)
   - 内部实现规格与细节：见 [系统详细设计](./系统详细设计.md)
   - 历史原始文档已去重清理：以系统设计文档为唯一来源

### 技术文档

5. **[API 接口文档](./API接口文档.md)**
   - 钱包核心接口
   - 账户抽象相关接口
   - 多链操作接口
   - DApp 集成接口
   - 错误处理规范

6. **实现状态说明（已并入系统设计文档）**
   - 关键实现对照与待完善项：已并入 [系统概要设计说明书](./系统概要设计说明书.md) 与 [系统详细设计](./系统详细设计.md)
   - 历史原始文档已归档：`../check/archive/代码分析与实现状态报告.md`

### 开发文档

7. **[开发检查清单](./check_list.md)**
   - 项目初始化阶段
   - 核心协议栈验证
   - 功能开发阶段
   - 测试与验证

### 部署文档

4. **[部署指南](../deploy/部署指南.md)**
   - 构建配置
   - Vercel 部署步骤
   - 环境变量配置
   - 性能优化
   - 安全配置

5. **[Vercel部署指南](../deploy/Vercel部署指南.md)**
   - Vercel 详细部署步骤
   - 环境变量配置说明
   - 域名配置指南

## 快速导航

### 想了解项目定位和架构？
→ 阅读 [系统需求规格说明书（SRS）](./系统需求规格说明书.md)
→ 阅读 [系统概要设计说明书](./系统概要设计说明书.md)
→ 阅读 [系统详细设计](./系统详细设计.md)

### 想了解账户创建和存储设计？
→ 阅读 [系统概要设计说明书](./系统概要设计说明书.md)（架构/模块/接口/数据流）
→ 阅读 [系统详细设计](./系统详细设计.md)（内部设计与实现规格）

### 需要集成钱包功能？
→ 阅读 [API 接口文档](./API接口文档.md)

### 需要查看开发进度？
→ 阅读 [开发检查清单](./check_list.md)
→ 阅读 [系统详细设计](./系统详细设计.md) 附录A（实现状态对照）

### 需要部署到生产环境？
→ 阅读 [部署指南](../deploy/部署指南.md)
→ 阅读 [Vercel部署指南](../deploy/Vercel部署指南.md)

### 需要部署智能合约？
→ 阅读 [智能合约部署到Mantle测试网操作步骤](../deploy/智能合约部署到Mantle测试网操作步骤.md)
→ 查看 [合约部署总结](../smart-services/DEPLOYMENT_SUMMARY.md)

## 与传统钱包的对比

| 特性 | AnDaoWallet (智能合约钱包) | 传统 EOA 钱包 (如 MetaMask) |
|------|---------------------------|---------------------------|
| 账户类型 | 智能合约账户（Kernel） | 外部账户（EOA） |
| 私钥管理 | 支持社交恢复，可更换签名密钥 | 私钥丢失即资产丢失 |
| Gas 支付 | 支持 Gas 代付（Paymaster） | 必须持有原生代币支付 Gas |
| 批量交易 | 原生支持批量交易 | 需要多次签名 |
| 交易灵活性 | 支持条件交易、延迟交易等 | 仅支持标准交易 |
| 插件系统 | 支持 ERC-7579 插件扩展 | 功能固定 |
| 部署方式 | PWA，访问 URL 即可使用 | 需要安装浏览器扩展 |
| 跨平台 | 支持所有现代浏览器 | 受浏览器限制 |

## 技术栈

### 前端技术
- **项目名称**: @andaowallet/h5
- **项目版本**: 0.1.0
- **前端框架**: React 18.2.0
- **状态管理**: MobX 6.10.0
- **样式方案**: Styled Components 6.1.1
- **构建工具**: Vite 5.0.5
- **路由**: React Router v6.20.0
- **PWA 支持**: vite-plugin-pwa 0.17.4

### 账户抽象技术
- **智能合约框架**: Kernel v3（ERC-4337 兼容）
- **合约源码**: 位于 `smart-services/contracts/src` 目录
- **类型定义**: 本地定义在 `src/utils/kernel-types.ts`（不依赖 TypeChain）
- **链交互**: viem 2.0.0 和 ethers.js 6.9.0
- **Bundler**: 支持 ERC-4337 的 Bundler 网络（多服务商故障转移）
- **Paymaster**: Gas 代付服务（可选，已实现 PaymasterService）

### 区块链支持
- **优先链**: Mantle Network（EVM 兼容，已部署到测试网）
- **次要链**: Injective Network（待技术验证）
- **支持策略**: MVP 阶段仅支持 Mantle，后续根据 Injective 支持情况决定

### 已部署的合约（Mantle Sepolia 测试网）

- **Kernel**: `0x7318DdE98c8C70b4652b0C697d8Ee8E2e2d0655F`
  - [查看合约](https://sepolia.mantlescan.xyz/address/0x7318DdE98c8C70b4652b0C697d8Ee8E2e2d0655F)
- **KernelFactory**: `0x5401b77d3b9BB2ce8757951d03aB6d9aEb22161d`
  - [查看合约](https://sepolia.mantlescan.xyz/address/0x5401b77d3b9BB2ce8757951d03aB6d9aEb22161d)
- **EntryPoint**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`（ERC-4337 标准地址）

详细部署信息请查看：[合约部署总结](../smart-services/DEPLOYMENT_SUMMARY.md)

### 安全与存储
- **加密存储**: Web Crypto API（AES-GCM）
- **密钥管理**: 本地存储（IndexedDB），支持社交恢复
- **硬件钱包**: 通过 WebUSB/WebHID（可选）

## 开发优先级与实现状态

### MVP 阶段（必须完成）
1. ✅ Mantle 链完整支持
2. ✅ 账户创建和管理（AccountManager）
3. ✅ 基础转账功能（TransactionRelayer，通过 UserOperation）
4. ✅ Bundler 集成（BundlerClient）
5. ✅ Ethereum Provider 接口（ProviderAdapter，支持 EIP-1193、EIP-6963）
6. ✅ 消息签名功能（SignatureService：eth_sign、personal_sign、eth_signTypedData）
7. ✅ 链管理功能（ChainService：wallet_switchEthereumChain、wallet_addEthereumChain）
8. ✅ 两阶段提交功能（TwoPhaseCommitService，支持加密存储）
9. ✅ Interaction Store（DApp 请求队列管理）
10. ✅ 插件执行逻辑（PluginService：Executor、Hook 插件）

### 已完成功能
- ✅ **账户管理**: AccountManager 服务，支持创建和管理 Kernel 智能合约账户
- ✅ **交易中继**: TransactionRelayer 服务，通过 UserOperation 发送交易
- ✅ **消息签名**: SignatureService 服务，支持标准签名方法
- ✅ **链管理**: ChainService 服务，支持添加和切换链
- ✅ **两阶段提交**: TwoPhaseCommitService 服务，支持加密存储原始数据
- ✅ **加密服务**: StableThreeFeatureKey 和 TwoPhaseCommitEncryption，三特征密钥系统
- ✅ **社交恢复**: GuardianService 服务（框架完成，基于插件实现）
- ✅ **插件系统**: PluginService 服务，支持 Executor 和 Hook 插件执行
- ✅ **Provider 适配器**: ProviderAdapter，实现标准 Ethereum Provider 接口
- ✅ **交互管理**: InteractionStore，管理 DApp 请求队列

### 后续阶段（根据需求）
1. ⚠️ Injective 链支持（需技术验证）
2. ⚠️ Paymaster 集成（Gas 代付）
3. ⚠️ 社交恢复功能完整实现（需要恢复插件）
4. ⚠️ 硬件钱包支持（WebUSB/WebHID）
5. ⚠️ ECDSAValidator 部署（验证器合约待部署）

## 相关文档

- **系统文档**: [系统需求规格说明书（SRS）](./系统需求规格说明书.md) | [系统概要设计说明书](./系统概要设计说明书.md) | [系统详细设计](./系统详细设计.md)
- **设计文档**: 已并入系统文档（历史原始文档见 `archive/`）
- **API 文档**: [API接口文档](./API接口文档.md)
- **开发文档**: [开发检查清单](./check_list.md)
- **部署文档**: [部署指南](../deploy/部署指南.md) | [Vercel部署指南](../deploy/Vercel部署指南.md)
- **合约部署**: [合约部署总结](../smart-services/DEPLOYMENT_SUMMARY.md) | [部署操作步骤](../deploy/智能合约部署到Mantle测试网操作步骤.md)

## 历史记录索引

- `../check/archive/`：阶段性报告 / 审查结论 / 部署记录等历史文档归档目录（功能点的权威描述请以系统文档为准）

## 文档归档

历史版本的文档已归档到 `docs/archive/` 目录：
- 旧版代码分析报告
- 历史设计文档

## 更新日志

- **v0.1.0** (2025-01-13): 
  - 完成核心合约部署到 Mantle Sepolia 测试网
  - Kernel 和 KernelFactory 已成功部署
  - 更新文档以反映实际代码状态
  - 优化合约大小（从 27KB 降至 24KB 以下）

---

**重要提示**: 
1. 本项目是**完全独立的智能合约钱包**，不依赖任何传统钱包的核心代码
2. UI 层面参考 Keplr 的设计风格，代码完全独立实现
3. 合约代码位于 `smart-services/` 目录，使用 Foundry 和 Hardhat 进行开发和部署
4. MVP 阶段优先支持 Mantle 链，核心合约已部署到 Mantle Sepolia 测试网
5. 项目使用本地定义的合约类型（`src/utils/kernel-types.ts`），不依赖外部 SDK
6. 所有部署脚本位于 `deploy/` 目录，合约部署脚本位于 `smart-services/scripts/` 目录
