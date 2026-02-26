/**
 * 守护人服务
 *
 * 负责社交恢复中的守护人管理、恢复流程和守护人提案流程。
 */

import type { Address } from 'viem';
import { encodeFunctionData } from 'viem';
import { Guardian, StorageKey } from '@/types';
import { requireChainConfig } from '@/utils/chainConfigValidation';
import { storageAdapter } from '@/adapters/StorageAdapter';
import { transactionRelayer } from './TransactionRelayer';
import { rpcClientManager } from '@/utils/RpcClientManager';
import { accountManager } from './AccountManager';

export type GuardianProposalType = 'add' | 'remove';
export type GuardianProposalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export interface GuardianProposal {
  proposalId: string;
  accountAddress: Address;
  chainId: number;
  type: GuardianProposalType;
  guardianAddress: Address;
  proposer: Address;
  createdAt: number;
  expiresAt: number;
  status: GuardianProposalStatus;
  votes: Array<{
    guardian: Address;
    vote: 'support' | 'oppose';
    timestamp: number;
  }>;
  txHash?: string;
}

type RecoveryRequestStatus = 'pending' | 'approved' | 'completed' | 'rejected';

interface RecoveryRequest {
  recoveryId: string;
  newOwner: Address;
  txHash: string;
  createdAt: number;
  status: RecoveryRequestStatus;
}

export class GuardianService {
  async getGuardians(
    accountAddress: Address,
    chainId: number,
    recoveryPluginAddress?: Address
  ): Promise<Guardian[]> {
    if (recoveryPluginAddress) {
      try {
        const publicClient = rpcClientManager.getPublicClient(chainId);
        const guardians = (await publicClient.readContract({
          address: recoveryPluginAddress,
          abi: [
            {
              inputs: [],
              name: 'getGuardians',
              outputs: [{ name: '', type: 'address[]' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'getGuardians',
        })) as Address[];

        const guardianList: Guardian[] = guardians.map((address) => ({
          address,
          addedAt: Date.now(),
        }));

        await storageAdapter.set(this.guardiansKey(accountAddress, chainId), guardianList);
        return guardianList;
      } catch (error) {
        console.warn('Failed to fetch guardians from chain, fallback to local:', error);
      }
    }

    const stored = await storageAdapter.get<Guardian[]>(
      this.guardiansKey(accountAddress, chainId)
    );
    return stored || [];
  }

  async addGuardian(
    accountAddress: Address,
    chainId: number,
    guardianAddress: Address,
    signerPrivateKey: `0x${string}`,
    recoveryPluginAddress?: Address
  ): Promise<string> {
    const guardians = await this.getGuardians(accountAddress, chainId, recoveryPluginAddress);
    if (guardians.length < 3) {
      return this.addGuardianDirectly(
        accountAddress,
        chainId,
        guardianAddress,
        signerPrivateKey,
        recoveryPluginAddress
      );
    }

    return this.proposeAddGuardian(
      accountAddress,
      chainId,
      guardianAddress,
      signerPrivateKey,
      recoveryPluginAddress
    );
  }

  async removeGuardian(
    accountAddress: Address,
    chainId: number,
    guardianAddress: Address,
    signerPrivateKey: `0x${string}`,
    recoveryPluginAddress?: Address
  ): Promise<string> {
    const guardians = await this.getGuardians(accountAddress, chainId, recoveryPluginAddress);
    if (guardians.length < 3) {
      return this.removeGuardianDirectly(
        accountAddress,
        chainId,
        guardianAddress,
        signerPrivateKey,
        recoveryPluginAddress
      );
    }

    return this.proposeRemoveGuardian(
      accountAddress,
      chainId,
      guardianAddress,
      signerPrivateKey,
      recoveryPluginAddress
    );
  }

  async initiateRecovery(
    accountAddress: Address,
    chainId: number,
    newOwner: Address,
    recoveryPluginAddress?: Address,
    signerPrivateKey?: `0x${string}`
  ): Promise<{ recoveryId: string; txHash: string }> {
    if (!signerPrivateKey) {
      throw new Error('Signer private key is required to initiate recovery');
    }

    const pluginAddress = this.resolveRecoveryPluginAddress(
      chainId,
      recoveryPluginAddress
    );

    const callData = encodeFunctionData({
      abi: [
        {
          inputs: [{ name: 'newOwner', type: 'address' }],
          name: 'initiateRecovery',
          outputs: [{ name: 'recoveryId', type: 'bytes32' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'initiateRecovery',
      args: [newOwner],
    });

    const txHash = await transactionRelayer.sendTransaction(
      accountAddress,
      chainId,
      pluginAddress,
      callData,
      signerPrivateKey
    );

    const recoveryId = `recovery_${txHash}`;
    await this.saveRecoveryRequest(accountAddress, chainId, {
      recoveryId,
      newOwner,
      txHash,
      createdAt: Date.now(),
      status: 'pending',
    });

    return { recoveryId, txHash };
  }

  async voteForRecovery(
    _accountAddress: Address,
    chainId: number,
    recoveryId: string,
    guardianPrivateKey: `0x${string}`,
    recoveryPluginAddress?: Address
  ): Promise<string> {
    const chainConfig = requireChainConfig(chainId, ['rpcUrl']);

    const pluginAddress = this.resolveRecoveryPluginAddress(
      chainId,
      recoveryPluginAddress
    );

    const callData = encodeFunctionData({
      abi: [
        {
          inputs: [{ name: 'recoveryId', type: 'bytes32' }],
          name: 'voteForRecovery',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'voteForRecovery',
      args: [recoveryId as `0x${string}`],
    });

    const { privateKeyToAccount } = await import('viem/accounts');
    const guardianAccount = privateKeyToAccount(guardianPrivateKey);
    const guardianAddress = guardianAccount.address;

    const publicClient = rpcClientManager.getPublicClient(chainId);
    const code = await publicClient.getBytecode({ address: guardianAddress });
    const isSmartAccount = !!code && code !== '0x';

    if (isSmartAccount) {
      return transactionRelayer.sendTransaction(
        guardianAddress,
        chainId,
        pluginAddress,
        callData,
        guardianPrivateKey
      );
    }

    const { createWalletClient, http: httpTransport } = await import('viem');
    const walletClient = createWalletClient({
      account: guardianAccount,
      chain: rpcClientManager.getChain(chainId),
      transport: httpTransport(chainConfig.rpcUrl),
    });

    return walletClient.sendTransaction({
      chain: rpcClientManager.getChain(chainId),
      to: pluginAddress,
      data: callData,
    });
  }

  async getRecoveryRequests(
    accountAddress: Address,
    chainId: number
  ): Promise<RecoveryRequest[]> {
    const stored = await storageAdapter.get<RecoveryRequest[]>(
      this.recoveryRequestsKey(accountAddress, chainId)
    );
    return stored || [];
  }

  async checkPathAUpgrade(accountAddress: Address, chainId: number): Promise<boolean> {
    try {
      await accountManager.init();

      const account = (await accountManager.getAccountByAddress(
        accountAddress,
        chainId
      )) as Record<string, unknown> | null;

      if (!account) {
        return false;
      }

      const userType = account.userType;
      const creationPath = account.creationPath;
      const originalCreationPath = account.originalCreationPath;

      const isPathAUser =
        userType === 'simple' || creationPath === 'path_a_simple';
      if (!isPathAUser) {
        return false;
      }

      if (
        typeof originalCreationPath === 'string' &&
        originalCreationPath !== 'path_a_simple'
      ) {
        return false;
      }

      const guardians = await this.getGuardians(accountAddress, chainId);
      return guardians.length >= 3;
    } catch (error) {
      console.warn('Failed to check path A upgrade condition:', error);
      return false;
    }
  }

  async proposeAddGuardian(
    accountAddress: Address,
    chainId: number,
    guardianAddress: Address,
    signerPrivateKey: `0x${string}`,
    recoveryPluginAddress?: Address
  ): Promise<string> {
    this.resolveRecoveryPluginAddress(chainId, recoveryPluginAddress);
    const proposer = await this.deriveAddressFromPrivateKey(signerPrivateKey);

    const proposalId = this.createProposalId(accountAddress, chainId, guardianAddress);
    const proposal: GuardianProposal = {
      proposalId,
      accountAddress,
      chainId,
      type: 'add',
      guardianAddress,
      proposer,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      status: 'pending',
      votes: [],
    };

    await this.saveProposal(proposal);
    return proposalId;
  }

  async proposeRemoveGuardian(
    accountAddress: Address,
    chainId: number,
    guardianAddress: Address,
    signerPrivateKey: `0x${string}`,
    recoveryPluginAddress?: Address
  ): Promise<string> {
    this.resolveRecoveryPluginAddress(chainId, recoveryPluginAddress);
    const proposer = await this.deriveAddressFromPrivateKey(signerPrivateKey);

    const proposalId = this.createProposalId(accountAddress, chainId, guardianAddress);
    const proposal: GuardianProposal = {
      proposalId,
      accountAddress,
      chainId,
      type: 'remove',
      guardianAddress,
      proposer,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      status: 'pending',
      votes: [],
    };

    await this.saveProposal(proposal);
    return proposalId;
  }

  async voteForGuardianProposal(
    proposalId: string,
    guardianPrivateKey: `0x${string}`,
    vote: 'support' | 'oppose'
  ): Promise<string> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.status !== 'pending') {
      throw new Error(`Proposal is ${proposal.status}, cannot vote`);
    }

    if (Date.now() > proposal.expiresAt) {
      proposal.status = 'expired';
      await this.saveProposal(proposal);
      throw new Error('Proposal has expired');
    }

    const guardianAddress = await this.deriveAddressFromPrivateKey(guardianPrivateKey);
    const guardians = await this.getGuardians(proposal.accountAddress, proposal.chainId);
    const isGuardian = guardians.some(
      (item) => item.address.toLowerCase() === guardianAddress.toLowerCase()
    );
    if (!isGuardian) {
      throw new Error('Only guardians can vote');
    }

    const hasVoted = proposal.votes.some(
      (entry) => entry.guardian.toLowerCase() === guardianAddress.toLowerCase()
    );
    if (hasVoted) {
      throw new Error('You have already voted');
    }

    proposal.votes.push({
      guardian: guardianAddress,
      vote,
      timestamp: Date.now(),
    });

    const supportVotes = proposal.votes.filter((entry) => entry.vote === 'support').length;
    if (supportVotes > guardians.length / 2) {
      proposal.status = 'approved';
      await this.executeProposal(proposal, guardianPrivateKey);
    }

    await this.saveProposal(proposal);
    return `vote_${proposalId}_${guardianAddress}_${Date.now()}`;
  }

  async getProposal(proposalId: string): Promise<GuardianProposal | null> {
    return (
      (await storageAdapter.get<GuardianProposal>(
        `${StorageKey.GUARDIANS}_proposal_${proposalId}`
      )) || null
    );
  }

  async getGuardianProposals(
    accountAddress: Address,
    chainId: number
  ): Promise<GuardianProposal[]> {
    const key = `${StorageKey.GUARDIANS}_proposals_${accountAddress}_${chainId}`;
    const proposals = (await storageAdapter.get<GuardianProposal[]>(key)) || [];

    const now = Date.now();
    for (const proposal of proposals) {
      if (proposal.status === 'pending' && now > proposal.expiresAt) {
        proposal.status = 'expired';
        await this.saveProposal(proposal);
      }
    }

    return proposals;
  }

  async cancelProposal(
    proposalId: string,
    signerPrivateKey: `0x${string}`
  ): Promise<void> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const signerAddress = await this.deriveAddressFromPrivateKey(signerPrivateKey);
    if (proposal.proposer.toLowerCase() !== signerAddress.toLowerCase()) {
      throw new Error('Only the proposer can cancel the proposal');
    }

    proposal.status = 'cancelled';
    await this.saveProposal(proposal);
  }

  private async addGuardianDirectly(
    accountAddress: Address,
    chainId: number,
    guardianAddress: Address,
    signerPrivateKey: `0x${string}`,
    recoveryPluginAddress?: Address
  ): Promise<string> {
    const pluginAddress = this.resolveRecoveryPluginAddress(
      chainId,
      recoveryPluginAddress
    );

    const callData = encodeFunctionData({
      abi: [
        {
          inputs: [{ name: 'guardian', type: 'address' }],
          name: 'addGuardian',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'addGuardian',
      args: [guardianAddress],
    });

    const txHash = await transactionRelayer.sendTransaction(
      accountAddress,
      chainId,
      pluginAddress,
      callData,
      signerPrivateKey
    );

    await this.updateLocalGuardians(accountAddress, chainId, guardianAddress, 'add');
    await this.checkPathAUpgrade(accountAddress, chainId);
    return txHash;
  }

  private async removeGuardianDirectly(
    accountAddress: Address,
    chainId: number,
    guardianAddress: Address,
    signerPrivateKey: `0x${string}`,
    recoveryPluginAddress?: Address
  ): Promise<string> {
    const pluginAddress = this.resolveRecoveryPluginAddress(
      chainId,
      recoveryPluginAddress
    );

    const callData = encodeFunctionData({
      abi: [
        {
          inputs: [{ name: 'guardian', type: 'address' }],
          name: 'removeGuardian',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'removeGuardian',
      args: [guardianAddress],
    });

    const txHash = await transactionRelayer.sendTransaction(
      accountAddress,
      chainId,
      pluginAddress,
      callData,
      signerPrivateKey
    );

    await this.updateLocalGuardians(accountAddress, chainId, guardianAddress, 'remove');
    return txHash;
  }

  private async updateLocalGuardians(
    accountAddress: Address,
    chainId: number,
    guardianAddress: Address,
    action: 'add' | 'remove'
  ): Promise<void> {
    const key = this.guardiansKey(accountAddress, chainId);
    const guardians = (await storageAdapter.get<Guardian[]>(key)) || [];

    if (action === 'add') {
      const exists = guardians.some(
        (item) => item.address.toLowerCase() === guardianAddress.toLowerCase()
      );
      if (!exists) {
        guardians.push({ address: guardianAddress, addedAt: Date.now() });
      }
    } else {
      const next = guardians.filter(
        (item) => item.address.toLowerCase() !== guardianAddress.toLowerCase()
      );
      await storageAdapter.set(key, next);
      return;
    }

    await storageAdapter.set(key, guardians);
  }

  private async saveRecoveryRequest(
    accountAddress: Address,
    chainId: number,
    request: RecoveryRequest
  ): Promise<void> {
    const key = this.recoveryRequestsKey(accountAddress, chainId);
    const requests = (await storageAdapter.get<RecoveryRequest[]>(key)) || [];
    requests.push(request);
    await storageAdapter.set(key, requests);
  }

  private async saveProposal(proposal: GuardianProposal): Promise<void> {
    const proposalKey = `${StorageKey.GUARDIANS}_proposal_${proposal.proposalId}`;
    await storageAdapter.set(proposalKey, proposal);

    const listKey = `${StorageKey.GUARDIANS}_proposals_${proposal.accountAddress}_${proposal.chainId}`;
    const proposals = (await storageAdapter.get<GuardianProposal[]>(listKey)) || [];
    const index = proposals.findIndex((item) => item.proposalId === proposal.proposalId);

    if (index >= 0) {
      proposals[index] = proposal;
    } else {
      proposals.push(proposal);
    }

    await storageAdapter.set(listKey, proposals);
  }

  private async executeProposal(
    proposal: GuardianProposal,
    signerPrivateKey: `0x${string}`
  ): Promise<void> {
    if (proposal.type === 'add') {
      await this.addGuardianDirectly(
        proposal.accountAddress,
        proposal.chainId,
        proposal.guardianAddress,
        signerPrivateKey
      );
      return;
    }

    await this.removeGuardianDirectly(
      proposal.accountAddress,
      proposal.chainId,
      proposal.guardianAddress,
      signerPrivateKey
    );
  }

  private resolveRecoveryPluginAddress(
    chainId: number,
    provided?: Address
  ): Address {
    if (provided) {
      return provided;
    }

    const chainConfig = requireChainConfig(chainId);

    const fromConfig = chainConfig.recoveryPluginAddress as Address | undefined;
    if (!fromConfig) {
      throw new Error(
        'Recovery plugin address is required. Please provide recoveryPluginAddress or configure it in chain config.'
      );
    }

    return fromConfig;
  }

  private async deriveAddressFromPrivateKey(
    privateKey: `0x${string}`
  ): Promise<Address> {
    const { privateKeyToAccount } = await import('viem/accounts');
    return privateKeyToAccount(privateKey).address;
  }

  private createProposalId(
    accountAddress: Address,
    chainId: number,
    guardianAddress: Address
  ): string {
    return `proposal_${accountAddress}_${chainId}_${Date.now()}_${guardianAddress}`;
  }

  private guardiansKey(accountAddress: Address, chainId: number): string {
    return `${StorageKey.GUARDIANS}_${accountAddress}_${chainId}`;
  }

  private recoveryRequestsKey(accountAddress: Address, chainId: number): string {
    return `${StorageKey.GUARDIANS}_recovery_${accountAddress}_${chainId}`;
  }
}

export const guardianService = new GuardianService();
