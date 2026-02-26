/**
 * 路径A升级提示对话框
 * 
 * 当路径A用户（SIMPLE）的守护人数量达到3个时，提示升级到路径B（STANDARD）
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { accountManager } from '@/services/AccountManager';
import { keyManagerService } from '@/services/KeyManagerService';
import { ErrorHandler } from '@/utils/errors';
import type { Address } from 'viem';

const UpgradeContent = styled.div`
  padding: 20px;
`;

const UpgradeTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
`;

const UpgradeDescription = styled.p`
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 16px;
`;

const BenefitsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 16px 0;
`;

const BenefitItem = styled.li`
  font-size: 14px;
  color: #333;
  padding: 8px 0;
  padding-left: 24px;
  position: relative;

  &:before {
    content: '✓';
    position: absolute;
    left: 0;
    color: #28a745;
    font-weight: 600;
  }
`;

const WarningBox = styled.div`
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 12px;
  margin: 16px 0;
  font-size: 14px;
  color: #856404;
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

interface PathAUpgradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accountAddress: Address;
  chainId: number;
  onUpgradeSuccess?: () => void;
}

export const PathAUpgradeDialog: React.FC<PathAUpgradeDialogProps> = ({
  isOpen,
  onClose,
  accountAddress,
  chainId,
  onUpgradeSuccess,
}) => {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpgrade = async () => {
    if (!password) {
      setError('请输入密码');
      return;
    }

    setIsUpgrading(true);
    setError(null);
    setSuccess(null);

    try {
      await accountManager.init();

      // 获取账户信息
      const account = await accountManager.getAccountByAddress(accountAddress, chainId);
      if (!account) {
        throw new Error('账户不存在');
      }

      // 获取签名者私钥
      const ownerAddress = account.owner as Address;
      const signerPrivateKey = await keyManagerService.getPrivateKey(ownerAddress, password);

      if (!signerPrivateKey) {
        throw new Error('无法获取签名者私钥，请检查密码');
      }

      // 执行升级
      await accountManager.upgradePathA(accountAddress, chainId, false, signerPrivateKey);

      setSuccess('升级成功！您的账户已从 SIMPLE 升级到 STANDARD。');
      
      // 延迟关闭对话框，让用户看到成功消息
      setTimeout(() => {
        if (onUpgradeSuccess) {
          onUpgradeSuccess();
        }
        onClose();
      }, 2000);
    } catch (err) {
      setError(ErrorHandler.handleAndShow(err));
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleClose = () => {
    if (!isUpgrading) {
      setPassword('');
      setError(null);
      setSuccess(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="升级到标准账户"
    >
      <UpgradeContent>
        <UpgradeTitle>🎉 恭喜！您已达到升级条件</UpgradeTitle>
        
        <UpgradeDescription>
          您的账户现在有 3 个或更多守护人，可以升级到标准账户（STANDARD），获得更多功能。
        </UpgradeDescription>

        <BenefitsList>
          <BenefitItem>可以创建 EOA 账户，自主支付 Gas</BenefitItem>
          <BenefitItem>获得完整的账户管理功能</BenefitItem>
          <BenefitItem>支持更多高级功能</BenefitItem>
          <BenefitItem>更好的账户安全性</BenefitItem>
        </BenefitsList>

        <WarningBox>
          ⚠️ 升级后，您的账户类型将从 SIMPLE 变为 STANDARD，此操作不可逆。
        </WarningBox>

        {!success && (
          <>
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                请输入密码以确认升级
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                disabled={isUpgrading}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                }}
              />
            </div>
            {error && <ErrorMessage>{error}</ErrorMessage>}
          </>
        )}

        {success && <SuccessMessage>{success}</SuccessMessage>}

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          {!success && (
            <>
              <Button
                variant="secondary"
                onClick={handleClose}
                disabled={isUpgrading}
              >
                稍后升级
              </Button>
              <Button
                onClick={handleUpgrade}
                disabled={!password || isUpgrading}
              >
                {isUpgrading ? '升级中...' : '立即升级'}
              </Button>
            </>
          )}
          {success && (
            <Button onClick={handleClose}>
              确定
            </Button>
          )}
        </div>
      </UpgradeContent>
    </Modal>
  );
};
