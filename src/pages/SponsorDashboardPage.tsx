/**
 * 赞助商仪表板页面
 * 
 * 赞助商管理界面，包括：
 * - 申请列表展示
 * - 申请审核界面
 * - 代付部署功能
 * - 渠道管理界面
 * - 统计数据展示
 * 
 * @module pages/SponsorDashboardPage
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { sponsorService } from '@/services/SponsorService';
import { Application, ApplicationStatus } from '@/types/sponsor';
import type { SponsorApplicationsDataSource } from '@/services/SponsorService';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorHandler } from '@/utils/errors';
import { useStore } from '@/stores';
import { trimInputValue } from '@/utils/formValidation';

async function requestPasswordFromUI(address: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: number | null = null;
    const requestId = `password_request_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

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

    const handlePasswordInput = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.requestId === requestId) {
        settle(typeof detail.password === 'string' ? detail.password : null);
      }
    };

    const handlePasswordCancel = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.requestId === requestId) {
        settle(null);
      }
    };

    window.addEventListener('wallet:password-input', handlePasswordInput as EventListener);
    window.addEventListener('wallet:password-cancel', handlePasswordCancel as EventListener);
    timeoutId = window.setTimeout(() => settle(null), 30_000);

    window.dispatchEvent(
      new CustomEvent('wallet:request-password', {
        detail: {
          requestId,
          address,
          purpose: 'sign_transaction',
        },
      })
    );
  });
}

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const StatCard = styled(Card)`
  padding: 20px;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 32px;
  font-weight: 600;
  color: #4c6ef5;
  margin-bottom: 8px;
`;

const StatLabel = styled.div`
  font-size: 14px;
  color: #666;
`;

const DataSourceBadge = styled.span<{ $source: SponsorApplicationsDataSource }>`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: ${props =>
    props.$source === 'indexer'
      ? '#d4edda'
      : props.$source === 'indexer-with-fallback' || props.$source === 'chain-fallback'
      ? '#fff3cd'
      : '#e2e3e5'};
  color: ${props =>
    props.$source === 'indexer'
      ? '#155724'
      : props.$source === 'indexer-with-fallback' || props.$source === 'chain-fallback'
      ? '#856404'
      : '#495057'};
`;

const Tabs = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 2px solid #e0e0e0;
`;

const Tab = styled.button<{ $active?: boolean }>`
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 2px solid ${props => props.$active ? '#4c6ef5' : 'transparent'};
  color: ${props => props.$active ? '#4c6ef5' : '#666'};
  font-size: 16px;
  font-weight: ${props => props.$active ? 600 : 400};
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -2px;

  &:hover {
    color: #4c6ef5;
  }
`;

const ApplicationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ApplicationCard = styled(Card)`
  padding: 20px;
`;

const ApplicationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 16px;
`;

const ApplicationInfo = styled.div`
  flex: 1;
`;

const ApplicationAddress = styled.div`
  font-family: monospace;
  font-size: 14px;
  color: #666;
  margin-top: 8px;
`;

const StatusBadge = styled.span<{ $status: ApplicationStatus }>`
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => {
    switch (props.$status) {
      case 'pending': return '#fff3cd';
      case 'approved': return '#d4edda';
      case 'rejected': return '#f8d7da';
      case 'deployed': return '#d1ecf1';
      default: return '#e0e0e0';
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'pending': return '#856404';
      case 'approved': return '#155724';
      case 'rejected': return '#721c24';
      case 'deployed': return '#0c5460';
      default: return '#666';
    }
  }};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled(Card)`
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  padding: 24px;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: #1a1a1a;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #1a1a1a;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 100px;

  &:focus {
    outline: none;
    border-color: #4c6ef5;
  }
`;

type TabType = 'applications' | 'channels' | 'stats';

export const SponsorDashboardPage = observer(() => {
  const navigate = useNavigate();
  const { accountStore } = useStore();
  const [activeTab, setActiveTab] = useState<TabType>('applications');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<SponsorApplicationsDataSource>('cache-only');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    deployed: 0,
  });

  /**
   * 加载申请列表
   */
  const loadApplications = async () => {
    if (!accountStore.currentAccount) {
      return;
    }

    setLoading(true);
    try {
      // 使用当前账户地址作为赞助商地址上下文，并带上当前链
      const sponsorAddress = accountStore.currentAccountAddress;
      if (!sponsorAddress) {
        return;
      }
      const chainId = accountStore.currentChainId;
      
      const result = await sponsorService.getApplicationsBySponsorWithSource(sponsorAddress, chainId);
      const allApplications = result.applications;

      setApplications(allApplications);
      setDataSource(result.dataSource);
      
      // 计算统计数据
      setStats({
        total: allApplications.length,
        pending: allApplications.filter(a => a.status === 'pending').length,
        approved: allApplications.filter(a => a.status === 'approved').length,
        rejected: allApplications.filter(a => a.status === 'rejected').length,
        deployed: allApplications.filter(a => a.status === 'deployed').length,
      });
    } catch (error) {
      ErrorHandler.handleAndShow(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
    // 仅在账户切换时刷新申请列表
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountStore.currentAccount]);

  /**
   * 处理审核申请
   */
  const handleReview = async (application: Application, action: 'approve' | 'reject') => {
    setSelectedApplication(application);
    setReviewAction(action);
    setReviewNote('');
    setShowReviewModal(true);
  };

  /**
   * 提交审核结果
   */
  const handleSubmitReview = async () => {
    if (!selectedApplication || !reviewAction) {
      return;
    }

    setLoading(true);
    try {
      await sponsorService.reviewApplication(
        selectedApplication.sponsorId,
        selectedApplication.id,
        reviewAction,
        reviewNote || undefined
      );
      
      setShowReviewModal(false);
      setSelectedApplication(null);
      setReviewAction(null);
      setReviewNote('');
      
      // 重新加载申请列表
      await loadApplications();
    } catch (error) {
      ErrorHandler.handleAndShow(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理代付部署
   */
  const handleDeploy = async (application: Application) => {
    if (application.status !== 'approved') {
      ErrorHandler.showError('只能部署已审核通过的申请');
      return;
    }

    setLoading(true);
    try {
      // 通过统一密码输入组件请求密码
      const password = await requestPasswordFromUI(accountStore.currentAccountAddress || '');
      const passwordValue = password ? trimInputValue(password) : '';
      if (!passwordValue) {
        return;
      }

      // deployAccountForUser需要sponsorId和applicationId
      // 从application中获取sponsorId
      const sponsorId = application.sponsorId || accountStore.currentAccountAddress;
      if (!sponsorId) {
        throw new Error('未找到赞助商ID，无法执行部署');
      }
      const txHash = await sponsorService.deployAccountForUser(
        sponsorId,
        application.id,
        passwordValue
      );

      ErrorHandler.showSuccess(`部署成功，交易哈希：${txHash}`);
      
      // 重新加载申请列表
      await loadApplications();
    } catch (error) {
      ErrorHandler.handleAndShow(error);
    } finally {
      setLoading(false);
    }
  };

  if (!accountStore.currentAccount) {
    return (
      <Container>
        <Card>
          <p>请先创建或导入账户</p>
          <Button onClick={() => navigate('/welcome')}>创建账户</Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>赞助商仪表板</Title>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <DataSourceBadge $source={dataSource}>
            {dataSource === 'indexer' && '数据源：索引服务'}
            {dataSource === 'indexer-with-fallback' && '数据源：索引服务 + 链上补齐'}
            {dataSource === 'chain-fallback' && '数据源：链上逐条查询'}
            {dataSource === 'cache-only' && '数据源：本地缓存'}
          </DataSourceBadge>
          <Button onClick={() => navigate('/assets')}>返回资产管理</Button>
        </div>
      </Header>

      <StatsGrid>
        <StatCard>
          <StatValue>{stats.total}</StatValue>
          <StatLabel>总申请数</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{stats.pending}</StatValue>
          <StatLabel>待审核</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{stats.approved}</StatValue>
          <StatLabel>已通过</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{stats.deployed}</StatValue>
          <StatLabel>已部署</StatLabel>
        </StatCard>
      </StatsGrid>

      <Tabs>
        <Tab $active={activeTab === 'applications'} onClick={() => setActiveTab('applications')}>
          申请列表
        </Tab>
        <Tab $active={activeTab === 'channels'} onClick={() => setActiveTab('channels')}>
          渠道管理
        </Tab>
        <Tab $active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>
          统计数据
        </Tab>
      </Tabs>

      {activeTab === 'applications' && (
        <ApplicationList>
          {loading && <div>加载中...</div>}
          {!loading && applications.length === 0 && (
            <Card>
              <p>暂无申请</p>
            </Card>
          )}
          {applications.map((app) => (
            <ApplicationCard key={app.id}>
              <ApplicationHeader>
                <ApplicationInfo>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <strong>申请 #{app.id.slice(0, 8)}</strong>
                    <StatusBadge $status={app.status}>
                      {app.status === 'pending' && '待审核'}
                      {app.status === 'approved' && '已通过'}
                      {app.status === 'rejected' && '已拒绝'}
                      {app.status === 'deployed' && '已部署'}
                    </StatusBadge>
                  </div>
                  <ApplicationAddress>
                    账户地址: {app.accountAddress}
                  </ApplicationAddress>
                  {app.createdAt && (
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                      申请时间: {new Date(app.createdAt).toLocaleString()}
                    </div>
                  )}
                </ApplicationInfo>
                <ActionButtons>
                  {app.status === 'pending' && (
                    <>
                      <Button onClick={() => handleReview(app, 'approve')}>通过</Button>
                      <Button onClick={() => handleReview(app, 'reject')} style={{ background: '#dc3545' }}>
                        拒绝
                      </Button>
                    </>
                  )}
                  {app.status === 'approved' && (
                    <Button onClick={() => handleDeploy(app)}>代付部署</Button>
                  )}
                </ActionButtons>
              </ApplicationHeader>
            </ApplicationCard>
          ))}
        </ApplicationList>
      )}

      {activeTab === 'channels' && (
        <Card>
          <p>渠道管理功能开发中...</p>
        </Card>
      )}

      {activeTab === 'stats' && (
        <Card>
          <h2>统计数据</h2>
          <p>详细统计功能开发中...</p>
        </Card>
      )}

      {showReviewModal && selectedApplication && (
        <ModalOverlay onClick={() => setShowReviewModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>
                {reviewAction === 'approve' ? '通过申请' : '拒绝申请'}
              </ModalTitle>
              <CloseButton onClick={() => setShowReviewModal(false)}>×</CloseButton>
            </ModalHeader>
            <FormGroup>
              <Label>申请信息</Label>
              <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px', fontSize: '14px' }}>
                <div>申请ID: {selectedApplication.id}</div>
                <div>账户地址: {selectedApplication.accountAddress}</div>
              </div>
            </FormGroup>
            <FormGroup>
              <Label>审核备注（可选）</Label>
              <TextArea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="请输入审核备注..."
              />
            </FormGroup>
            <ActionButtons>
              <Button onClick={handleSubmitReview} disabled={loading}>
                {loading ? '提交中...' : '确认'}
              </Button>
              <Button onClick={() => setShowReviewModal(false)} style={{ background: '#6c757d' }}>
                取消
              </Button>
            </ActionButtons>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  );
});
