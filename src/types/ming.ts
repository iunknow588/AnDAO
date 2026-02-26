export type MingChainFamily = 'evm' | 'solana';

export interface MingWalletMessage<TPayload = unknown> {
  type: string;
  payload: TPayload;
  messageId: string;
}

export interface MingWalletErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface MingWalletResponsePayload {
  success: boolean;
  data?: Record<string, unknown>;
  error?: MingWalletErrorPayload;
}

export interface MingWalletResponseEnvelope {
  type: string;
  messageId: string;
  payload: MingWalletResponsePayload;
}

export interface MingTiming {
  requestedAt: string;
  executeAt: string;
  strategy: 'immediate' | 'scheduled';
  timezone?: string;
}

export interface MingContractTarget {
  address: string;
  chainId: number;
  chainFamily?: MingChainFamily;
  network?: string;
}

export interface MingMintParams {
  to: string;
  tokenURI: string;
  externalObjectId: string;
  element: string;
  consensusHash: string;
}

export interface MingMintNFTRequestPayload {
  protocolVersion: string;
  timing: MingTiming;
  ipfs?: {
    imageHash?: string;
    metadataHash?: string;
    imageURI?: string;
    tokenURI?: string;
  };
  consensusHash: string;
  contract: MingContractTarget;
  params: MingMintParams;
}

export interface MingCreateScheduledTaskRequestPayload extends MingMintNFTRequestPayload {
  scheduledTime: string;
  timing: MingTiming & { strategy: 'scheduled' };
}

export interface MingGetScheduledTaskRequestPayload {
  taskId: string;
}

export interface MingGetScheduledTasksByWalletRequestPayload {
  protocolVersion: string;
  walletAddress: string;
}

export interface MingCancelScheduledTaskRequestPayload {
  protocolVersion: string;
  taskId: string;
}

export interface MingGetActiveAccountRequestPayload {
  protocolVersion: string;
  chainFamily?: MingChainFamily;
  chainId?: number;
  network?: string;
}

export interface MingReleaseConnectionRequestPayload {
  protocolVersion: string;
  contract: MingContractTarget;
  params: {
    tokenId: string;
    releasedTokenURI: string;
    removePrivateData?: boolean;
  };
}

export interface MingChainExecutionResult {
  tokenId: string;
  txHash: string;
  blockNumber: number;
  timestamp?: number;
  walletAddress?: string;
}

export type MingScheduledTaskStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface MingScheduledTask {
  taskId: string;
  status: MingScheduledTaskStatus;
  scheduledTime: string;
  walletAddress?: string;
  request: MingMintNFTRequestPayload;
  createdAt: string;
  mintedAt?: string;
  result?: {
    tokenId?: string;
    txHash?: string;
    error?: string;
    blockNumber?: number;
    timestamp?: number;
  };
}
