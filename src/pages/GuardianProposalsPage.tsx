/**
 * 守护人提案管理页面
 * 
 * 显示所有待投票的提案，支持守护人投票和账户持有人取消提案
 * 参考 Keplr 设置页面风格
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { guardianService, GuardianProposal } from '@/services/GuardianService';
import { keyManagerService } from '@/services/KeyManagerService';
import { ErrorHandler } from '@/utils/errors';
import type { Address } from 'viem';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { PasswordInputField } from '@/components/PasswordInput/PasswordInputField';
import { trimInputValue } from '@/utils/formValidation';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #1a1a1a;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 16px;
`;

const ProposalItem = styled.div`
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
`;

const ProposalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const ProposalType = styled.span<{ type: 'add' | 'remove' }>`
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => props.type === 'add' ? '#d1ecf1' : '#f8d7da'};
  color: ${props => props.type === 'add' ? '#0c5460' : '#721c24'};
`;

const ProposalStatus = styled.span<{ status: string }>`
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => {
    switch (props.status) {
      case 'pending': return '#fff3cd';
      case 'approved': return '#d4edda';
      case 'rejected': return '#f8d7da';
      case 'expired': return '#e2e3e5';
      default: return '#e2e3e5';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'pending': return '#856404';
      case 'approved': return '#155724';
      case 'rejected': return '#721c24';
      case 'expired': return '#383d41';
      default: return '#383d41';
    }
  }};
`;

const ProposalInfo = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
`;

const ProposalAddress = styled.div`
  font-family: monospace;
  font-size: 14px;
  color: #333;
  word-break: break-all;
  margin-bottom: 8px;
`;

const VotesInfo = styled.div`
  font-size: 14px;
  color: #666;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e0e0e0;
`;

const VoteItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
`;

const VoteButton = styled.button<{ variant: 'support' | 'oppose' }>`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  margin-right: 8px;
  background: ${props => props.variant === 'support' ? '#28a745' : '#dc3545'};
  color: #ffffff;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const CancelButton = styled.button`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #dc3545;
  background: transparent;
  color: #dc3545;
  transition: all 0.2s;

  &:hover {
    background: #dc3545;
    color: #ffffff;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #999;
`;

const ErrorMessage = styled.div`
  color: #e03131;
  font-size: 14px;
  margin-top: 8px;
`;

const SuccessMessage = styled.div`
  color: #2f9e44;
  font-size: 14px;
  margin-top: 8px;
`;

export const GuardianProposalsPage = observer(() => {
  const { accountStore } = useStore();
  const [proposals, setProposals] = useState<GuardianProposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [votingProposal, setVotingProposal] = useState<string | null>(null);
  const [cancellingProposal, setCancellingProposal] = useState<string | null>(null);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<GuardianProposal | null>(null);
  const [voteType, setVoteType] = useState<'support' | 'oppose'>('support');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentAccount = accountStore.currentAccount;
  const currentChainId = currentAccount?.chainId || 0;

  useEffect(() => {
    if (currentAccount) {
      loadProposals();
    }
    // 仅在账户切换时刷新提案
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount]);

  const loadProposals = async () => {
    if (!currentAccount) return;

    setIsLoading(true);
    setError(null);

    try {
      const list = await guardianService.getGuardianProposals(
        currentAccount.address as Address,
        currentChainId
      );
      setProposals(list);
    } catch (err) {
      setError(ErrorHandler.handleAndShow(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async () => {
    if (!selectedProposal) {
      setError('未选择提案');
      return;
    }

    const passwordValue = trimInputValue(password);
    if (!passwordValue) {
      setError('请输入密码');
      return;
    }

    setVotingProposal(selectedProposal.proposalId);
    setError(null);
    setSuccess(null);

    try {
      // 获取守护人私钥（这里需要根据实际情况获取）
      // 注意：守护人需要使用自己的EOA账户私钥
      const guardianAddress = currentAccount?.owner as Address;
      const guardianPrivateKey = await keyManagerService.getPrivateKey(guardianAddress, passwordValue);

      if (!guardianPrivateKey) {
        setError('无法获取守护人私钥，请检查密码');
        return;
      }

      await guardianService.voteForGuardianProposal(
        selectedProposal.proposalId,
        guardianPrivateKey,
        voteType
      );

      setSuccess(`投票成功！`);
      setPassword('');
      setShowVoteDialog(false);
      setSelectedProposal(null);
      await loadProposals();
    } catch (err) {
      setError(ErrorHandler.handleAndShow(err));
    } finally {
      setVotingProposal(null);
    }
  };

  const handleCancelProposal = async (proposalId: string) => {
    if (!currentAccount) {
      setError('请先选择账户');
      return;
    }

    const passwordValue = trimInputValue(password);
    if (!passwordValue) {
      setError('请输入密码');
      return;
    }

    setCancellingProposal(proposalId);
    setError(null);
    setSuccess(null);

    try {
      const ownerAddress = currentAccount.owner as Address;
      const signerPrivateKey = await keyManagerService.getPrivateKey(ownerAddress, passwordValue);

      if (!signerPrivateKey) {
        setError('无法获取签名者私钥，请检查密码');
        return;
      }

      await guardianService.cancelProposal(proposalId, signerPrivateKey);

      setSuccess('提案已取消');
      setPassword('');
      await loadProposals();
    } catch (err) {
      setError(ErrorHandler.handleAndShow(err));
    } finally {
      setCancellingProposal(null);
    }
  };

  const openVoteDialog = (proposal: GuardianProposal, vote: 'support' | 'oppose') => {
    setSelectedProposal(proposal);
    setVoteType(vote);
    setShowVoteDialog(true);
    setPassword('');
    setError(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const formatExpiresAt = (timestamp: number) => {
    const now = Date.now();
    const diff = timestamp - now;
    if (diff <= 0) return '已过期';
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return `${days}天${hours}小时后过期`;
  };

  if (!currentAccount) {
    return (
      <Container>
        <Title>守护人提案</Title>
        <Card>
          <EmptyState>请先创建或导入账户</EmptyState>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Title>守护人提案</Title>

      {isLoading ? (
        <Card>
          <EmptyState>加载中...</EmptyState>
        </Card>
      ) : proposals.length === 0 ? (
        <Card>
          <EmptyState>暂无提案</EmptyState>
        </Card>
      ) : (
        proposals.map((proposal) => (
          <Card key={proposal.proposalId}>
            <ProposalItem>
              <ProposalHeader>
                <ProposalType type={proposal.type}>
                  {proposal.type === 'add' ? '添加守护人' : '移除守护人'}
                </ProposalType>
                <ProposalStatus status={proposal.status}>
                  {proposal.status === 'pending' ? '待投票' :
                   proposal.status === 'approved' ? '已通过' :
                   proposal.status === 'rejected' ? '已拒绝' :
                   proposal.status === 'expired' ? '已过期' :
                   proposal.status === 'cancelled' ? '已取消' : proposal.status}
                </ProposalStatus>
              </ProposalHeader>

              <ProposalInfo>
                <strong>守护人地址:</strong>
              </ProposalInfo>
              <ProposalAddress>{proposal.guardianAddress}</ProposalAddress>

              <ProposalInfo>
                <strong>创建时间:</strong> {formatDate(proposal.createdAt)}
              </ProposalInfo>
              <ProposalInfo>
                <strong>过期时间:</strong> {formatExpiresAt(proposal.expiresAt)}
              </ProposalInfo>
              <ProposalInfo>
                <strong>提案ID:</strong> {proposal.proposalId.substring(0, 20)}...
              </ProposalInfo>

              {proposal.status === 'pending' && (
                <>
                  <VotesInfo>
                    <strong>投票情况:</strong>
                    {proposal.votes.length === 0 ? (
                      <div style={{ marginTop: '8px', color: '#999' }}>暂无投票</div>
                    ) : (
                      proposal.votes.map((vote, index) => (
                        <VoteItem key={index}>
                          <span>{vote.guardian.substring(0, 10)}...{vote.guardian.substring(vote.guardian.length - 8)}</span>
                          <span style={{ 
                            color: vote.vote === 'support' ? '#28a745' : '#dc3545',
                            fontWeight: 600
                          }}>
                            {vote.vote === 'support' ? '支持' : '反对'}
                          </span>
                        </VoteItem>
                      ))
                    )}
                  </VotesInfo>

                  <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <VoteButton
                      variant="support"
                      onClick={() => openVoteDialog(proposal, 'support')}
                      disabled={votingProposal === proposal.proposalId}
                    >
                      投票支持
                    </VoteButton>
                    <VoteButton
                      variant="oppose"
                      onClick={() => openVoteDialog(proposal, 'oppose')}
                      disabled={votingProposal === proposal.proposalId}
                    >
                      投票反对
                    </VoteButton>
                    {proposal.proposer.toLowerCase() === currentAccount.owner?.toLowerCase() && (
                      <CancelButton
                        onClick={() => handleCancelProposal(proposal.proposalId)}
                        disabled={cancellingProposal === proposal.proposalId}
                      >
                        {cancellingProposal === proposal.proposalId ? '取消中...' : '取消提案'}
                      </CancelButton>
                    )}
                  </div>
                </>
              )}
            </ProposalItem>
          </Card>
        ))
      )}

      <Modal
        isOpen={showVoteDialog}
        onClose={() => {
          setShowVoteDialog(false);
          setSelectedProposal(null);
          setPassword('');
          setError(null);
        }}
        title={`投票${voteType === 'support' ? '支持' : '反对'}`}
      >
        {selectedProposal && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <p>提案类型: {selectedProposal.type === 'add' ? '添加守护人' : '移除守护人'}</p>
              <p>守护人地址: {selectedProposal.guardianAddress}</p>
            </div>
            <PasswordInputField
              label="请输入密码以解锁守护人私钥"
              value={password}
              onChange={(value) => setPassword(value)}
              placeholder="密码"
            />
            {error && <ErrorMessage>{error}</ErrorMessage>}
            {success && <SuccessMessage>{success}</SuccessMessage>}
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowVoteDialog(false);
                  setSelectedProposal(null);
                  setPassword('');
                  setError(null);
                }}
              >
                取消
              </Button>
              <Button
                onClick={handleVote}
                disabled={!password || votingProposal === selectedProposal.proposalId}
              >
                {votingProposal === selectedProposal.proposalId ? '投票中...' : '确认投票'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Container>
  );
});
