# AnDaoWallet HTML5 版本 API 接口文档

## 文档信息

- **项目名称**: AnDaoWallet HTML5 版本（智能合约钱包 PWA）
- **文档版本**: 2.0
- **编制日期**: 2024年
- **最后更新**: 2024年
- **文档状态**: 正式版

## 重要说明

1. **基于 Ethereum Provider**: 本钱包实现标准的 Ethereum Provider 接口（`window.ethereum`），兼容 EIP-6963 钱包发现标准
2. **账户抽象**: 所有交易通过 UserOperation 发送，使用 Kernel 智能合约账户
3. **完全独立**: 架构完全独立，不依赖任何传统钱包的核心代码
4. **无自建服务端**: 不提供自有 REST/WebSocket API；数据仅保存在本地或链上，依赖外部 RPC/Bundler/Paymaster。

## 目录

1. [接口概述](#1-接口概述)
2. [Ethereum Provider 标准接口](#2-ethereum-provider-标准接口)
3. [消息签名接口](#3-消息签名接口)
4. [链管理接口](#4-链管理接口)
5. [两阶段提交接口](#5-两阶段提交接口)
6. [DApp 集成示例](#6-dapp-集成示例)
7. [错误处理](#7-错误处理)
8. [类型定义](#8-类型定义)

---

## 1. 接口概述

### 1.1 接口提供方式

HTML5 版本通过 `window.ethereum` 对象提供标准的 Ethereum Provider 接口，供 DApp 集成使用。

```typescript
// 检查钱包是否可用
if (typeof window.ethereum !== 'undefined' && window.ethereum.isAnDaoWallet) {
  // AnDaoWallet 可用
  const provider = window.ethereum;
} else {
  // 钱包不可用
  console.warn('AnDaoWallet not found');
}
```

### 1.2 接口特点

- **标准兼容**: 实现标准的 Ethereum Provider 接口（EIP-1193）
- **EIP-6963 支持**: 支持钱包发现标准
- **异步接口**: 所有接口返回 Promise
- **类型安全**: 完整的 TypeScript 类型定义
- **错误处理**: 统一的错误处理机制
- **权限控制**: 基于 Origin 的权限管理，通过 InteractionStore 管理请求队列

### 1.3 账户抽象特性

- **UserOperation**: 所有交易通过 UserOperation 发送到 Bundler
- **智能合约账户**: 使用 Kernel 智能合约账户，支持社交恢复、Gas 代付等高级功能
- **消息签名**: 支持 eth_sign、personal_sign、eth_signTypedData 等标准签名方法

---

## 2. Ethereum Provider 标准接口

### 2.1 连接钱包

#### `eth_requestAccounts(): Promise<string[]>`

请求用户授权连接钱包，返回账户地址列表。

**返回值**: `Promise<string[]>` - 账户地址数组

**示例**:
```typescript
try {
  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts'
  });
  console.log('Connected accounts:', accounts);
  // 输出: ['0x...']
} catch (error) {
  console.error('Connection failed:', error);
}
```

### 2.2 获取账户列表

#### `eth_accounts(): Promise<string[]>`

获取当前已连接的账户地址列表（不需要用户授权）。

**返回值**: `Promise<string[]>` - 账户地址数组

**示例**:
```typescript
const accounts = await window.ethereum.request({
  method: 'eth_accounts'
});
console.log('Current accounts:', accounts);
```

### 2.3 获取链 ID

#### `eth_chainId(): Promise<string>`

获取当前连接的链 ID（十六进制格式）。

**返回值**: `Promise<string>` - 链 ID（如 "0x1388" 表示 5000）

**示例**:
```typescript
const chainId = await window.ethereum.request({
  method: 'eth_chainId'
});
console.log('Current chain ID:', chainId);
```

### 2.4 发送交易

#### `eth_sendTransaction(params): Promise<string>`

发送交易到链上。交易会通过 UserOperation 发送到 Bundler。

**参数**:
```typescript
{
  from?: string;      // 发送方地址（可选，默认使用当前账户）
  to: string;         // 接收方地址
  value?: string;     // 转账金额（wei，十六进制）
  data?: string;      // 调用数据（十六进制）
  gas?: string;       // Gas 限制（十六进制）
  gasPrice?: string;  // Gas 价格（十六进制）
}
```

**返回值**: `Promise<string>` - 交易哈希（UserOperation 哈希）

**示例**:
```typescript
const txHash = await window.ethereum.request({
  method: 'eth_sendTransaction',
  params: [{
    from: '0x...',
    to: '0x...',
    value: '0x0',
    data: '0x...'
  }]
});
console.log('Transaction hash:', txHash);
```

**注意**: 
- 所有交易通过 UserOperation 发送，使用 Kernel 智能合约账户
- 需要用户确认（通过 InteractionStore）
- 支持 Gas 代付（如果配置了 Paymaster）

---

## 3. 消息签名接口

### 3.1 eth_sign（已弃用）

#### `eth_sign(address, message): Promise<string>`

对原始消息进行签名（已弃用，存在安全风险）。

**参数**:
- `address` (string): 签名者地址
- `message` (string): 原始消息（十六进制字符串）

**返回值**: `Promise<string>` - 签名结果（65 字节，r + s + v）

**示例**:
```typescript
const signature = await window.ethereum.request({
  method: 'eth_sign',
  params: ['0x...', '0x...']
});
```

**注意**: 
- ⚠️ 此方法已弃用，存在安全风险
- 建议使用 `personal_sign` 或 `eth_signTypedData`

### 3.2 personal_sign（推荐）

#### `personal_sign(message, address): Promise<string>`

使用 EIP-191 标准对个人消息进行签名（推荐方式）。

**参数**:
- `message` (string): 消息（字符串或十六进制）
- `address` (string): 签名者地址

**返回值**: `Promise<string>` - 签名结果（65 字节，r + s + v）

**示例**:
```typescript
const signature = await window.ethereum.request({
  method: 'personal_sign',
  params: ['Hello, World!', '0x...']
});
console.log('Signature:', signature);
```

### 3.3 eth_signTypedData（最安全）

#### `eth_signTypedData(address, typedData): Promise<string>`

使用 EIP-712 标准对结构化数据进行签名（最安全的方式）。

**参数**:
- `address` (string): 签名者地址
- `typedData` (object): EIP-712 结构化数据

**类型定义**:
```typescript
interface TypedData {
  domain: {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: string;
    salt?: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, any>;
}
```

**返回值**: `Promise<string>` - 签名结果（65 字节，r + s + v）

**示例**:
```typescript
const typedData = {
  domain: {
    name: 'MyApp',
    version: '1',
    chainId: 5000,
    verifyingContract: '0x...'
  },
  types: {
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' }
    ]
  },
  primaryType: 'Person',
  message: {
    name: 'Alice',
    wallet: '0x...'
  }
};

const signature = await window.ethereum.request({
  method: 'eth_signTypedData',
  params: ['0x...', typedData]
});
```

---

## 4. 链管理接口

### 4.1 切换链

#### `wallet_switchEthereumChain(params): Promise<null>`

切换到指定的链（EIP-3326 标准）。

**参数**:
```typescript
{
  chainId: string;  // 链 ID（十六进制，如 "0x1388"）
}
```

**返回值**: `Promise<null>` - 成功时返回 null

**示例**:
```typescript
try {
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: '0x1388' }]  // Mantle 主网
  });
  console.log('Chain switched successfully');
} catch (error) {
  if (error.code === 4902) {
    // 链不存在，需要先添加
    console.log('Chain not found, please add it first');
  }
}
```

### 4.2 添加链

#### `wallet_addEthereumChain(params): Promise<null>`

添加自定义链（EIP-3085 标准）。

**参数**:
```typescript
{
  chainId: string;                    // 链 ID（十六进制）
  chainName: string;                  // 链名称
  nativeCurrency: {
    name: string;                     // 原生代币名称
    symbol: string;                   // 原生代币符号
    decimals: number;                  // 小数位数
  };
  rpcUrls: string[];                  // RPC URL 列表
  blockExplorerUrls?: string[];       // 区块浏览器 URL（可选）
  iconUrls?: string[];                // 图标 URL（可选）
}
```

**返回值**: `Promise<null>` - 成功时返回 null

**示例**:
```typescript
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x1388',
    chainName: 'Mantle',
    nativeCurrency: {
      name: 'Mantle',
      symbol: 'MNT',
      decimals: 18
    },
    rpcUrls: ['https://rpc.mantle.xyz'],
    blockExplorerUrls: ['https://explorer.mantle.xyz']
  }]
});
```

---

## 5. 两阶段提交接口

两阶段提交功能通过前端内部服务实现，支持加密存储原始数据。**无服务端任务队列**，所有任务状态存放于本地，轮询在前台/受限 SW 中执行，标签页隐藏可能暂停监控。

### 5.1 生成承诺哈希

#### `TwoPhaseCommitService.generateCommitmentHash(data): Promise<Hash>`

根据原始数据生成承诺哈希（SHA-256）。

**参数**:
- `data` (string | Hex): 原始数据（字符串或十六进制）

**返回值**: `Promise<Hash>` - 承诺哈希（0x 前缀的十六进制字符串）

**示例**:
```typescript
import { twoPhaseCommitService } from '@andaowallet/h5';

const originalData = 'my secret vote data';
const commitmentHash = await twoPhaseCommitService.generateCommitmentHash(originalData);
console.log('Commitment hash:', commitmentHash);
```

### 5.2 创建两阶段提交任务

#### `submitTwoPhaseCommit(request: TwoPhaseCommitRequest): Promise<TwoPhaseCommitResponse>`

提交一个两阶段提交任务。

**参数**: `TwoPhaseCommitRequest`

**类型定义**:
```typescript
interface TwoPhaseCommitRequest {
  chainId: string;                    // 链 ID
  contractAddress: string;            // 合约地址
  firstPhaseTx: Uint8Array;           // 第一阶段交易（commit 交易）
  commitmentHash: string;             // 承诺哈希
  revealData: Uint8Array;             // 待揭示的数据（加密存储）
  
  // 状态监控配置
  stateMonitoring: {
    checkMethod: string;               // 状态查询方法名
    expectedState: {
      type: 'boolean' | 'value';
      value?: any;
      operator?: 'equals' | 'greaterThan';
    };
    pollingInterval?: number;          // 轮询间隔（秒）
    maxPollingDuration?: number;       // 最大监控时长（秒）
  };
  
  // 用户选项
  options?: {
    autoReveal?: boolean;              // 是否自动执行 reveal
    notificationEnabled?: boolean;     // 是否启用通知
  };
}
```

**返回值**: `Promise<TwoPhaseCommitResponse>`

**类型定义**:
```typescript
interface TwoPhaseCommitResponse {
  taskId: string;                      // 任务 ID
  firstPhaseTxHash: string;            // 第一阶段交易哈希
  commitmentHash: string;              // 承诺哈希
  status: 'monitoring_started';        // 状态
}
```

**示例**:
```typescript
import { twoPhaseCommitService } from '@andaowallet/h5';

const request: TwoPhaseCommitRequest = {
  chainId: 'cosmoshub-4',
  contractAddress: 'cosmos1...',
  firstPhaseTx: commitTxBytes,
  commitmentHash: '0x...',
  revealData: encryptedData,
  stateMonitoring: {
    checkMethod: 'canReveal',
    expectedState: {
      type: 'boolean',
      value: true,
    },
    pollingInterval: 30,
  },
  options: {
    autoReveal: true,
    notificationEnabled: true,
  },
};

const response = await twoPhaseCommitService.submitTwoPhaseCommit(request);
console.log('Task ID:', response.taskId);
```

### 3.2 检查任务状态

#### `checkTwoPhaseCommitStatus(taskId: string): Promise<TwoPhaseCommitTaskStatus>`

检查两阶段提交任务的状态。

**参数**:
- `taskId` (string): 任务 ID

**返回值**: `Promise<TwoPhaseCommitTaskStatus>`

**类型定义**:
```typescript
interface TwoPhaseCommitTaskStatus {
  taskId: string;
  status: TwoPhaseCommitTaskStatusType;
  firstPhaseTxHash: string;
  revealedTxHash?: string;
  monitoring: {
    totalChecks: number;
    lastCheckedAt: number;
    lastCheckResult: any;
    lastError?: string;
  };
  createdAt: number;
  revealedAt?: number;
}

type TwoPhaseCommitTaskStatusType =
  | 'pending'
  | 'monitoring'
  | 'ready_to_reveal'
  | 'revealing'
  | 'revealed'
  | 'failed'
  | 'cancelled';
```

**示例**:
```typescript
const status = await twoPhaseCommitService.checkTwoPhaseCommitStatus(taskId);
console.log('Status:', status.status);
console.log('Last checked:', new Date(status.monitoring.lastCheckedAt));
```

### 3.3 执行 Reveal

#### `executeReveal(taskId: string): Promise<RevealResponse>`

手动执行 reveal 操作。

**参数**:
- `taskId` (string): 任务 ID

**返回值**: `Promise<RevealResponse>`

**类型定义**:
```typescript
interface RevealResponse {
  taskId: string;
  revealTxHash: string;
  status: 'revealed';
}
```

**示例**:
```typescript
const response = await twoPhaseCommitService.executeReveal(taskId);
console.log('Reveal TX Hash:', response.revealTxHash);
```

### 3.4 获取任务列表

#### `getTwoPhaseCommitTasks(chainId?: string): Promise<TwoPhaseCommitTask[]>`

获取两阶段提交任务列表（**仅本地存储的任务**）。

**参数**:
- `chainId` (string, optional): 链 ID，如果提供则只返回该链的任务

**返回值**: `Promise<TwoPhaseCommitTask[]>`

**类型定义**:
```typescript
interface TwoPhaseCommitTask {
  id: string;
  chainId: string;
  contractAddress: string;
  firstPhaseTxHash: string;
  commitmentHash: string;
  status: TwoPhaseCommitTaskStatusType;
  monitoring: {
    checkMethod: string;
    lastCheckedAt: number;
    checkCount: number;
  };
  createdAt: number;
  revealedAt?: number;
  revealedTxHash?: string;
}
```

### 3.5 取消任务

#### `cancelTwoPhaseCommitTask(taskId: string): Promise<void>`

取消一个两阶段提交任务。

**参数**:
- `taskId` (string): 任务 ID

**返回值**: `Promise<void>`

**注意**: 只能取消处于 `pending` 或 `monitoring` 状态的任务。

---

## 4. 多链操作接口

### 4.1 签名交易

#### `signAmino(chainId: string, signer: string, signDoc: StdSignDoc, signOptions?: KeplrSignOptions): Promise<AminoSignResponse>`

使用 Amino 格式签名交易。

**参数**:
- `chainId` (string): 链 ID
- `signer` (string): 签名者地址
- `signDoc` (StdSignDoc): 签名文档
- `signOptions` (KeplrSignOptions, optional): 签名选项

**返回值**: `Promise<AminoSignResponse>`

**类型定义**:
```typescript
interface AminoSignResponse {
  signed: StdSignDoc;
  signature: StdSignature;
}
```

#### `signDirect(chainId: string, signer: string, signDoc: SignDoc, signOptions?: KeplrSignOptions): Promise<DirectSignResponse>`

使用 Protobuf 格式签名交易。

**参数**:
- `chainId` (string): 链 ID
- `signer` (string): 签名者地址
- `signDoc` (SignDoc): 签名文档
- `signOptions` (KeplrSignOptions, optional): 签名选项

**返回值**: `Promise<DirectSignResponse>`

### 4.2 发送交易

#### `sendTx(chainId: string, tx: Uint8Array, mode: BroadcastMode): Promise<Uint8Array>`

发送交易到链上。

**参数**:
- `chainId` (string): 链 ID
- `tx` (Uint8Array): 交易字节
- `mode` (BroadcastMode): 广播模式

**返回值**: `Promise<Uint8Array>` - 交易哈希

**类型定义**:
```typescript
type BroadcastMode = 'block' | 'sync' | 'async';
```

### 4.3 签名任意消息

#### `signArbitrary(chainId: string, signer: string, data: string | Uint8Array): Promise<StdSignature>`

签名任意数据。

**参数**:
- `chainId` (string): 链 ID
- `signer` (string): 签名者地址
- `data` (string | Uint8Array): 待签名数据

**返回值**: `Promise<StdSignature>`

---

## 6. DApp 集成示例

### 6.1 检测钱包

```typescript
function detectWallet(): boolean {
  return typeof window.ethereum !== 'undefined' && 
         window.ethereum.isAnDaoWallet === true;
}
```

### 6.2 连接钱包示例

```typescript
async function connectWallet() {
  if (!window.ethereum || !window.ethereum.isAnDaoWallet) {
    throw new Error('AnDaoWallet not found');
  }
  
  try {
    // 请求连接
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
    
    // 获取链 ID
    const chainId = await window.ethereum.request({
      method: 'eth_chainId'
    });
    
    return {
      address: accounts[0],
      chainId: chainId,
    };
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    throw error;
  }
}
```

### 6.3 发送交易示例

```typescript
async function sendTransaction(to: string, value: string, data?: string) {
  try {
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: accounts[0],  // 当前账户
        to: to,
        value: value,       // wei，十六进制
        data: data || '0x'
      }]
    });
    
    console.log('Transaction hash:', txHash);
    return txHash;
  } catch (error) {
    console.error('Failed to send transaction:', error);
    throw error;
  }
}
```

### 6.4 签名消息示例

```typescript
async function signMessage(message: string) {
  try {
    const accounts = await window.ethereum.request({
      method: 'eth_accounts'
    });
    
    // 使用 personal_sign（推荐）
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, accounts[0]]
    });
    
    console.log('Signature:', signature);
    return signature;
  } catch (error) {
    console.error('Failed to sign message:', error);
    throw error;
  }
}
```

### 6.5 监听链切换

```typescript
// 监听链切换事件
window.ethereum.on('chainChanged', (chainId: string) => {
  console.log('Chain changed to:', chainId);
  // 重新加载页面或更新 UI
  window.location.reload();
});

// 监听账户切换事件
window.ethereum.on('accountsChanged', (accounts: string[]) => {
  console.log('Accounts changed:', accounts);
  // 更新 UI
});
```

---

## 7. 错误处理

### 7.1 标准错误代码

AnDaoWallet 遵循 EIP-1193 和 EIP-1474 标准错误代码：

```typescript
// EIP-1193 标准错误代码
enum ProviderErrorCode {
  // 用户拒绝
  USER_REJECTED_REQUEST = 4001,
  
  // 未授权
  UNAUTHORIZED = 4100,
  
  // 不支持的方法
  UNSUPPORTED_METHOD = 4200,
  
  // 断开连接
  DISCONNECTED = 4900,
  
  // 链断开连接
  CHAIN_DISCONNECTED = 4901,
}

// EIP-3326 链切换错误
enum ChainSwitchErrorCode {
  // 链不存在
  CHAIN_NOT_FOUND = 4902,
}

// 自定义错误代码
enum AnDaoWalletErrorCode {
  // 账户不存在
  ACCOUNT_NOT_FOUND = 5000,
  
  // 交易失败
  TRANSACTION_FAILED = 5001,
  
  // 余额不足
  INSUFFICIENT_BALANCE = 5002,
  
  // 签名失败
  SIGNATURE_FAILED = 5003,
  
  // 两阶段提交错误
  TWO_PHASE_COMMIT_INVALID = 6000,
  TWO_PHASE_COMMIT_DECRYPT_FAILED = 6001,
  TWO_PHASE_COMMIT_MONITORING_FAILED = 6002,
}
```

### 7.2 错误处理示例

```typescript
try {
  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts'
  });
} catch (error: any) {
  if (error.code) {
    switch (error.code) {
      case 4001:
        console.error('User rejected the request');
        break;
      case 4100:
        console.error('Unauthorized');
        break;
      case 4902:
        console.error('Chain not found. Please add the chain first.');
        break;
      default:
        console.error('Unknown error:', error);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### 7.3 链切换错误处理

```typescript
try {
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: '0x1388' }]
  });
} catch (error: any) {
  if (error.code === 4902) {
    // 链不存在，尝试添加
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x1388',
          chainName: 'Mantle',
          nativeCurrency: {
            name: 'Mantle',
            symbol: 'MNT',
            decimals: 18
          },
          rpcUrls: ['https://rpc.mantle.xyz']
        }]
      });
    } catch (addError) {
      console.error('Failed to add chain:', addError);
    }
  } else {
    console.error('Failed to switch chain:', error);
  }
}
```

---

## 8. 类型定义

### 8.1 Ethereum Provider 接口

```typescript
// AnDaoWallet Provider 接口
interface AnDaoWalletProvider {
  isAnDaoWallet: true;
  
  // 标准 Ethereum Provider 方法
  request(args: { method: string; params?: any[] }): Promise<any>;
  
  // 事件监听
  on(event: string, handler: (...args: any[]) => void): void;
  removeListener(event: string, handler: (...args: any[]) => void): void;
  
  // 支持的方法
  // - eth_requestAccounts
  // - eth_accounts
  // - eth_chainId
  // - eth_sendTransaction
  // - eth_sign
  // - personal_sign
  // - eth_signTypedData
  // - eth_signTypedData_v4
  // - wallet_switchEthereumChain
  // - wallet_addEthereumChain
}

// 扩展 Window 接口
declare global {
  interface Window {
    ethereum?: AnDaoWalletProvider;
  }
}
```

### 8.2 交易参数类型

```typescript
interface TransactionRequest {
  from?: string;      // 发送方地址
  to: string;         // 接收方地址
  value?: string;     // 转账金额（wei，十六进制）
  data?: string;      // 调用数据（十六进制）
  gas?: string;       // Gas 限制（十六进制）
  gasPrice?: string;  // Gas 价格（十六进制）
}
```

### 8.3 签名类型

```typescript
// EIP-712 结构化数据
interface TypedData {
  domain: {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: string;
    salt?: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, any>;
}
```

### 8.4 链配置类型

```typescript
interface AddEthereumChainParameter {
  chainId: string;                    // 链 ID（十六进制）
  chainName: string;                  // 链名称
  nativeCurrency: {
    name: string;                     // 原生代币名称
    symbol: string;                   // 原生代币符号
    decimals: number;                  // 小数位数
  };
  rpcUrls: string[];                  // RPC URL 列表
  blockExplorerUrls?: string[];       // 区块浏览器 URL（可选）
  iconUrls?: string[];                // 图标 URL（可选）
}
```

### 8.5 两阶段提交类型

```typescript
interface TwoPhaseCommitTask {
  id: string;
  chainId: number;
  contractAddress: string;
  accountAddress?: string;
  firstPhaseTxHash: string;
  commitmentHash: string;
  encryptedData?: {
    iv: string;           // Base64 编码的 IV
    ciphertext: string;   // Base64 编码的密文
    timestamp: number;    // 加密时间戳
  };
  status: TwoPhaseCommitTaskStatus;
  createdAt: number;
  revealedAt?: number;
  revealedTxHash?: string;
}

type TwoPhaseCommitTaskStatus =
  | 'pending'
  | 'monitoring'
  | 'ready_to_reveal'
  | 'revealing'
  | 'revealed'
  | 'failed'
  | 'cancelled';
```

---

## 总结

本文档描述了 AnDaoWallet HTML5 版本的 API 接口。本钱包实现标准的 Ethereum Provider 接口（EIP-1193），兼容 EIP-6963 钱包发现标准。

### 核心特性

1. **标准兼容**: 实现标准的 Ethereum Provider 接口，兼容 MetaMask 等钱包的 DApp
2. **账户抽象**: 所有交易通过 UserOperation 发送，使用 Kernel 智能合约账户
3. **消息签名**: 支持 eth_sign、personal_sign、eth_signTypedData 等标准签名方法
4. **链管理**: 支持 wallet_switchEthereumChain 和 wallet_addEthereumChain（EIP-3326、EIP-3085）
5. **两阶段提交**: 支持加密存储原始数据的两阶段提交功能

### 开发建议

1. **检测钱包**: 使用 `window.ethereum.isAnDaoWallet` 检测 AnDaoWallet
2. **错误处理**: 遵循 EIP-1193 标准错误代码进行错误处理
3. **用户确认**: 所有需要用户确认的操作会通过 InteractionStore 队列管理
4. **链切换**: 处理链切换错误，必要时引导用户添加链

### 注意事项

- 所有交易通过 UserOperation 发送，使用 Kernel 智能合约账户
- 支持 Gas 代付（如果配置了 Paymaster）
- 两阶段提交功能需要先初始化加密服务（设置用户ID）
- Web 环境不支持后台监控，两阶段提交监控需要页面保持打开

### 相关文档

- [系统概述](./系统概述.md)
- [架构设计](./back/架构设计.md)
- [两阶段提交加密功能说明](./back/两阶段提交加密功能说明.md)

