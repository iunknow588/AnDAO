import { encodeFunctionData, parseAbiItem, type Address, type Hash } from 'viem';
import { rpcClientManager } from '@/utils/RpcClientManager';
import { transactionRelayer, type SponsorPolicyContext } from '@/services/TransactionRelayer';

const ERC721_TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
);

export class NFTService {
  /**
   * 查询地址当前持有的 ERC-721 TokenId 列表（基于 Transfer 事件回放）
   *
   * 说明：
   * - 该实现不依赖业务后端索引；
   * - 大规模历史数据场景建议配合索引服务优化。
   */
  async getOwnedErc721TokenIds(
    chainId: number,
    nftContract: Address,
    owner: Address,
    fromBlock: bigint = 0n
  ): Promise<string[]> {
    const publicClient = rpcClientManager.getPublicClient(chainId);

    const [incoming, outgoing] = await Promise.all([
      publicClient.getLogs({
        address: nftContract,
        event: ERC721_TRANSFER_EVENT,
        args: { to: owner },
        fromBlock,
        toBlock: 'latest',
      }),
      publicClient.getLogs({
        address: nftContract,
        event: ERC721_TRANSFER_EVENT,
        args: { from: owner },
        fromBlock,
        toBlock: 'latest',
      }),
    ]);

    const tokenSet = new Set<string>();
    for (const log of incoming) {
      const tokenId = log.args.tokenId;
      if (typeof tokenId === 'bigint') {
        tokenSet.add(tokenId.toString());
      }
    }
    for (const log of outgoing) {
      const tokenId = log.args.tokenId;
      if (typeof tokenId === 'bigint') {
        tokenSet.delete(tokenId.toString());
      }
    }

    return Array.from(tokenSet.values()).sort((a, b) => {
      const aBig = BigInt(a);
      const bBig = BigInt(b);
      if (aBig < bBig) return -1;
      if (aBig > bBig) return 1;
      return 0;
    });
  }

  /**
   * 发起 ERC-721 交易（safeTransferFrom）
   */
  async transferErc721(
    accountAddress: Address,
    chainId: number,
    nftContract: Address,
    to: Address,
    tokenId: string | bigint,
    signerPrivateKey: `0x${string}`,
    sponsorPolicyContext?: SponsorPolicyContext
  ): Promise<Hash> {
    const normalizedTokenId = typeof tokenId === 'bigint' ? tokenId : BigInt(tokenId);
    const callData = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'safeTransferFrom',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'tokenId', type: 'uint256' },
          ],
          outputs: [],
        },
      ],
      functionName: 'safeTransferFrom',
      args: [accountAddress, to, normalizedTokenId],
    });

    return transactionRelayer.sendTransaction(
      accountAddress,
      chainId,
      nftContract,
      callData,
      signerPrivateKey,
      0n,
      sponsorPolicyContext
    );
  }
}

export const nftService = new NFTService();

