/**
 * Provider 适配器
 * 
 * 提供 DApp 集成接口，支持 window.ethereum 和 EIP-6963 标准
 * 将标准的以太坊 Provider 方法转换为 UserOperation
 */

import { AccountStore } from '@/stores/AccountStore';
import { interactionStore } from '@/stores/InteractionStore';
import { TransactionRelayer } from '@/services/TransactionRelayer';
import { AccountManager } from '@/services/AccountManager';
import { signatureService } from '@/services/SignatureService';
import { keyManagerService } from '@/services/KeyManagerService';
import { chainService } from '@/services/ChainService';
import { getChainConfigByChainId } from '@/config/chains';
import type { TypedData } from '@/services/SignatureService';
import type { Address } from 'viem';

type ProviderEventHandler = (...args: unknown[]) => void;

export interface EthereumProvider {
  isAnDaoWallet?: boolean;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, handler: ProviderEventHandler): void;
  removeListener(event: string, handler: ProviderEventHandler): void;
}

type SendTransactionParams = {
  from?: string;
  to: string;
  value?: string;
  data?: string;
  gas?: string;
  gasPrice?: string;
};

type AddEthereumChainParams = {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  iconUrls?: string[];
};

/**
 * AnDaoWallet Ethereum Provider
 * 
 * 实现标准的以太坊 Provider 接口，将标准方法转换为 UserOperation
 */
export class AnDaoWalletProvider implements EthereumProvider {
  isAnDaoWallet = true;
  private accountStore: AccountStore;
  private transactionRelayer: TransactionRelayer;
  private listeners: Map<string, Set<ProviderEventHandler>> = new Map();

  constructor(
    accountStore: AccountStore,
    transactionRelayer: TransactionRelayer,
    _accountManager: AccountManager
  ) {
    this.accountStore = accountStore;
    this.transactionRelayer = transactionRelayer;
  }

  /**
   * 获取当前激活链的配置（优先内置链，其次自定义链）
   */
  private getActiveChainConfig() {
    return (
      getChainConfigByChainId(this.accountStore.currentChainId) ||
      chainService.getCustomChain(this.accountStore.currentChainId)
    );
  }

  /**
   * 获取当前激活链的账户（按 chainId 精确匹配）
   */
  private getActiveAccount() {
    return this.accountStore.getAccount(this.accountStore.currentChainId);
  }

  /**
   * 处理 Provider 请求
   * 
   * 对于需要用户确认的请求，会添加到 InteractionStore 队列中
   * 等待用户批准或拒绝
   */
  async request(args: { method: string; params?: unknown[] }): Promise<unknown> {
    const { method, params = [] } = args;
    
    // 获取 DApp 来源（如果可用）
    const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';

    // 需要用户确认的方法
    const requiresConfirmation = [
      'eth_sendTransaction',
      'eth_sign',
      'personal_sign',
      'eth_signTypedData',
      'eth_signTypedData_v4',
      'wallet_switchEthereumChain',
      'wallet_addEthereumChain',
    ];

    if (requiresConfirmation.includes(method)) {
      // 添加到交互队列
      const requestId = interactionStore.addRequest(
        method as Parameters<typeof interactionStore.addRequest>[0],
        origin,
        params
      );

      // 等待用户确认
      return this.waitForConfirmation(requestId, method, params);
    }

    // 不需要确认的方法直接执行
    switch (method) {
      case 'eth_requestAccounts':
        return this.requestAccounts();
      case 'eth_accounts':
        return this.getAccounts();
      case 'eth_chainId':
        return this.getChainId();
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  /**
   * 等待用户确认
   * 
   * 监听 InteractionStore 的事件，等待用户批准或拒绝请求
   */
  private async waitForConfirmation(
    requestId: string,
    method: string,
    params: unknown[]
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let cleanup = () => {};

      const settle = (handler: (value: unknown) => void, value: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        handler(value);
      };

      const checkRequest = () => {
        if (settled) return;
        const request = interactionStore.getRequest(requestId);
        if (!request) {
          settle(reject as (value: unknown) => void, new Error('Request not found'));
          return;
        }

        if (request.status === 'approved') {
          // 请求已批准，执行实际操作
          this.executeApprovedRequest(method, params, request.result)
            .then((result) => settle(resolve as (value: unknown) => void, result))
            .catch((error) => settle(reject as (value: unknown) => void, error));
        } else if (request.status === 'rejected') {
          // 请求被拒绝
          settle(
            reject as (value: unknown) => void,
            new Error(request.error || 'User rejected the request')
          );
        } else if (request.status === 'cancelled') {
          // 请求被取消
          settle(reject as (value: unknown) => void, new Error('Request was cancelled'));
        }
      };

      // 监听事件
      const handleApproved = (event: Event) => {
        if (settled) return;
        const detail = (event as CustomEvent).detail;
        if (detail?.request?.id === requestId) {
          this.executeApprovedRequest(method, params, detail.request.result)
            .then((result) => settle(resolve as (value: unknown) => void, result))
            .catch((error) => settle(reject as (value: unknown) => void, error));
        }
      };

      const handleRejected = (event: Event) => {
        if (settled) return;
        const detail = (event as CustomEvent).detail;
        if (detail?.request?.id === requestId) {
          settle(
            reject as (value: unknown) => void,
            new Error(detail.request.error || 'User rejected the request')
          );
        }
      };

      const pollTimer = window.setInterval(checkRequest, 100);
      const timeoutTimer = window.setTimeout(() => {
        settle(reject as (value: unknown) => void, new Error('Request confirmation timeout'));
      }, 5 * 60 * 1000);

      cleanup = () => {
        window.clearInterval(pollTimer);
        window.clearTimeout(timeoutTimer);
        window.removeEventListener('interaction:approved', handleApproved as EventListener);
        window.removeEventListener('interaction:rejected', handleRejected as EventListener);
      };

      window.addEventListener('interaction:approved', handleApproved as EventListener);
      window.addEventListener('interaction:rejected', handleRejected as EventListener);

      // 立即检查一次，避免等待首个轮询周期
      checkRequest();
    });
  }

  /**
   * 执行已批准的请求
   */
  private async executeApprovedRequest(
    method: string,
    params: unknown[],
    preApprovedResult?: unknown
  ): Promise<unknown> {
    // 如果已经有预批准的结果，直接返回
    if (preApprovedResult !== undefined) {
      return preApprovedResult;
    }

    // 否则执行实际操作
    switch (method) {
      case 'eth_sendTransaction':
        return this.sendTransaction(this.parseTransactionParam(params[0]));
      case 'eth_sign':
        return this.sign(this.parseStringParam(params[0], 'eth_sign.address'), this.parseStringParam(params[1], 'eth_sign.message'));
      case 'personal_sign':
        return this.personalSign(
          this.parseStringParam(params[0], 'personal_sign.message'),
          this.parseStringParam(params[1], 'personal_sign.address')
        );
      case 'eth_signTypedData':
      case 'eth_signTypedData_v4':
        return this.signTypedData(
          this.parseStringParam(params[0], 'eth_signTypedData.address'),
          this.parseTypedDataParam(params[1])
        );
      case 'wallet_switchEthereumChain':
        return this.switchChain(this.parseSwitchChainParam(params[0]));
      case 'wallet_addEthereumChain':
        return this.addChain(this.parseAddChainParam(params[0]));
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  /**
   * 请求账户连接
   */
  private async requestAccounts(): Promise<string[]> {
    const account = this.getActiveAccount();
    
    if (!account) {
      throw new Error('No account available. Please create or import an account first.');
    }

    return [account.address];
  }

  /**
   * 获取当前账户列表
   */
  private async getAccounts(): Promise<string[]> {
    const account = this.getActiveAccount();
    
    return account ? [account.address] : [];
  }

  /**
   * 获取当前链 ID
   */
  private async getChainId(): Promise<string> {
    return `0x${this.accountStore.currentChainId.toString(16)}`;
  }

  /**
   * 发送交易（转换为 UserOperation）
   */
  private async sendTransaction(tx: SendTransactionParams): Promise<string> {
    const account = this.getActiveAccount();
    
    if (!account) {
      throw new Error('No account available');
    }

    const chainConfig = this.getActiveChainConfig();
    if (!chainConfig) {
      throw new Error(`Current chain ${this.accountStore.currentChainId} is not configured`);
    }
    const data = tx.data || '0x';

    // 获取 owner 的私钥（用于签名 UserOperation）
    // 优先从会话中获取，如果不存在则抛出错误要求用户输入密码
    const ownerAddress = account.owner as `0x${string}`;
    let ownerPrivateKey: `0x${string}` | null = null;

    try {
      // 尝试从会话中获取私钥
      ownerPrivateKey = await keyManagerService.getPrivateKeyFromSession(ownerAddress);
    } catch (error) {
      console.warn('Failed to get private key from session:', error);
    }

    if (!ownerPrivateKey) {
      // 如果会话中没有私钥，抛出错误
      // DApp 应该提示用户输入密码或重新登录
      throw new Error(
        'Private key not available. Please unlock wallet or re-enter password to sign transaction.'
      );
    }

    // 使用 TransactionRelayer 发送交易
    // TransactionRelayer.sendTransaction 的参数顺序是 (accountAddress, chainId, target, data, ownerPrivateKey)
    const result = await this.transactionRelayer.sendTransaction(
      account.address as `0x${string}`,
      chainConfig.chainId,
      tx.to as `0x${string}`,
      data as `0x${string}`,
      ownerPrivateKey
    );

    // 触发交易发送事件
    this.emit('message', {
      type: 'eth_sendTransaction',
      data: result,
    });

    return result || '';
  }

  /**
   * 签名消息（eth_sign）
   * 
   * 注意：eth_sign 已弃用，存在安全风险
   * 建议 DApp 使用 personal_sign 或 eth_signTypedData
   */
  private async sign(address: string, message: string): Promise<string> {
    const account = this.getActiveAccount();
    
    if (!account) {
      throw new Error('No account available');
    }

    // 验证地址是否匹配
    if (account.address.toLowerCase() !== address.toLowerCase()) {
      throw new Error('Address mismatch');
    }

    // 获取签名者私钥（需要用户输入密码）
    // 注意：实际实现中应该从会话中获取，这里需要用户交互
    const privateKey = await this.getSignerPrivateKey(account.owner as Address);
    
    // 执行签名
    const signature = await signatureService.ethSign(message as `0x${string}`, privateKey);
    return signature;
  }

  /**
   * Personal Sign（推荐的消息签名方式）
   * 
   * EIP-191 标准个人消息签名
   */
  private async personalSign(message: string, address: string): Promise<string> {
    const account = this.getActiveAccount();
    
    if (!account) {
      throw new Error('No account available');
    }

    // 验证地址是否匹配
    if (account.address.toLowerCase() !== address.toLowerCase()) {
      throw new Error('Address mismatch');
    }

    // 获取签名者私钥
    const privateKey = await this.getSignerPrivateKey(account.owner as Address);
    
    // 执行签名
    const signature = await signatureService.personalSign(message, privateKey);
    return signature;
  }

  /**
   * 签名结构化数据（EIP-712）
   * 
   * 最安全和推荐的结构化数据签名方式
   */
  private async signTypedData(address: string, typedData: TypedData): Promise<string> {
    const account = this.getActiveAccount();
    
    if (!account) {
      throw new Error('No account available');
    }

    // 验证地址是否匹配
    if (account.address.toLowerCase() !== address.toLowerCase()) {
      throw new Error('Address mismatch');
    }

    // 获取签名者私钥
    const privateKey = await this.getSignerPrivateKey(account.owner as Address);
    
    // 执行签名
    const signature = await signatureService.signTypedData(typedData, privateKey);
    return signature;
  }

  /**
   * 获取签名者私钥
   * 
   * 从 KeyManagerService 获取签名者私钥
   * 
   * 实现流程：
   * 1. 首先尝试从会话中获取缓存的私钥
   * 2. 如果会话中没有，触发UI交互获取密码
   * 3. 使用密码从KeyManagerService获取私钥
   * 4. 将私钥缓存到会话中（临时存储）
   * 
   * @param ownerAddress 签名者地址
   * @returns 私钥
   * 
   * @throws {Error} 如果无法获取私钥（用户取消或认证失败）
   */
  private async getSignerPrivateKey(ownerAddress: Address): Promise<`0x${string}`> {
    // 1. 尝试从会话中获取缓存的私钥
    try {
      const cachedKey = await keyManagerService.getPrivateKeyFromSession(ownerAddress);
      if (cachedKey) {
        return cachedKey;
      }
    } catch (error) {
      // 会话中没有缓存的私钥，继续下一步
      console.debug('No cached private key in session, requesting password');
    }

    // 2. 触发UI交互获取密码
    // 注意：这里需要实现一个密码输入UI组件
    // 当前实现：通过事件触发UI，等待用户输入
    const password = await this.requestPasswordFromUI(ownerAddress);
    
    if (!password) {
      throw new Error('User cancelled password input');
    }

    // 3. 使用密码从KeyManagerService获取私钥
    const privateKey = await keyManagerService.getPrivateKey(ownerAddress, password);
    
    if (!privateKey) {
      throw new Error('Failed to get private key. Invalid password or key not found.');
    }

    // 4. 将私钥缓存到会话中（临时存储30分钟）
    await keyManagerService.cachePrivateKeyToSession(ownerAddress, privateKey, 30 * 60 * 1000);

    return privateKey;
  }

  /**
   * 从UI获取密码
   * 
   * 通过事件机制触发密码输入UI，等待用户输入密码
   * 
   * **实现说明**:
   * 1. 通过 CustomEvent 触发 'wallet:request-password' 事件，通知UI组件显示密码输入对话框
   * 2. 监听 'wallet:password-input' 事件接收用户输入的密码
   * 3. 监听 'wallet:password-cancel' 事件处理用户取消操作
   * 4. 30秒超时自动取消，防止无限等待
   * 
   * **使用要求**:
   * - UI组件需要监听 'wallet:request-password' 事件并显示密码输入对话框
   * - 用户输入密码后，UI组件需要触发 'wallet:password-input' 事件并传递密码
   * - 用户取消时，UI组件需要触发 'wallet:password-cancel' 事件
   * 
   * **事件格式**:
   * - wallet:request-password: { detail: { requestId, address, purpose } }
   * - wallet:password-input: { detail: { requestId, password } }
   * - wallet:password-cancel: { detail: { requestId } }
   * 
   * @param ownerAddress 签名者地址
   * @returns 用户输入的密码，如果用户取消或超时返回null
   */
  private async requestPasswordFromUI(ownerAddress: Address): Promise<string | null> {
    return new Promise((resolve) => {
      let timeoutId: number | null = null;
      let settled = false;
      const settle = (value: string | null) => {
        if (settled) return;
        settled = true;
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        window.removeEventListener('wallet:password-input', handlePasswordInput as EventListener);
        window.removeEventListener('wallet:password-cancel', handlePasswordCancel as EventListener);
        resolve(value);
      };

      // 触发密码输入事件
      const requestId = `password_request_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      window.dispatchEvent(
        new CustomEvent('wallet:request-password', {
          detail: {
            requestId,
            address: ownerAddress,
            purpose: 'sign_transaction',
          },
        })
      );

      // 监听密码输入完成事件
      const handlePasswordInput = (event: CustomEvent) => {
        if (event.detail.requestId === requestId) {
          settle(event.detail.password || null);
        }
      };

      const handlePasswordCancel = (event: CustomEvent) => {
        if (event.detail.requestId === requestId) {
          settle(null);
        }
      };

      window.addEventListener('wallet:password-input', handlePasswordInput as EventListener);
      window.addEventListener('wallet:password-cancel', handlePasswordCancel as EventListener);

      // 超时处理（30秒）
      timeoutId = window.setTimeout(() => {
        settle(null);
      }, 30000);
    });
  }

  /**
   * 切换链 (wallet_switchEthereumChain)
   * 
   * 根据 EIP-3326 标准切换链
   * 
   * @param params 链切换参数
   * @returns null (成功时)
   * 
   * @throws {Error} 如果链不存在或切换失败
   */
  private async switchChain(params: { chainId: string }): Promise<null> {
    if (!params.chainId) {
      throw new Error('chainId is required');
    }

    // 解析 chainId
    const chainId = parseInt(params.chainId, 16);
    if (isNaN(chainId) || chainId <= 0) {
      throw new Error('Invalid chainId');
    }

    // 检查链是否存在（内置链或自定义链）
    const chainConfig = getChainConfigByChainId(chainId) || chainService.getCustomChain(chainId);
    
      if (!chainConfig) {
        // 根据 EIP-3326，如果链不存在，应该返回 4902 错误
        const error = Object.assign(
          new Error(
            `Unrecognized chain ID "${chainId}". Try adding the chain using wallet_addEthereumChain first.`
          ),
          { code: 4902 }
        );
        throw error;
      }

    try {
      // 统一按 chainId 切换，避免主网/测试网在同一链枚举下被混淆
      this.accountStore.setCurrentChain(chainId);

      // 触发链切换事件
      this.emit('chainChanged', params.chainId);
      this.emit('accountsChanged', await this.getAccounts());

      return null;
    } catch (error) {
      throw new Error(`Failed to switch chain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 添加链 (wallet_addEthereumChain)
   * 
   * 根据 EIP-3085 标准添加新链
   * 
   * @param params 链配置参数
   * @returns null (成功时)
   * 
   * @throws {Error} 如果参数无效或添加失败
   */
  private async addChain(params: AddEthereumChainParams): Promise<null> {
    try {
      // 使用 ChainService 添加链
      await chainService.addChain(params);

      // 触发链添加事件
      this.emit('chainAdded', params.chainId);

      return null;
    } catch (error) {
      // 根据 EIP-3085，如果链已存在，应该返回特定错误
      if (error instanceof Error && error.message.includes('already exists')) {
        const existingError = Object.assign(new Error('Chain already exists'), { code: 4902 });
        throw existingError;
      }
      throw error;
    }
  }

  /**
   * 事件监听
   */
  on(event: string, handler: ProviderEventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  /**
   * 移除事件监听
   */
  removeListener(event: string, handler: ProviderEventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }
  }

  private parseStringParam(value: unknown, field: string): string {
    if (typeof value !== 'string') {
      throw new Error(`Invalid parameter: ${field} must be a string`);
    }
    return value;
  }

  private parseTransactionParam(value: unknown): SendTransactionParams {
    if (!value || typeof value !== 'object') {
      throw new Error('Invalid parameter: transaction object is required');
    }
    const candidate = value as Partial<SendTransactionParams>;
    if (typeof candidate.to !== 'string' || candidate.to.length === 0) {
      throw new Error('Invalid parameter: transaction.to must be a non-empty string');
    }
    return {
      from: typeof candidate.from === 'string' ? candidate.from : undefined,
      to: candidate.to,
      value: typeof candidate.value === 'string' ? candidate.value : undefined,
      data: typeof candidate.data === 'string' ? candidate.data : undefined,
      gas: typeof candidate.gas === 'string' ? candidate.gas : undefined,
      gasPrice: typeof candidate.gasPrice === 'string' ? candidate.gasPrice : undefined,
    };
  }

  private parseTypedDataParam(value: unknown): TypedData {
    if (!value || typeof value !== 'object') {
      throw new Error('Invalid parameter: typedData must be an object');
    }
    return value as TypedData;
  }

  private parseSwitchChainParam(value: unknown): { chainId: string } {
    if (!value || typeof value !== 'object' || typeof (value as { chainId?: unknown }).chainId !== 'string') {
      throw new Error('Invalid parameter: wallet_switchEthereumChain requires { chainId: string }');
    }
    return { chainId: (value as { chainId: string }).chainId };
  }

  private parseAddChainParam(value: unknown): AddEthereumChainParams {
    if (!value || typeof value !== 'object') {
      throw new Error('Invalid parameter: wallet_addEthereumChain requires an object');
    }
    const candidate = value as Partial<AddEthereumChainParams>;
    if (
      typeof candidate.chainId !== 'string' ||
      typeof candidate.chainName !== 'string' ||
      !candidate.nativeCurrency ||
      typeof candidate.nativeCurrency.name !== 'string' ||
      typeof candidate.nativeCurrency.symbol !== 'string' ||
      typeof candidate.nativeCurrency.decimals !== 'number' ||
      !Array.isArray(candidate.rpcUrls)
    ) {
      throw new Error('Invalid parameter: wallet_addEthereumChain payload is malformed');
    }
    return {
      chainId: candidate.chainId,
      chainName: candidate.chainName,
      nativeCurrency: candidate.nativeCurrency,
      rpcUrls: candidate.rpcUrls.filter((url): url is string => typeof url === 'string'),
      blockExplorerUrls: Array.isArray(candidate.blockExplorerUrls)
        ? candidate.blockExplorerUrls.filter((url): url is string => typeof url === 'string')
        : undefined,
      iconUrls: Array.isArray(candidate.iconUrls)
        ? candidate.iconUrls.filter((url): url is string => typeof url === 'string')
        : undefined,
    };
  }
}

/**
 * Window Provider 适配器
 * 
 * 在 window 对象上注册 Provider
 */
export class WindowProviderAdapter {
  private provider: AnDaoWalletProvider | null = null;

  /**
   * 注册 Provider 到 window 对象
   */
  registerProvider(
    accountStore: AccountStore,
    transactionRelayer: TransactionRelayer,
    accountManager: AccountManager
  ): void {
    this.provider = new AnDaoWalletProvider(
      accountStore,
      transactionRelayer,
      accountManager
    );

    // 注册到 window.ethereum
    if (typeof window !== 'undefined') {
      const walletWindow = window as Window & { ethereum?: EthereumProvider };
      walletWindow.ethereum = this.provider;
      
      // 支持 EIP-6963 钱包发现
      this.registerEIP6963();
    }
  }

  /**
   * 注销 Provider
   */
  unregisterProvider(): void {
    if (typeof window !== 'undefined') {
      const walletWindow = window as Window & { ethereum?: EthereumProvider };
      delete walletWindow.ethereum;
    }
    this.provider = null;
  }

  /**
   * 注册 EIP-6963 钱包发现
   */
  private registerEIP6963(): void {
    if (typeof window === 'undefined') return;

    const event = new CustomEvent('eip6963:announceProvider', {
      detail: {
        info: {
          uuid: 'an-dao-wallet',
          name: 'AnDaoWallet',
          icon: '/icon-192x192.png',
          rdns: 'io.andaowallet',
        },
        provider: this.provider,
      },
    });

    window.dispatchEvent(event);

    // 监听请求事件
    window.addEventListener('eip6963:requestProvider', () => {
      window.dispatchEvent(event);
    });
  }
}
