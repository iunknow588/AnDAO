import type { Address, Hash } from 'viem';
import { encodeFunctionData } from 'viem';
import { storageAdapter } from '@/adapters/StorageAdapter';
import { getChainConfigByChainId } from '@/config/chains';
import { accountStore } from '@/stores';
import { keyManagerService } from '@/services/KeyManagerService';
import { transactionRelayer } from '@/services/TransactionRelayer';
import { StorageKey } from '@/types';
import { rpcClientManager } from '@/utils/RpcClientManager';
import type {
  MingCancelScheduledTaskRequestPayload,
  MingChainExecutionResult,
  MingChainFamily,
  MingCreateScheduledTaskRequestPayload,
  MingGetActiveAccountRequestPayload,
  MingGetScheduledTaskRequestPayload,
  MingGetScheduledTasksByWalletRequestPayload,
  MingMintNFTRequestPayload,
  MingReleaseConnectionRequestPayload,
  MingScheduledTask,
  MingWalletErrorPayload,
  MingWalletResponseEnvelope,
  MingWalletResponsePayload,
} from '@/types/ming';
import type {
  AnDaoWalletSolanaBridge,
  SolanaBridgeExecutionResult,
} from '@/types/solana-bridge';
import {
  isIsoDateString,
  isSupportedUri,
  isValidConsensusHash,
  isValidEvmAddress,
  isValidSolanaAddress,
  normalizeChainFamily,
  PROTOCOL_VERSION,
  validateTiming,
} from '@/services/ming/validation';

const MING_REQUEST_PREFIX = 'MING_WALLET_';
const REQUEST_TIMEOUT_MS = 300_000;
const MAX_RESPONSE_CACHE_SIZE = 500;
const ERC721_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const MESSAGE_TYPE = {
  MINT_NFT_REQUEST: 'MING_WALLET_MINT_NFT_REQUEST',
  CREATE_SCHEDULED_TASK_REQUEST: 'MING_WALLET_CREATE_SCHEDULED_TASK_REQUEST',
  GET_SCHEDULED_TASK_REQUEST: 'MING_WALLET_GET_SCHEDULED_TASK_REQUEST',
  GET_SCHEDULED_TASKS_BY_WALLET_REQUEST:
    'MING_WALLET_GET_SCHEDULED_TASKS_BY_WALLET_REQUEST',
  CANCEL_SCHEDULED_TASK_REQUEST: 'MING_WALLET_CANCEL_SCHEDULED_TASK_REQUEST',
  RELEASE_CONNECTION_NFT_REQUEST: 'MING_WALLET_RELEASE_CONNECTION_NFT_REQUEST',
  GET_ACTIVE_ACCOUNT_REQUEST: 'MING_WALLET_GET_ACTIVE_ACCOUNT_REQUEST',
} as const;

type SupportedMingRequestType =
  (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];

class MingProtocolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'MingProtocolError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function toResponseType(requestType: string): string {
  return requestType.replace(/_REQUEST$/, '_RESPONSE');
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new MingProtocolError(
          'NETWORK_ERROR',
          `Wallet processing timeout (${timeoutMs}ms)`
        )
      );
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export class MingWalletBridgeService {
  private initialized = false;
  private readonly debugEnabled =
    import.meta.env.VITE_MING_BRIDGE_DEBUG === 'true' ||
    import.meta.env.VITE_MING_BRIDGE_DEBUG === '1';
  private readonly tasks = new Map<string, MingScheduledTask>();
  private readonly taskTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly responseCache = new Map<string, MingWalletResponseEnvelope>();

  private readonly handleMessage = (event: MessageEvent): void => {
    void this.onMessage(event);
  };

  private debug(message: string, context?: Record<string, unknown>): void {
    if (!this.debugEnabled) {
      return;
    }
    if (context) {
      console.debug(`[MingWalletBridgeService] ${message}`, context);
      return;
    }
    console.debug(`[MingWalletBridgeService] ${message}`);
  }

  async init(): Promise<void> {
    if (this.initialized || typeof window === 'undefined') {
      return;
    }

    await this.loadTasks();
    await this.recoverAndSchedulePendingTasks();
    window.addEventListener('message', this.handleMessage);
    this.initialized = true;
  }

  destroy(): void {
    if (!this.initialized || typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('message', this.handleMessage);
    this.taskTimers.forEach((timer) => clearTimeout(timer));
    this.taskTimers.clear();
    this.initialized = false;
  }

  private async onMessage(event: MessageEvent): Promise<void> {
    const data = event.data as unknown;
    if (!isObject(data)) {
      return;
    }

    const type = typeof data.type === 'string' ? data.type : '';
    if (!type.startsWith(MING_REQUEST_PREFIX) || !type.endsWith('_REQUEST')) {
      return;
    }

    if (!this.isOriginAllowed(event.origin)) {
      this.debug('reject request: origin not allowed', {
        type,
        origin: event.origin,
      });
      return;
    }

    const messageId = typeof data.messageId === 'string' ? data.messageId : '';
    if (!messageId) {
      this.debug('ignore request: missing messageId', { type, origin: event.origin });
      return;
    }
    this.debug('receive request', { type, messageId, origin: event.origin });

    const cached = this.responseCache.get(messageId);
    if (cached) {
      this.debug('reuse cached response', { type, messageId });
      this.postResponse(event, cached);
      return;
    }

    const responseType = toResponseType(type);
    let responsePayload: MingWalletResponsePayload;

    try {
      const result = await withTimeout(
        this.dispatchRequest(type as SupportedMingRequestType, data),
        REQUEST_TIMEOUT_MS
      );
      responsePayload = {
        success: true,
        data: result,
      };
    } catch (error) {
      responsePayload = {
        success: false,
        error: this.toErrorPayload(error),
      };
    }

    const envelope: MingWalletResponseEnvelope = {
      type: responseType,
      messageId,
      payload: responsePayload,
    };

    this.cacheResponse(messageId, envelope);
    this.postResponse(event, envelope);
    this.debug('response posted', {
      responseType,
      messageId,
      success: responsePayload.success === true,
      origin: event.origin,
    });
  }

  private async dispatchRequest(
    requestType: SupportedMingRequestType,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const payload = data.payload;

    switch (requestType) {
      case MESSAGE_TYPE.MINT_NFT_REQUEST:
        return this.handleMintNFT(
          this.asPayload<MingMintNFTRequestPayload>(payload)
        );
      case MESSAGE_TYPE.CREATE_SCHEDULED_TASK_REQUEST:
        return this.handleCreateScheduledTask(
          this.asPayload<MingCreateScheduledTaskRequestPayload>(payload)
        );
      case MESSAGE_TYPE.GET_SCHEDULED_TASK_REQUEST:
        return this.handleGetScheduledTask(
          this.asPayload<MingGetScheduledTaskRequestPayload>(payload)
        );
      case MESSAGE_TYPE.GET_SCHEDULED_TASKS_BY_WALLET_REQUEST:
        return this.handleGetScheduledTasksByWallet(
          this.asPayload<MingGetScheduledTasksByWalletRequestPayload>(payload)
        );
      case MESSAGE_TYPE.CANCEL_SCHEDULED_TASK_REQUEST:
        return this.handleCancelScheduledTask(
          this.asPayload<MingCancelScheduledTaskRequestPayload>(payload)
        );
      case MESSAGE_TYPE.RELEASE_CONNECTION_NFT_REQUEST:
        return this.handleReleaseConnectionNFT(
          this.asPayload<MingReleaseConnectionRequestPayload>(payload)
        );
      case MESSAGE_TYPE.GET_ACTIVE_ACCOUNT_REQUEST:
        return this.handleGetActiveAccount(
          this.asPayload<MingGetActiveAccountRequestPayload>(payload)
        );
      default:
        throw new MingProtocolError(
          'INVALID_PARAMS',
          `Unsupported Ming request type: ${requestType}`
        );
    }
  }

  private asPayload<T>(value: unknown): T {
    if (!isObject(value)) {
      throw new MingProtocolError('INVALID_PARAMS', 'payload must be an object');
    }
    return value as T;
  }

  private async handleMintNFT(
    payload: MingMintNFTRequestPayload
  ): Promise<Record<string, unknown>> {
    const chainFamily = this.validateMintPayload(payload, 'mint');

    if (payload.timing.strategy === 'scheduled') {
      const task = await this.createScheduledTask(payload, payload.timing.executeAt);
      return {
        taskId: task.taskId,
        status: task.status,
        scheduledTime: task.scheduledTime,
      };
    }

    const result = await this.executeMint(payload, chainFamily);
    return {
      tokenId: result.tokenId,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      timestamp: result.timestamp,
    };
  }

  private async handleCreateScheduledTask(
    payload: MingCreateScheduledTaskRequestPayload
  ): Promise<Record<string, unknown>> {
    const chainFamily = this.validateMintPayload(payload, 'scheduled');
    if (!isIsoDateString(payload.scheduledTime)) {
      throw new MingProtocolError(
        'INVALID_SCHEDULED_TIME',
        'scheduledTime must be a valid ISO timestamp'
      );
    }

    if (payload.scheduledTime !== payload.timing.executeAt) {
      throw new MingProtocolError(
        'INVALID_PARAMS',
        'timing.executeAt must be equal to scheduledTime'
      );
    }

    const executeAt = Date.parse(payload.scheduledTime);
    if (executeAt <= Date.now()) {
      throw new MingProtocolError(
        'INVALID_SCHEDULED_TIME',
        'scheduledTime must be in the future'
      );
    }

    const task = await this.createScheduledTask(payload, payload.scheduledTime);
    if (chainFamily === 'solana' && !task.walletAddress) {
      // Keep an explicit warning-friendly marker for downstream debugging.
      task.walletAddress = payload.params.to;
      await this.persistTasks();
    }

    return { taskId: task.taskId };
  }

  private async handleGetScheduledTask(
    payload: MingGetScheduledTaskRequestPayload
  ): Promise<Record<string, unknown>> {
    if (!payload.taskId) {
      throw new MingProtocolError('MISSING_REQUIRED_FIELD', 'taskId is required');
    }

    const task = this.tasks.get(payload.taskId);
    if (!task) {
      throw new MingProtocolError('TASK_NOT_FOUND', `Task not found: ${payload.taskId}`);
    }

    return this.toTaskResponse(task);
  }

  private async handleGetScheduledTasksByWallet(
    payload: MingGetScheduledTasksByWalletRequestPayload
  ): Promise<Record<string, unknown>> {
    this.assertProtocolVersion(payload.protocolVersion);
    if (!payload.walletAddress) {
      throw new MingProtocolError(
        'MISSING_REQUIRED_FIELD',
        'walletAddress is required'
      );
    }

    const target = payload.walletAddress.toLowerCase();
    const tasks = Array.from(this.tasks.values())
      .filter((task) => (task.walletAddress || '').toLowerCase() === target)
      .map((task) => this.toTaskResponse(task));

    return { tasks };
  }

  private async handleCancelScheduledTask(
    payload: MingCancelScheduledTaskRequestPayload
  ): Promise<Record<string, unknown>> {
    this.assertProtocolVersion(payload.protocolVersion);
    if (!payload.taskId) {
      throw new MingProtocolError('MISSING_REQUIRED_FIELD', 'taskId is required');
    }

    const task = this.tasks.get(payload.taskId);
    if (!task) {
      throw new MingProtocolError('TASK_NOT_FOUND', `Task not found: ${payload.taskId}`);
    }

    if (task.status === 'completed' || task.status === 'failed') {
      throw new MingProtocolError(
        'TASK_ALREADY_EXECUTED',
        `Task is already ${task.status}`
      );
    }

    const timer = this.taskTimers.get(task.taskId);
    if (timer) {
      clearTimeout(timer);
      this.taskTimers.delete(task.taskId);
    }

    task.status = 'cancelled';
    await this.persistTasks();

    return {
      taskId: task.taskId,
      cancelled: true,
    };
  }

  private async handleGetActiveAccount(
    payload: MingGetActiveAccountRequestPayload
  ): Promise<Record<string, unknown>> {
    this.assertProtocolVersion(payload.protocolVersion);
    await accountStore.waitUntilReady();

    const requestedFamily: MingChainFamily =
      payload.chainFamily === 'solana' ||
      (!!payload.network && payload.network.toLowerCase().includes('solana'))
        ? 'solana'
        : 'evm';

    if (requestedFamily === 'solana') {
      const network = payload.network || this.getDefaultSolanaNetwork();
      if (!network) {
        throw new MingProtocolError(
          'CHAIN_NOT_SUPPORTED',
          'Solana network is required for chainFamily=solana'
        );
      }

      const bridge = this.requireSolanaBridge();
      const walletAddress = await this.getSolanaWalletAddress(bridge, network);
      if (!walletAddress) {
        throw new MingProtocolError(
          'WALLET_NOT_CONNECTED',
          `No active Solana wallet is available for network ${network}`
        );
      }

      return {
        walletAddress,
        chainFamily: 'solana',
        chainId: 0,
        network,
        status: 'connected',
      };
    }

    const requestedChainId =
      Number.isInteger(payload.chainId) && Number(payload.chainId) > 0
        ? Number(payload.chainId)
        : undefined;

    const account =
      (requestedChainId ? accountStore.getAccount(requestedChainId) : null) ||
      accountStore.currentAccount ||
      accountStore.accounts[0] ||
      null;

    if (!account) {
      throw new MingProtocolError(
        'WALLET_NOT_CONNECTED',
        'No active EVM wallet account is available'
      );
    }

    const chainConfig = getChainConfigByChainId(account.chainId);
    return {
      walletAddress: account.address,
      chainFamily: 'evm',
      chainId: account.chainId,
      network: this.toNetworkIdentifier(chainConfig?.name),
      status: 'connected',
    };
  }

  private async handleReleaseConnectionNFT(
    payload: MingReleaseConnectionRequestPayload
  ): Promise<Record<string, unknown>> {
    this.assertProtocolVersion(payload.protocolVersion);

    if (!payload.contract || !payload.params) {
      throw new MingProtocolError(
        'MISSING_REQUIRED_FIELD',
        'contract and params are required'
      );
    }

    if (!payload.params.tokenId) {
      throw new MingProtocolError('MISSING_REQUIRED_FIELD', 'params.tokenId is required');
    }

    if (!isSupportedUri(payload.params.releasedTokenURI)) {
      throw new MingProtocolError(
        'INVALID_PARAMS',
        'params.releasedTokenURI must use ipfs:// or https://'
      );
    }

    const chainFamily = normalizeChainFamily(payload.contract);
    this.assertContractAddress(payload.contract.address, chainFamily);
    this.assertChainConsistency(payload.contract, chainFamily);

    const result =
      chainFamily === 'evm'
        ? await this.executeReleaseOnEvm(payload)
        : await this.executeReleaseOnSolana(payload);

    return {
      tokenId: result.tokenId,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      releasedTokenURI: payload.params.releasedTokenURI,
      timestamp: result.timestamp,
    };
  }

  private validateMintPayload(
    payload: MingMintNFTRequestPayload,
    mode: 'mint' | 'scheduled'
  ): MingChainFamily {
    this.assertProtocolVersion(payload.protocolVersion);

    if (!payload.contract || !payload.params || !payload.timing) {
      throw new MingProtocolError(
        'MISSING_REQUIRED_FIELD',
        'contract, params and timing are required'
      );
    }
    const chainFamily = normalizeChainFamily(payload.contract);

    this.assertConsensusHash(payload.consensusHash, payload.params.consensusHash);
    this.assertContractAddress(payload.contract.address, chainFamily);
    this.assertRecipientAddress(payload.params.to, chainFamily);
    this.assertChainConsistency(payload.contract, chainFamily);

    if (!payload.params.externalObjectId || !payload.params.element) {
      throw new MingProtocolError(
        'MISSING_REQUIRED_FIELD',
        'params.externalObjectId and params.element are required'
      );
    }

    if (!isSupportedUri(payload.params.tokenURI)) {
      throw new MingProtocolError(
        'INVALID_PARAMS',
        'params.tokenURI must use ipfs:// or https://'
      );
    }

    const { executeAt } = validateTiming(payload.timing, mode);
    if (payload.timing.strategy === 'scheduled' && executeAt <= Date.now()) {
      throw new MingProtocolError(
        'INVALID_SCHEDULED_TIME',
        'timing.executeAt must be in the future'
      );
    }

    return chainFamily;
  }

  private async executeMint(
    payload: MingMintNFTRequestPayload,
    chainFamily: MingChainFamily
  ): Promise<MingChainExecutionResult> {
    if (chainFamily === 'evm') {
      return this.executeMintOnEvm(payload);
    }
    return this.executeMintOnSolana(payload);
  }

  private async createScheduledTask(
    payload: MingMintNFTRequestPayload,
    scheduledTime: string
  ): Promise<MingScheduledTask> {
    const chainFamily = normalizeChainFamily(payload.contract);
    const walletAddress = await this.resolveWalletAddressForTask(payload, chainFamily);
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const task: MingScheduledTask = {
      taskId,
      status: 'pending',
      scheduledTime,
      walletAddress,
      request: payload,
      createdAt: new Date().toISOString(),
    };

    this.tasks.set(taskId, task);
    await this.persistTasks();
    this.scheduleTask(task);
    return task;
  }

  private scheduleTask(task: MingScheduledTask): void {
    if (
      task.status === 'completed' ||
      task.status === 'failed' ||
      task.status === 'cancelled'
    ) {
      return;
    }

    const existing = this.taskTimers.get(task.taskId);
    if (existing) {
      clearTimeout(existing);
    }

    const delayMs = Math.max(0, Date.parse(task.scheduledTime) - Date.now());
    const timer = setTimeout(() => {
      void this.executeScheduledTask(task.taskId);
    }, delayMs);

    this.taskTimers.set(task.taskId, timer);
  }

  private async executeScheduledTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') {
      return;
    }

    task.status = 'executing';
    await this.persistTasks();

    try {
      const chainFamily = normalizeChainFamily(task.request.contract);
      const result = await this.executeMint(task.request, chainFamily);
      task.status = 'completed';
      task.mintedAt = new Date().toISOString();
      task.result = {
        tokenId: result.tokenId,
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        timestamp: result.timestamp,
      };
    } catch (error) {
      task.status = 'failed';
      task.result = {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error when executing scheduled mint',
      };
    } finally {
      this.taskTimers.delete(task.taskId);
      await this.persistTasks();
    }
  }

  private async executeMintOnEvm(
    payload: MingMintNFTRequestPayload
  ): Promise<MingChainExecutionResult> {
    const chainId = payload.contract.chainId;
    const context = await this.getEvmExecutionContext(chainId);

    const callData = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'mintConnection',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'tokenURI', type: 'string' },
            { name: 'externalObjectId', type: 'string' },
            { name: 'element', type: 'string' },
            { name: 'consensusHash', type: 'bytes32' },
          ],
          outputs: [],
        },
      ],
      functionName: 'mintConnection',
      args: [
        payload.params.to as Address,
        payload.params.tokenURI,
        payload.params.externalObjectId,
        payload.params.element,
        payload.params.consensusHash as `0x${string}`,
      ],
    });

    const txHash = await transactionRelayer.sendTransaction(
      context.accountAddress,
      chainId,
      payload.contract.address as Address,
      callData,
      context.ownerPrivateKey
    );

    const receiptMeta = await this.tryGetReceiptMeta(chainId, txHash);
    const tokenId = receiptMeta?.tokenId || txHash;

    return {
      tokenId,
      txHash,
      blockNumber: receiptMeta?.blockNumber ?? 0,
      timestamp: receiptMeta?.timestamp,
      walletAddress: context.walletAddress,
    };
  }

  private async executeReleaseOnEvm(
    payload: MingReleaseConnectionRequestPayload
  ): Promise<MingChainExecutionResult> {
    const chainId = payload.contract.chainId;
    const context = await this.getEvmExecutionContext(chainId);
    const tokenId = this.parseEvmTokenId(payload.params.tokenId);

    const callData = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'releaseConnection',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'tokenId', type: 'uint256' },
            { name: 'releasedTokenURI', type: 'string' },
            { name: 'removePrivateData', type: 'bool' },
          ],
          outputs: [],
        },
      ],
      functionName: 'releaseConnection',
      args: [
        tokenId,
        payload.params.releasedTokenURI,
        !!payload.params.removePrivateData,
      ],
    });

    const txHash = await transactionRelayer.sendTransaction(
      context.accountAddress,
      chainId,
      payload.contract.address as Address,
      callData,
      context.ownerPrivateKey
    );

    const receiptMeta = await this.tryGetReceiptMeta(chainId, txHash);
    return {
      tokenId: tokenId.toString(),
      txHash,
      blockNumber: receiptMeta?.blockNumber ?? 0,
      timestamp: receiptMeta?.timestamp,
      walletAddress: context.walletAddress,
    };
  }

  private async executeMintOnSolana(
    payload: MingMintNFTRequestPayload
  ): Promise<MingChainExecutionResult> {
    const bridge = this.requireSolanaBridge();
    const network = payload.contract.network || this.getDefaultSolanaNetwork();
    if (!network) {
      throw new MingProtocolError(
        'CHAIN_NOT_SUPPORTED',
        'Solana network is required for chainFamily=solana'
      );
    }

    const result = await bridge.mintConnectionNFT({
      programId: payload.contract.address,
      network,
      recipient: payload.params.to,
      tokenURI: payload.params.tokenURI,
      externalObjectId: payload.params.externalObjectId,
      element: payload.params.element,
      consensusHash: payload.params.consensusHash,
    });

    const txHash = result.txHash || result.signature;
    if (!txHash) {
      throw new MingProtocolError(
        'CONTRACT_CALL_FAILED',
        'Solana bridge did not return txHash/signature'
      );
    }

    const tokenId = this.pickSolanaTokenId(result);
    const walletAddress =
      result.walletAddress || (await this.getSolanaWalletAddress(bridge, network));

    return {
      tokenId,
      txHash,
      blockNumber: result.blockNumber ?? result.slot ?? 0,
      timestamp: result.timestamp,
      walletAddress,
    };
  }

  private async executeReleaseOnSolana(
    payload: MingReleaseConnectionRequestPayload
  ): Promise<MingChainExecutionResult> {
    const bridge = this.requireSolanaBridge();
    const network = payload.contract.network || this.getDefaultSolanaNetwork();
    if (!network) {
      throw new MingProtocolError(
        'CHAIN_NOT_SUPPORTED',
        'Solana network is required for chainFamily=solana'
      );
    }

    const result = await bridge.releaseConnectionNFT({
      programId: payload.contract.address,
      network,
      tokenId: payload.params.tokenId,
      releasedTokenURI: payload.params.releasedTokenURI,
      removePrivateData: payload.params.removePrivateData,
    });

    const txHash = result.txHash || result.signature;
    if (!txHash) {
      throw new MingProtocolError(
        'CONTRACT_CALL_FAILED',
        'Solana bridge did not return txHash/signature'
      );
    }

    const walletAddress =
      result.walletAddress || (await this.getSolanaWalletAddress(bridge, network));

    return {
      tokenId: result.tokenId || payload.params.tokenId,
      txHash,
      blockNumber: result.blockNumber ?? result.slot ?? 0,
      timestamp: result.timestamp,
      walletAddress,
    };
  }

  private requireSolanaBridge(): AnDaoWalletSolanaBridge {
    if (typeof window === 'undefined') {
      throw new MingProtocolError(
        'CHAIN_NOT_SUPPORTED',
        'Solana executor is not configured in AnDaoWallet'
      );
    }

    const bridge = (window as Window & {
      anDaoWalletSolanaBridge?: AnDaoWalletSolanaBridge;
    }).anDaoWalletSolanaBridge;
    if (!bridge) {
      throw new MingProtocolError(
        'CHAIN_NOT_SUPPORTED',
        'Solana executor is not configured in AnDaoWallet'
      );
    }
    return bridge;
  }

  private async getSolanaWalletAddress(
    bridge: AnDaoWalletSolanaBridge,
    network: string
  ): Promise<string | undefined> {
    if (!bridge.getCurrentWalletAddress) {
      return undefined;
    }
    return bridge.getCurrentWalletAddress(network);
  }

  private pickSolanaTokenId(result: SolanaBridgeExecutionResult): string {
    if (result.tokenId) {
      return result.tokenId;
    }
    if (result.connectionId !== undefined && result.connectionId !== null) {
      return `connection:${String(result.connectionId)}`;
    }
    if (result.mintAddress) {
      return result.mintAddress;
    }
    return result.txHash || result.signature || 'solana-token-id-unknown';
  }

  private async getEvmExecutionContext(chainId: number): Promise<{
    accountAddress: Address;
    ownerPrivateKey: `0x${string}`;
    walletAddress: string;
  }> {
    const account = accountStore.getAccount(chainId);
    if (!account) {
      throw new MingProtocolError(
        'WALLET_NOT_CONNECTED',
        `No wallet account found for chainId ${chainId}`
      );
    }

    const ownerPrivateKey = await keyManagerService.getPrivateKeyFromSession(
      account.owner as Address
    );
    if (!ownerPrivateKey) {
      throw new MingProtocolError(
        'WALLET_NOT_CONNECTED',
        'Private key is not available in session. Please unlock wallet first.'
      );
    }

    return {
      accountAddress: account.address as Address,
      ownerPrivateKey: ownerPrivateKey as `0x${string}`,
      walletAddress: account.address,
    };
  }

  private async resolveWalletAddressForTask(
    payload: MingMintNFTRequestPayload,
    chainFamily: MingChainFamily
  ): Promise<string> {
    if (chainFamily === 'evm') {
      const account = accountStore.getAccount(payload.contract.chainId);
      return account?.address || payload.params.to;
    }

    try {
      const bridge = this.requireSolanaBridge();
      const network = payload.contract.network || this.getDefaultSolanaNetwork();
      if (network) {
        const walletAddress = await this.getSolanaWalletAddress(bridge, network);
        if (walletAddress) {
          return walletAddress;
        }
      }
    } catch (_error) {
      // Fall back to recipient when Solana bridge is not ready.
    }

    return payload.params.to;
  }

  private parseEvmTokenId(raw: string): bigint {
    const normalized = raw.startsWith('connection:') ? raw.slice('connection:'.length) : raw;
    if (!/^\d+$/.test(normalized)) {
      throw new MingProtocolError(
        'INVALID_PARAMS',
        'EVM tokenId must be a decimal string'
      );
    }
    return BigInt(normalized);
  }

  private async tryGetReceiptMeta(
    chainId: number,
    txHash: Hash
  ): Promise<{ blockNumber: number; timestamp?: number; tokenId?: string } | null> {
    try {
      const publicClient = rpcClientManager.getPublicClient(chainId);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 120_000,
      });

      let timestamp: number | undefined;
      try {
        const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
        timestamp = Number(block.timestamp);
      } catch (_error) {
        timestamp = undefined;
      }

      return {
        blockNumber: Number(receipt.blockNumber),
        timestamp,
        tokenId: this.extractTokenIdFromLogs(receipt.logs),
      };
    } catch (_error) {
      return null;
    }
  }

  private extractTokenIdFromLogs(
    logs: ReadonlyArray<{ topics: readonly `0x${string}`[] }>
  ): string | undefined {
    for (const log of logs) {
      const topic0 = log.topics[0];
      const topic3 = log.topics[3];
      if (
        topic0 &&
        topic3 &&
        topic0.toLowerCase() === ERC721_TRANSFER_TOPIC.toLowerCase()
      ) {
        try {
          return BigInt(topic3).toString();
        } catch (_error) {
          continue;
        }
      }
    }
    return undefined;
  }

  private assertProtocolVersion(protocolVersion: string): void {
    if (!protocolVersion) {
      throw new MingProtocolError(
        'MISSING_REQUIRED_FIELD',
        'protocolVersion is required'
      );
    }
    if (protocolVersion !== PROTOCOL_VERSION) {
      throw new MingProtocolError(
        'INVALID_PARAMS',
        `protocolVersion must be ${PROTOCOL_VERSION}`
      );
    }
  }

  private assertConsensusHash(base: string, nested: string): void {
    if (!isValidConsensusHash(base)) {
      throw new MingProtocolError(
        'INVALID_PARAMS',
        'consensusHash must be 0x-prefixed 32-byte hex'
      );
    }
    if (!isValidConsensusHash(nested)) {
      throw new MingProtocolError(
        'INVALID_PARAMS',
        'params.consensusHash must be 0x-prefixed 32-byte hex'
      );
    }
    if (base.toLowerCase() !== nested.toLowerCase()) {
      throw new MingProtocolError(
        'INVALID_PARAMS',
        'payload.consensusHash must match params.consensusHash'
      );
    }
  }

  private assertContractAddress(address: string, chainFamily: MingChainFamily): void {
    if (!address) {
      throw new MingProtocolError(
        'MISSING_REQUIRED_FIELD',
        'contract.address is required'
      );
    }

    if (chainFamily === 'evm' && !isValidEvmAddress(address)) {
      throw new MingProtocolError(
        'INVALID_PARAMS',
        'contract.address must be a valid EVM address'
      );
    }

    if (chainFamily === 'solana' && !isValidSolanaAddress(address)) {
      throw new MingProtocolError(
        'INVALID_PARAMS',
        'contract.address must be a valid Solana address'
      );
    }
  }

  private assertRecipientAddress(address: string, chainFamily: MingChainFamily): void {
    if (!address) {
      throw new MingProtocolError('MISSING_REQUIRED_FIELD', 'params.to is required');
    }

    if (chainFamily === 'evm' && !isValidEvmAddress(address)) {
      throw new MingProtocolError('INVALID_PARAMS', 'params.to must be a valid EVM address');
    }

    if (chainFamily === 'solana' && !isValidSolanaAddress(address)) {
      throw new MingProtocolError(
        'INVALID_PARAMS',
        'params.to must be a valid Solana address'
      );
    }
  }

  private assertChainConsistency(
    contract: { chainId: number; network?: string },
    chainFamily: MingChainFamily
  ): void {
    if (chainFamily === 'evm') {
      if (!Number.isInteger(contract.chainId) || contract.chainId <= 0) {
        throw new MingProtocolError(
          'INVALID_PARAMS',
          'contract.chainId must be a positive integer for EVM'
        );
      }

      if (accountStore.currentChainId && accountStore.currentChainId !== contract.chainId) {
        throw new MingProtocolError(
          'CHAIN_NOT_SUPPORTED',
          `Current wallet chain (${accountStore.currentChainId}) does not match contract.chainId (${contract.chainId})`
        );
      }
      return;
    }

    const requestedNetwork = contract.network;
    if (!requestedNetwork) {
      throw new MingProtocolError(
        'CHAIN_NOT_SUPPORTED',
        'contract.network is required for chainFamily=solana'
      );
    }

    const walletNetwork = this.getDefaultSolanaNetwork();
    if (walletNetwork && walletNetwork !== requestedNetwork) {
      throw new MingProtocolError(
        'CHAIN_NOT_SUPPORTED',
        `Solana network mismatch: expected ${walletNetwork}, got ${requestedNetwork}`
      );
    }
  }

  private getDefaultSolanaNetwork(): string | undefined {
    const network = import.meta.env.VITE_SOLANA_NETWORK;
    return network && network.trim() ? network.trim() : undefined;
  }

  private toNetworkIdentifier(name?: string): string | undefined {
    if (!name) {
      return undefined;
    }
    return name.trim().toLowerCase().replace(/\s+/g, '-');
  }

  private toTaskResponse(task: MingScheduledTask): Record<string, unknown> {
    return {
      taskId: task.taskId,
      status: task.status,
      scheduledTime: task.scheduledTime,
      walletAddress: task.walletAddress,
      createdAt: task.createdAt,
      mintedAt: task.mintedAt,
      result: task.result,
    };
  }

  private cacheResponse(messageId: string, envelope: MingWalletResponseEnvelope): void {
    this.responseCache.set(messageId, envelope);
    if (this.responseCache.size <= MAX_RESPONSE_CACHE_SIZE) {
      return;
    }
    const oldestKey = this.responseCache.keys().next().value;
    if (oldestKey) {
      this.responseCache.delete(oldestKey);
    }
  }

  private postResponse(event: MessageEvent, envelope: MingWalletResponseEnvelope): void {
    const targetOrigin =
      event.origin && event.origin !== 'null' ? event.origin : '*';

    if (event.source && typeof (event.source as Window).postMessage === 'function') {
      this.debug('post response to event.source', {
        type: envelope.type,
        messageId: envelope.messageId,
        targetOrigin,
      });
      (event.source as Window).postMessage(envelope, targetOrigin);
      return;
    }

    this.debug('post response to window fallback', {
      type: envelope.type,
      messageId: envelope.messageId,
      targetOrigin,
    });
    window.postMessage(envelope, targetOrigin);
  }

  private toErrorPayload(error: unknown): MingWalletErrorPayload {
    if (error instanceof MingProtocolError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details,
      };
    }

    if (error instanceof Error) {
      const lowered = error.message.toLowerCase();
      if (lowered.includes('reject')) {
        return { code: 'TRANSACTION_REJECTED', message: error.message };
      }
      return { code: 'CONTRACT_CALL_FAILED', message: error.message };
    }

    return {
      code: 'NETWORK_ERROR',
      message: 'Unknown wallet error',
    };
  }

  private isOriginAllowed(origin: string): boolean {
    const configured = import.meta.env.VITE_MING_ALLOWED_ORIGINS;
    if (!configured || !configured.trim()) {
      return true;
    }

    const allowed = configured
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    return allowed.includes(origin);
  }

  private async loadTasks(): Promise<void> {
    const stored = await storageAdapter.get<MingScheduledTask[]>(
      StorageKey.MING_SCHEDULED_TASKS
    );

    this.tasks.clear();
    if (!stored) {
      return;
    }

    for (const task of stored) {
      this.tasks.set(task.taskId, task);
    }
  }

  private async recoverAndSchedulePendingTasks(): Promise<void> {
    let mutated = false;
    for (const task of this.tasks.values()) {
      if (task.status === 'executing') {
        task.status = 'pending';
        mutated = true;
      }
      if (task.status === 'pending') {
        this.scheduleTask(task);
      }
    }

    if (mutated) {
      await this.persistTasks();
    }
  }

  private async persistTasks(): Promise<void> {
    await storageAdapter.set(
      StorageKey.MING_SCHEDULED_TASKS,
      Array.from(this.tasks.values())
    );
  }
}

export const mingWalletBridgeService = new MingWalletBridgeService();
