export interface SolanaMintBridgeInput {
  programId: string;
  network: string;
  recipient: string;
  tokenURI: string;
  externalObjectId: string;
  element: string;
  consensusHash: string;
}

export interface SolanaReleaseBridgeInput {
  programId: string;
  network: string;
  tokenId: string;
  releasedTokenURI: string;
  removePrivateData?: boolean;
}

export interface SolanaBridgeExecutionResult {
  tokenId?: string;
  connectionId?: string | number;
  mintAddress?: string;
  txHash?: string;
  signature?: string;
  blockNumber?: number;
  slot?: number;
  timestamp?: number;
  walletAddress?: string;
}

export interface AnDaoWalletSolanaBridge {
  mintConnectionNFT(
    payload: SolanaMintBridgeInput
  ): Promise<SolanaBridgeExecutionResult>;
  releaseConnectionNFT(
    payload: SolanaReleaseBridgeInput
  ): Promise<SolanaBridgeExecutionResult>;
  getCurrentWalletAddress?(
    network: string
  ): string | undefined | Promise<string | undefined>;
}

declare global {
  interface Window {
    anDaoWalletSolanaBridge?: AnDaoWalletSolanaBridge;
    solana?: {
      publicKey?: {
        toBase58?: () => string;
      };
      isConnected?: boolean;
    };
  }
}
