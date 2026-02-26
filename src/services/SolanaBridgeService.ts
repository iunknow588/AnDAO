import type {
  AnDaoWalletSolanaBridge,
  SolanaBridgeExecutionResult,
  SolanaMintBridgeInput,
  SolanaReleaseBridgeInput,
} from '@/types/solana-bridge';

export class SolanaBridgeService {
  private initialized = false;

  init(): void {
    if (this.initialized || typeof window === 'undefined') {
      return;
    }

    if (!window.anDaoWalletSolanaBridge) {
      window.anDaoWalletSolanaBridge = this.createDefaultBridge();
    }

    this.initialized = true;
  }

  private createDefaultBridge(): AnDaoWalletSolanaBridge {
    return {
      mintConnectionNFT: async (input: SolanaMintBridgeInput) => {
        return this.callBridgeEndpoint<SolanaBridgeExecutionResult>(
          '/mint-connection-nft',
          input
        );
      },
      releaseConnectionNFT: async (input: SolanaReleaseBridgeInput) => {
        return this.callBridgeEndpoint<SolanaBridgeExecutionResult>(
          '/release-connection-nft',
          input
        );
      },
      getCurrentWalletAddress: (_network: string) => {
        const fromEnv = import.meta.env.VITE_SOLANA_WALLET_ADDRESS;
        if (fromEnv && fromEnv.trim()) {
          return fromEnv.trim();
        }

        const providerAddress = window.solana?.publicKey?.toBase58?.();
        if (providerAddress) {
          return providerAddress;
        }

        return undefined;
      },
    };
  }

  private async callBridgeEndpoint<T>(path: string, payload: unknown): Promise<T> {
    const endpoint = import.meta.env.VITE_SOLANA_BRIDGE_ENDPOINT;
    if (!endpoint || !endpoint.trim()) {
      throw new Error(
        'VITE_SOLANA_BRIDGE_ENDPOINT is not configured. Please configure Solana bridge endpoint.'
      );
    }

    const url = `${endpoint.replace(/\/+$/, '')}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Solana bridge request failed (${response.status}): ${text || response.statusText}`
      );
    }

    return (await response.json()) as T;
  }
}

export const solanaBridgeService = new SolanaBridgeService();
