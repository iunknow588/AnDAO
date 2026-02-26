import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnDaoWalletProvider } from '../ProviderAdapter';
import { SupportedChain } from '@/types';

vi.mock('@/stores/InteractionStore', () => ({
  interactionStore: {
    addRequest: vi.fn(),
    getRequest: vi.fn(),
  },
}));

vi.mock('@/services/KeyManagerService', () => ({
  keyManagerService: {
    getPrivateKeyFromSession: vi.fn().mockResolvedValue(
      '0x1234567890123456789012345678901234567890123456789012345678901234'
    ),
    getPrivateKey: vi.fn(),
    cachePrivateKeyToSession: vi.fn(),
  },
}));

describe('AnDaoWalletProvider chain selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setup() {
    const testAccount = {
      address: '0x1111111111111111111111111111111111111111',
      chainId: 5003,
      owner: '0x2222222222222222222222222222222222222222',
      createdAt: Date.now(),
    };

    const accountStore = {
      currentChain: SupportedChain.MANTLE,
      currentChainId: 5003,
      getAccount: vi.fn((chain: number) => (chain === 5003 ? testAccount : null)),
      setCurrentChain: vi.fn(),
    };

    const transactionRelayer = {
      sendTransaction: vi.fn().mockResolvedValue('0xmockedtxhash'),
    };

    const accountManager = {};

    const provider = new AnDaoWalletProvider(
      accountStore as never,
      transactionRelayer as never,
      accountManager as never
    );

    return { provider, accountStore, transactionRelayer, testAccount };
  }

  it('eth_chainId 应返回当前激活的 chainId（而非链枚举默认配置）', async () => {
    const { provider } = setup();

    const chainId = await provider.request({ method: 'eth_chainId' });
    expect(chainId).toBe('0x138b'); // 5003
  });

  it('eth_accounts 应按 currentChainId 查询账户', async () => {
    const { provider, accountStore, testAccount } = setup();

    const accounts = await provider.request({ method: 'eth_accounts' });

    expect(accountStore.getAccount).toHaveBeenCalledWith(5003);
    expect(accounts).toStrictEqual([testAccount.address]);
  });

  it('eth_requestAccounts 应按 currentChainId 返回账户', async () => {
    const { provider, accountStore, testAccount } = setup();

    const accounts = await provider.request({ method: 'eth_requestAccounts' });

    expect(accountStore.getAccount).toHaveBeenCalledWith(5003);
    expect(accounts).toStrictEqual([testAccount.address]);
  });

  it('switchChain 应按 chainId 数值切换，避免同链族主网/测试网混淆', async () => {
    const { provider, accountStore } = setup();

    await (provider as unknown as { switchChain: (params: { chainId: string }) => Promise<null> }).switchChain({
      chainId: '0x138b',
    });

    expect(accountStore.setCurrentChain).toHaveBeenCalledWith(5003);
  });

  it('sendTransaction 应使用 currentChainId 作为链参数', async () => {
    const { provider, transactionRelayer, testAccount } = setup();
    const to = '0x3333333333333333333333333333333333333333';
    const data = '0xabcdef';

    const txHash = await (
      provider as unknown as {
        sendTransaction: (tx: { to: string; data?: string }) => Promise<string>;
      }
    ).sendTransaction({ to, data });

    expect(transactionRelayer.sendTransaction).toHaveBeenCalledWith(
      testAccount.address,
      5003,
      to,
      data,
      '0x1234567890123456789012345678901234567890123456789012345678901234'
    );
    expect(txHash).toBe('0xmockedtxhash');
  });
});
