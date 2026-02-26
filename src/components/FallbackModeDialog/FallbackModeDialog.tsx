/**
 * 降级模式确认对话框
 * 
 * 当所有 Bundler 不可用时，提示用户可以选择降级模式（自付 Gas）
 * 
 * @module components/FallbackModeDialog
 */

import React from 'react';
import styled from 'styled-components';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { formatEther } from 'viem';

const Container = styled.div`
  padding: 24px;
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
`;

const WarningIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #fff3cd;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  font-size: 24px;
`;

const Message = styled.p`
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 16px;
`;

const InfoBox = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
`;

const InfoTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
`;

const InfoList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const InfoItem = styled.li`
  font-size: 13px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 4px;
  padding-left: 16px;
  position: relative;

  &::before {
    content: '•';
    position: absolute;
    left: 0;
    color: #4c6ef5;
  }
`;

const GasInfo = styled.div`
  background: #e7f5ff;
  border: 1px solid #4c6ef5;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
`;

const GasLabel = styled.div`
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
`;

const GasValue = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #4c6ef5;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;
`;

export interface FallbackModeDialogProps {
  /** 是否显示对话框 */
  open: boolean;
  /** 估算的 Gas 费用（wei） */
  estimatedGas: bigint;
  /** 当前 Gas 价格（wei） */
  gasPrice: bigint;
  /** 账户余额（wei） */
  accountBalance: bigint;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

/**
 * 降级模式确认对话框组件
 */
export const FallbackModeDialog: React.FC<FallbackModeDialogProps> = ({
  open,
  estimatedGas,
  gasPrice,
  accountBalance,
  onConfirm,
  onCancel,
}) => {
  // 计算估算费用
  const estimatedFee = estimatedGas * gasPrice;
  const estimatedFeeEth = formatEther(estimatedFee);
  const accountBalanceEth = formatEther(accountBalance);
  const hasEnoughBalance = accountBalance >= estimatedFee;

  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      title=""
    >
      <Container>
        <WarningIcon>⚠️</WarningIcon>
        <Title>Bundler 服务不可用</Title>
        <Message>
          所有 Bundler 服务当前不可用。您可以选择自付 Gas 直接发送交易。
        </Message>

        <InfoBox>
          <InfoTitle>降级模式说明：</InfoTitle>
          <InfoList>
            <InfoItem>直接调用 EntryPoint 合约发送交易</InfoItem>
            <InfoItem>需要账户有足够的余额支付 Gas 费用</InfoItem>
            <InfoItem>交易确认时间可能较长</InfoItem>
            <InfoItem>如果账户余额不足，交易将失败</InfoItem>
          </InfoList>
        </InfoBox>

        <GasInfo>
          <GasLabel>估算 Gas 费用</GasLabel>
          <GasValue>{estimatedFeeEth} ETH</GasValue>
        </GasInfo>

        {!hasEnoughBalance && (
          <InfoBox style={{ background: '#fff3cd', border: '1px solid #ffc107' }}>
            <InfoTitle style={{ color: '#856404' }}>余额不足</InfoTitle>
            <Message style={{ color: '#856404', margin: 0 }}>
              账户余额 ({accountBalanceEth} ETH) 不足以支付估算的 Gas 费用 ({estimatedFeeEth} ETH)。
              请先充值后再试。
            </Message>
          </InfoBox>
        )}

        <ButtonGroup>
          <Button
            variant="secondary"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            取消
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={!hasEnoughBalance}
            style={{ flex: 1 }}
          >
            确认发送（自付 Gas）
          </Button>
        </ButtonGroup>
      </Container>
    </Modal>
  );
};
