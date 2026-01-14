/**
 * 两阶段提交任务管理页面
 * 
 * 管理两阶段提交任务，包括任务列表、状态监控、揭示操作
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { twoPhaseCommitService } from '@/services/TwoPhaseCommitService';
import { keyManagerService } from '@/services/KeyManagerService';
import { useStore } from '@/stores';
import { TwoPhaseCommitTask } from '@/types';
import { ErrorHandler } from '@/utils/errors';
import type { Address } from 'viem';

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

const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #1a1a1a;
`;

const TaskList = styled.div`
  margin-top: 16px;
`;

const TaskItem = styled.div`
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
`;

const TaskHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const TaskId = styled.div`
  font-family: monospace;
  font-size: 14px;
  color: #666;
  word-break: break-all;
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  background: ${(props) => {
    switch (props.status) {
      case 'ready_to_reveal':
        return '#2f9e44';
      case 'revealed':
        return '#4c6ef5';
      case 'monitoring':
        return '#ffc107';
      case 'failed':
        return '#e03131';
      default:
        return '#999';
    }
  }};
  color: #ffffff;
`;

const TaskInfo = styled.div`
  font-size: 14px;
  color: #666;
  margin: 8px 0;
`;

const Button = styled.button`
  background: #4c6ef5;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  margin-right: 8px;

  &:hover {
    background: #3b5bdb;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const DangerButton = styled(Button)`
  background: #e03131;

  &:hover {
    background: #c92a2a;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  margin-bottom: 16px;

  &:focus {
    outline: none;
    border-color: #4c6ef5;
  }
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

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #999;
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
`;

export const TwoPhaseCommitPage = observer(() => {
  const { accountStore } = useStore();
  const [tasks, setTasks] = useState<TwoPhaseCommitTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revealData, setRevealData] = useState('');
  const [revealingTaskId, setRevealingTaskId] = useState<string | null>(null);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TwoPhaseCommitTask | null>(null);
  const [password, setPassword] = useState('');

  useEffect(() => {
    loadTasks();
    
    // 监听两阶段提交就绪事件
    const handleReadyToReveal = (event: CustomEvent) => {
      const { taskId } = event.detail;
      loadTasks();
      // 可以显示通知
      setSuccess(`任务 ${taskId} 已准备好揭示`);
    };

    window.addEventListener('two-phase-commit:ready-to-reveal', handleReadyToReveal as EventListener);

    return () => {
      window.removeEventListener('two-phase-commit:ready-to-reveal', handleReadyToReveal as EventListener);
    };
  }, []);

  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const list = await twoPhaseCommitService.getAllTasks();
      setTasks(list);
    } catch (err) {
      setError(ErrorHandler.handleError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReveal = async () => {
    if (!selectedTask || !revealData) {
      setError('请输入揭示数据');
      return;
    }

    if (!password) {
      setError('请输入密码以解锁私钥');
      return;
    }

    setRevealingTaskId(selectedTask.id);
    setError(null);
    setSuccess(null);

    try {
      // 从安全存储获取签名者私钥
      const currentAccount = accountStore.currentAccount;
      if (!currentAccount) {
        setError('请先选择账户');
        return;
      }

      const ownerAddress = currentAccount.owner as Address;
      const signerPrivateKey = await keyManagerService.getPrivateKey(ownerAddress, password);

      if (!signerPrivateKey) {
        setError('无法获取签名者私钥，请检查密码');
        return;
      }

      const txHash = await twoPhaseCommitService.reveal(
        selectedTask.id,
        signerPrivateKey,
        revealData
      );

      setSuccess(`揭示成功，交易哈希: ${txHash}`);
      setShowRevealModal(false);
      setRevealData('');
      setSelectedTask(null);
      await loadTasks();
    } catch (err) {
      setError(ErrorHandler.handleError(err));
    } finally {
      setRevealingTaskId(null);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    if (!confirm('确定要取消此任务吗？')) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await twoPhaseCommitService.cancelTask(taskId);
      setSuccess('任务已取消');
      await loadTasks();
    } catch (err) {
      setError(ErrorHandler.handleError(err));
    }
  };

  const openRevealModal = (task: TwoPhaseCommitTask) => {
    setSelectedTask(task);
    setShowRevealModal(true);
    setRevealData('');
    setError(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: '待处理',
      monitoring: '监控中',
      ready_to_reveal: '可揭示',
      revealing: '揭示中',
      revealed: '已揭示',
      failed: '失败',
      cancelled: '已取消',
    };
    return statusMap[status] || status;
  };

  return (
    <Container>
      <Title>两阶段提交任务</Title>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      <Card>
        <SectionTitle>任务列表</SectionTitle>
        {isLoading ? (
          <EmptyState>加载中...</EmptyState>
        ) : tasks.length === 0 ? (
          <EmptyState>暂无任务</EmptyState>
        ) : (
          <TaskList>
            {tasks.map((task) => (
              <TaskItem key={task.id}>
                <TaskHeader>
                  <TaskId>任务 ID: {task.id}</TaskId>
                  <StatusBadge status={task.status}>{getStatusText(task.status)}</StatusBadge>
                </TaskHeader>
                <TaskInfo>链 ID: {task.chainId}</TaskInfo>
                <TaskInfo>合约地址: {task.contractAddress}</TaskInfo>
                <TaskInfo>承诺哈希: {task.commitmentHash}</TaskInfo>
                <TaskInfo>第一阶段交易: {task.firstPhaseTxHash}</TaskInfo>
                <TaskInfo>创建时间: {formatDate(task.createdAt)}</TaskInfo>
                {task.revealedAt && (
                  <TaskInfo>揭示时间: {formatDate(task.revealedAt)}</TaskInfo>
                )}
                {task.revealedTxHash && (
                  <TaskInfo>揭示交易: {task.revealedTxHash}</TaskInfo>
                )}
                <div style={{ marginTop: '12px' }}>
                  {task.status === 'ready_to_reveal' && (
                    <Button onClick={() => openRevealModal(task)}>揭示</Button>
                  )}
                  {(task.status === 'pending' || task.status === 'monitoring') && (
                    <DangerButton onClick={() => handleCancelTask(task.id)}>取消</DangerButton>
                  )}
                </div>
              </TaskItem>
            ))}
          </TaskList>
        )}
      </Card>

      {showRevealModal && selectedTask && (
        <Modal onClick={() => setShowRevealModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <SectionTitle>揭示数据</SectionTitle>
            <Input
              type="password"
              placeholder="请输入密码以解锁私钥"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!!revealingTaskId}
            />
            <Input
              type="text"
              placeholder="输入要揭示的数据"
              value={revealData}
              onChange={(e) => setRevealData(e.target.value)}
              disabled={!!revealingTaskId}
            />
            {error && <ErrorMessage>{error}</ErrorMessage>}
            {success && <SuccessMessage>{success}</SuccessMessage>}
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                onClick={handleReveal}
                disabled={!!revealingTaskId || !revealData || !password}
              >
                {revealingTaskId ? '揭示中...' : '确认揭示'}
              </Button>
              <Button
                onClick={() => {
                  setShowRevealModal(false);
                  setSelectedTask(null);
                  setRevealData('');
                  setPassword('');
                }}
                style={{ background: '#999' }}
              >
                取消
              </Button>
            </div>
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
});

