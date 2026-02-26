import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address } from 'viem';

vi.mock('@/adapters/StorageAdapter', () => ({
  storageAdapter: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@/stores', () => ({
  accountStore: {
    currentChainId: 11155111,
    currentAccount: null,
    accounts: [],
    waitUntilReady: vi.fn(),
    getAccount: vi.fn(),
  },
}));

vi.mock('@/services/KeyManagerService', () => ({
  keyManagerService: {
    getPrivateKeyFromSession: vi.fn(),
  },
}));

vi.mock('@/services/TransactionRelayer', () => ({
  transactionRelayer: {
    sendTransaction: vi.fn(),
  },
}));

vi.mock('@/utils/RpcClientManager', () => ({
  rpcClientManager: {
    getPublicClient: vi.fn(),
  },
}));

import { storageAdapter } from '@/adapters/StorageAdapter';
import { accountStore } from '@/stores';
import { keyManagerService } from '@/services/KeyManagerService';
import { transactionRelayer } from '@/services/TransactionRelayer';
import { rpcClientManager } from '@/utils/RpcClientManager';
import { MingWalletBridgeService } from '@/services/MingWalletBridgeService';

const TEST_ACCOUNT = {
  address: '0x1111111111111111111111111111111111111111',
  owner: '0x2222222222222222222222222222222222222222',
  chainId: 11155111,
};

const TEST_PRIVATE_KEY =
  '0x1234567890123456789012345678901234567890123456789012345678901234' as const;

const BASE_PAYLOAD = {
  protocolVersion: '1.0.0',
  timing: {
    requestedAt: new Date().toISOString(),
    executeAt: new Date(Date.now() + 60_000).toISOString(),
    strategy: 'immediate' as const,
    timezone: 'Asia/Shanghai',
  },
  consensusHash:
    '0x1111111111111111111111111111111111111111111111111111111111111111',
  contract: {
    address: '0x3333333333333333333333333333333333333333' as Address,
    chainId: 11155111,
    chainFamily: 'evm' as const,
    network: 'sepolia',
  },
  params: {
    to: '0x4444444444444444444444444444444444444444' as Address,
    tokenURI: 'ipfs://QmMetadataHash',
    externalObjectId: 'wood_forest',
    element: '木',
    consensusHash:
      '0x1111111111111111111111111111111111111111111111111111111111111111',
  },
};

type BridgeResponse = {
  type: string;
  messageId: string;
  payload: {
    success: boolean;
    data?: Record<string, unknown>;
    error?: { code: string; message: string };
  };
};

function waitForResponse(messageId: string): Promise<BridgeResponse> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data &&
        event.data.messageId === messageId &&
        typeof event.data.type === 'string' &&
        event.data.type.endsWith('_RESPONSE')
      ) {
        window.removeEventListener('message', handler);
        resolve(event.data as BridgeResponse);
      }
    };
    window.addEventListener('message', handler);
  });
}

function waitForNoResponse(messageId: string, timeoutMs = 80): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(true);
    }, timeoutMs);

    const handler = (event: MessageEvent) => {
      if (
        event.data &&
        event.data.messageId === messageId &&
        typeof event.data.type === 'string' &&
        event.data.type.endsWith('_RESPONSE')
      ) {
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        resolve(false);
      }
    };

    window.addEventListener('message', handler);
  });
}

async function sendRequest(
  message: Record<string, unknown>
): Promise<BridgeResponse> {
  const responsePromise = waitForResponse(message.messageId as string);
  window.postMessage(message, '*');
  return responsePromise;
}

describe('MingWalletBridgeService', () => {
  let service: MingWalletBridgeService | null = null;

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as Window & { anDaoWalletSolanaBridge?: unknown }).anDaoWalletSolanaBridge;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service?.destroy();
    service = new MingWalletBridgeService();

    vi.mocked(storageAdapter.get).mockResolvedValue(null);
    vi.mocked(storageAdapter.set).mockResolvedValue();

    vi.mocked(accountStore.getAccount).mockReturnValue(TEST_ACCOUNT as never);
    vi.mocked(accountStore.waitUntilReady).mockResolvedValue();
    (accountStore as { currentAccount: unknown }).currentAccount =
      TEST_ACCOUNT as unknown;
    (accountStore as { accounts: unknown[] }).accounts = [
      TEST_ACCOUNT as unknown,
    ];
    (accountStore as { currentChainId: number }).currentChainId = 11155111;
    vi.mocked(keyManagerService.getPrivateKeyFromSession).mockResolvedValue(
      TEST_PRIVATE_KEY
    );
    vi.mocked(transactionRelayer.sendTransaction).mockResolvedValue(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    vi.mocked(rpcClientManager.getPublicClient).mockReturnValue({
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        blockNumber: 123n,
        logs: [],
      }),
      getBlock: vi.fn().mockResolvedValue({
        timestamp: 1700000000n,
      }),
    } as never);
  });

  it('handles MINT_NFT immediate request on evm', async () => {
    await service!.init();

    const response = await sendRequest({
      type: 'MING_WALLET_MINT_NFT_REQUEST',
      messageId: 'msg_mint_001',
      payload: BASE_PAYLOAD,
    });

    expect(response.type).toBe('MING_WALLET_MINT_NFT_RESPONSE');
    expect(response.payload.success).toBe(true);
    expect(response.payload.data.txHash).toBe(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    expect(transactionRelayer.sendTransaction).toHaveBeenCalledTimes(1);
  });

  it('handles scheduled task lifecycle: create -> get -> cancel', async () => {
    await service!.init();

    const scheduledPayload = {
      ...BASE_PAYLOAD,
      scheduledTime: (() => {
        const scheduledAt = new Date(Date.now() + 5 * 60_000).toISOString();
        return scheduledAt;
      })(),
      timing: {
        ...BASE_PAYLOAD.timing,
        executeAt: '',
        strategy: 'scheduled' as const,
      },
    };
    scheduledPayload.timing.executeAt = scheduledPayload.scheduledTime;

    const createResponse = await sendRequest({
      type: 'MING_WALLET_CREATE_SCHEDULED_TASK_REQUEST',
      messageId: 'msg_task_create_001',
      payload: scheduledPayload,
    });

    expect(createResponse.payload.success).toBe(true);
    const taskId = createResponse.payload.data.taskId as string;
    expect(taskId).toBeTruthy();

    const getResponse = await sendRequest({
      type: 'MING_WALLET_GET_SCHEDULED_TASK_REQUEST',
      messageId: 'msg_task_get_001',
      payload: { taskId },
    });
    expect(getResponse.payload.success).toBe(true);
    expect(getResponse.payload.data.status).toBe('pending');

    const cancelResponse = await sendRequest({
      type: 'MING_WALLET_CANCEL_SCHEDULED_TASK_REQUEST',
      messageId: 'msg_task_cancel_001',
      payload: {
        protocolVersion: '1.0.0',
        taskId,
      },
    });
    expect(cancelResponse.payload.success).toBe(true);
    expect(cancelResponse.payload.data.cancelled).toBe(true);
  });

  it('returns CHAIN_NOT_SUPPORTED when evm chain does not match wallet chain', async () => {
    await service!.init();
    (accountStore as { currentChainId: number }).currentChainId = 5000;

    const response = await sendRequest({
      type: 'MING_WALLET_MINT_NFT_REQUEST',
      messageId: 'msg_chain_mismatch_001',
      payload: BASE_PAYLOAD,
    });

    expect(response.payload.success).toBe(false);
    expect(response.payload.error.code).toBe('CHAIN_NOT_SUPPORTED');
  });

  it('handles RELEASE_CONNECTION_NFT request on evm', async () => {
    await service!.init();

    const response = await sendRequest({
      type: 'MING_WALLET_RELEASE_CONNECTION_NFT_REQUEST',
      messageId: 'msg_release_001',
      payload: {
        protocolVersion: '1.0.0',
        contract: {
          address: '0x3333333333333333333333333333333333333333',
          chainId: 11155111,
          chainFamily: 'evm',
          network: 'sepolia',
        },
        params: {
          tokenId: '12345',
          releasedTokenURI: 'ipfs://QmReleasedMetadataHash',
          removePrivateData: true,
        },
      },
    });

    expect(response.type).toBe('MING_WALLET_RELEASE_CONNECTION_NFT_RESPONSE');
    expect(response.payload.success).toBe(true);
    expect(response.payload.data.tokenId).toBe('12345');
    expect(transactionRelayer.sendTransaction).toHaveBeenCalledTimes(1);
  });

  it('handles GET_ACTIVE_ACCOUNT request on evm', async () => {
    await service!.init();

    const response = await sendRequest({
      type: 'MING_WALLET_GET_ACTIVE_ACCOUNT_REQUEST',
      messageId: 'msg_active_account_001',
      payload: {
        protocolVersion: '1.0.0',
        chainFamily: 'evm',
        chainId: 11155111,
      },
    });

    expect(response.type).toBe('MING_WALLET_GET_ACTIVE_ACCOUNT_RESPONSE');
    expect(response.payload.success).toBe(true);
    expect(response.payload.data.walletAddress).toBe(TEST_ACCOUNT.address);
    expect(response.payload.data.chainFamily).toBe('evm');
    expect(response.payload.data.chainId).toBe(11155111);
  });

  it('handles GET_ACTIVE_ACCOUNT request on solana', async () => {
    vi.stubEnv('VITE_SOLANA_NETWORK', 'solana-devnet');
    await service!.init();

    const solanaAddress = '8J8W1ahh6Y1cM1k8oYyU7F2jmYb5x1p6DYk7tV4hyU2S';
    (window as Window & { anDaoWalletSolanaBridge?: unknown }).anDaoWalletSolanaBridge =
      {
        mintConnectionNFT: vi.fn(),
        releaseConnectionNFT: vi.fn(),
        getCurrentWalletAddress: () => solanaAddress,
      };

    const response = await sendRequest({
      type: 'MING_WALLET_GET_ACTIVE_ACCOUNT_REQUEST',
      messageId: 'msg_active_account_solana_001',
      payload: {
        protocolVersion: '1.0.0',
        chainFamily: 'solana',
        network: 'solana-devnet',
      },
    });

    expect(response.type).toBe('MING_WALLET_GET_ACTIVE_ACCOUNT_RESPONSE');
    expect(response.payload.success).toBe(true);
    expect(response.payload.data.walletAddress).toBe(solanaAddress);
    expect(response.payload.data.chainFamily).toBe('solana');
    expect(response.payload.data.network).toBe('solana-devnet');
  });

  it('handles Solana mint/release through window.anDaoWalletSolanaBridge', async () => {
    vi.stubEnv('VITE_SOLANA_NETWORK', 'solana-devnet');
    await service!.init();

    const solanaAddress = '8J8W1ahh6Y1cM1k8oYyU7F2jmYb5x1p6DYk7tV4hyU2S';
    const solanaProgram = '5Ga3kk79rpPJy5joLvZKoJowRsEGvfcMpSDqAahYEVKT';
    const mintConnectionNFT = vi.fn().mockResolvedValue({
      tokenId: 'connection:sol-001',
      signature: 'solsig_mint_001',
      slot: 9001,
      walletAddress: solanaAddress,
    });
    const releaseConnectionNFT = vi.fn().mockResolvedValue({
      tokenId: 'connection:sol-001',
      txHash: 'soltx_release_001',
      blockNumber: 9002,
      walletAddress: solanaAddress,
    });

    (window as Window & { anDaoWalletSolanaBridge?: unknown }).anDaoWalletSolanaBridge =
      {
        mintConnectionNFT,
        releaseConnectionNFT,
        getCurrentWalletAddress: () => solanaAddress,
      };

    const mintResponse = await sendRequest({
      type: 'MING_WALLET_MINT_NFT_REQUEST',
      messageId: 'msg_sol_mint_001',
      payload: {
        ...BASE_PAYLOAD,
        contract: {
          address: solanaProgram,
          chainId: 0,
          chainFamily: 'solana',
          network: 'solana-devnet',
        },
        params: {
          ...BASE_PAYLOAD.params,
          to: solanaAddress,
        },
      },
    });

    expect(mintResponse.payload.success).toBe(true);
    expect(mintResponse.payload.data.txHash).toBe('solsig_mint_001');
    expect(mintConnectionNFT).toHaveBeenCalledTimes(1);

    const releaseResponse = await sendRequest({
      type: 'MING_WALLET_RELEASE_CONNECTION_NFT_REQUEST',
      messageId: 'msg_sol_release_001',
      payload: {
        protocolVersion: '1.0.0',
        contract: {
          address: solanaProgram,
          chainId: 0,
          chainFamily: 'solana',
          network: 'solana-devnet',
        },
        params: {
          tokenId: 'connection:sol-001',
          releasedTokenURI: 'https://example.com/release.json',
          removePrivateData: false,
        },
      },
    });

    expect(releaseResponse.payload.success).toBe(true);
    expect(releaseResponse.payload.data.txHash).toBe('soltx_release_001');
    expect(releaseConnectionNFT).toHaveBeenCalledTimes(1);
  });

  it('returns CONTRACT_CALL_FAILED when Solana release bridge does not return tx hash', async () => {
    vi.stubEnv('VITE_SOLANA_NETWORK', 'solana-devnet');
    await service!.init();

    const solanaAddress = '8J8W1ahh6Y1cM1k8oYyU7F2jmYb5x1p6DYk7tV4hyU2S';
    const solanaProgram = '5Ga3kk79rpPJy5joLvZKoJowRsEGvfcMpSDqAahYEVKT';

    (window as Window & { anDaoWalletSolanaBridge?: unknown }).anDaoWalletSolanaBridge =
      {
        mintConnectionNFT: vi.fn(),
        releaseConnectionNFT: vi.fn().mockResolvedValue({ tokenId: 'sol-token-01' }),
        getCurrentWalletAddress: () => solanaAddress,
      };

    const response = await sendRequest({
      type: 'MING_WALLET_RELEASE_CONNECTION_NFT_REQUEST',
      messageId: 'msg_sol_release_fail_001',
      payload: {
        protocolVersion: '1.0.0',
        contract: {
          address: solanaProgram,
          chainId: 0,
          chainFamily: 'solana',
          network: 'solana-devnet',
        },
        params: {
          tokenId: 'sol-token-01',
          releasedTokenURI: 'ipfs://QmReleasedMetadataHash',
        },
      },
    });

    expect(response.payload.success).toBe(false);
    expect(response.payload.error.code).toBe('CONTRACT_CALL_FAILED');
  });

  it('replays cached response for duplicate messageId (idempotency)', async () => {
    await service!.init();

    const message = {
      type: 'MING_WALLET_MINT_NFT_REQUEST',
      messageId: 'msg_idempotency_001',
      payload: BASE_PAYLOAD,
    };

    const first = await sendRequest(message);
    const second = await sendRequest(message);

    expect(first.payload.success).toBe(true);
    expect(second.payload.success).toBe(true);
    expect(second.payload.data).toEqual(first.payload.data);
    expect(transactionRelayer.sendTransaction).toHaveBeenCalledTimes(1);
  });

  it('ignores request from non-whitelisted origin', async () => {
    vi.stubEnv('VITE_MING_ALLOWED_ORIGINS', 'https://allowed.example');
    await service!.init();

    const messageId = 'msg_origin_denied_001';
    const noResponsePromise = waitForNoResponse(messageId, 120);
    window.postMessage(
      {
        type: 'MING_WALLET_MINT_NFT_REQUEST',
        messageId,
        payload: BASE_PAYLOAD,
      },
      '*'
    );

    const noResponse = await noResponsePromise;
    expect(noResponse).toBe(true);
    expect(transactionRelayer.sendTransaction).not.toHaveBeenCalled();
  });
});
