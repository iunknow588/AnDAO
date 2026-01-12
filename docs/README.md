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
4. **直接使用 kernel-dev**: 不通过 SDK，直接使用 `../kernel-dev` 中的合约接口和类型定义
5. **多链支持策略**: MVP 阶段仅支持 Mantle 链，Injective 链支持根据技术验证结果决定
6. **外部服务依赖**: 仅依赖链上 RPC、Bundler、Paymaster 等第三方服务，不落地任何用户数据到自有服务器

## 文档结构

### 核心文档

1. **[系统概述](./系统概述.md)**
   - 系统定位和目标
   - 技术栈选择（账户抽象技术栈）
   - 架构设计概述
   - 与传统钱包的对比
   - 部署和运行环境

2. **[架构分析与修正报告](./架构分析与修正报告.md)** ⭐ **新增**
   - 架构审查发现的问题
   - 修正方案和建议
   - 风险评估和缓解措施
   - **建议首先阅读此文档**

3. **[账户抽象架构说明](./账户抽象架构说明.md)**
   - 账户抽象概述
   - Kernel 智能合约账户
   - ERC-4337 标准
   - 系统架构
   - 核心组件
   - 工作流程

4. **[架构设计](./架构设计.md)**
   - 整体架构设计（已修正）
   - 分层架构说明
   - 核心模块设计
   - 状态管理架构
   - 路由和导航设计

5. **[开发检查清单](./check_list.md)**
   - 完整的开发任务清单
   - 分阶段开发计划
   - 里程碑检查点
   - **包含技术验证阶段（阶段 0）**

### 技术文档

6. **[API 接口文档](./API接口文档.md)**
   - 钱包核心接口
   - 账户抽象相关接口
   - 多链操作接口
   - DApp 集成接口
   - 错误处理规范

7. **[开发指南](./开发指南.md)**
   - 开发环境搭建
   - 项目结构说明
   - 开发工作流
   - 代码规范
   - kernel-dev 集成步骤

8. **[部署指南](./部署指南.md)**
   - 构建配置
   - 服务器配置
   - CDN 配置
   - 性能优化
   - 安全配置

## 快速导航

### 想了解项目定位和架构？
→ 阅读 [架构分析与修正报告](./架构分析与修正报告.md) ⭐ **推荐首先阅读**
→ 阅读 [系统概述](./系统概述.md)

### 想了解账户抽象技术？
→ 阅读 [账户抽象架构说明](./账户抽象架构说明.md)

### 准备开始开发？
→ 阅读 [开发检查清单](./check_list.md) - 从阶段 0（技术验证）开始
→ 阅读 [开发指南](./开发指南.md)

### 需要了解系统架构？
→ 阅读 [架构设计](./架构设计.md)

### 需要集成钱包功能？
→ 阅读 [API 接口文档](./API接口文档.md)

### 需要部署到生产环境？
→ 阅读 [部署指南](./部署指南.md)

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
- **前端框架**: React 18.2.0
- **状态管理**: MobX 6.10.0 或 Zustand
- **构建工具**: Vite（推荐）或 Webpack 5
- **路由**: React Router v6+
- **PWA 支持**: vite-plugin-pwa

### 账户抽象技术
- **智能合约框架**: Kernel v3（ERC-4337 兼容）
- **源码集成**: 直接使用 `../kernel-dev` 目录中的合约源码
- **类型绑定**: TypeChain 从合约生成 TypeScript 类型
- **链交互**: viem 或 ethers.js
- **Bundler**: 支持 ERC-4337 的 Bundler 网络（多服务商故障转移）
- **Paymaster**: Gas 代付服务（可选）

### 区块链支持
- **优先链**: Mantle Network（EVM 兼容，优先支持）
- **次要链**: Injective Network（需要验证 ERC-4337 支持情况）
- **支持策略**: MVP 阶段仅支持 Mantle，后续根据 Injective 支持情况决定

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
5. ⚠️ kernel-dev 类型导入（需要先编译 kernel-dev）

## 相关文档

- **架构审查报告**: [架构分析与修正报告](./架构分析与修正报告.md) ⭐
- **开发计划**: [开发检查清单](./check_list.md)
- **扩展版本文档**: 参见 `../dosc_cn/` 目录（注意：架构完全独立，不依赖扩展版本）

## 更新日志

- **v1.1.0** (2024): 架构审查和修正，明确项目定位，添加技术验证阶段
- **v1.0.0** (2024): 初始文档版本

---

**重要提示**: 
1. 本项目是**完全独立的智能合约钱包**，不依赖 Keplr 扩展版本的核心代码
2. UI 层面仅参考 Keplr 的设计风格，代码完全独立实现
3. 直接使用 kernel-dev 源码，不通过 SDK 封装
4. MVP 阶段优先支持 Mantle 链，确保核心功能稳定
