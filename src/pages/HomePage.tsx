/**
 * 首页
 * 
 * 显示账户概览和快速操作
 * 根据用户类型显示不同的视图：
 * - 路径A（SIMPLE）：基础功能视图
 * - 路径B（STANDARD）：标准功能视图（支持EOA切换）
 * - 路径C（SPONSOR）：赞助商视图（包含仪表板入口）
 * 
 * @module pages/HomePage
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { useNavigate } from 'react-router-dom';
import { accountManager } from '@/services/AccountManager';
import { UserType } from '@/types';
import type { Address } from 'viem';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #1a1a1a;
`;

const Button = styled.button`
  background: #4c6ef5;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #3b5bdb;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const AddressDisplay = styled.div`
  font-family: monospace;
  font-size: 14px;
  color: #666;
  word-break: break-all;
  margin: 16px 0;
`;

export const HomePage = observer(() => {
  const { accountStore } = useStore();
  const navigate = useNavigate();
  
  const [userType, setUserType] = useState<UserType | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 加载账户的用户类型
   */
  useEffect(() => {
    const loadUserType = async () => {
      if (!accountStore.currentAccount) {
        setUserType(undefined);
        return;
      }

      try {
        setIsLoading(true);
        const account = await accountManager.getAccountByAddress(
          accountStore.currentAccount.address as Address,
          accountStore.currentAccount.chainId
        );
        
        if (account) {
          setUserType(account.userType);
        }
      } catch (error) {
        console.error('加载用户类型失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserType();
  }, [accountStore.currentAccount]);

  const handleCreateAccount = () => {
    navigate('/welcome');
  };

  const handleSendTransaction = () => {
    navigate('/send');
  };

  const handlePathConversion = () => {
    navigate('/path-conversion');
  };

  const handleSponsorDashboard = () => {
    navigate('/sponsor/dashboard');
  };

  /**
   * 渲染路径A（SIMPLE）视图
   */
  const renderSimpleView = () => (
    <>
      <Card>
        <h2>账户信息</h2>
        <AddressDisplay>
          <strong>地址:</strong> {accountStore.currentAccountAddress}
        </AddressDisplay>
        <AddressDisplay>
          <strong>链 ID:</strong> {accountStore.currentAccount?.chainId}
        </AddressDisplay>
        <AddressDisplay>
          <strong>账户类型:</strong> 极简模式（路径A）
        </AddressDisplay>
      </Card>

      <Card>
        <h2>快速操作</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          <Button onClick={handleSendTransaction}>发送交易</Button>
          <Button onClick={() => navigate('/assets')}>资产管理</Button>
          <Button onClick={() => navigate('/guardians')}>守护人管理</Button>
          <Button onClick={handlePathConversion}>路径转换</Button>
        </div>
      </Card>

      <Card>
        <h3>路径转换提示</h3>
        <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
          您可以转换到其他路径类型：
          <br />
          • 转换为路径B：添加EOA账户，使用自己的Gas代币
          <br />
          • 转换为路径C：成为赞助商，帮助他人创建账户
        </p>
        <Button onClick={handlePathConversion} style={{ marginTop: '12px' }}>
          立即转换
        </Button>
      </Card>
    </>
  );

  /**
   * 渲染路径B（STANDARD）视图
   */
  const renderStandardView = () => (
    <>
      <Card>
        <h2>账户信息</h2>
        <AddressDisplay>
          <strong>智能合约地址:</strong> {accountStore.currentAccountAddress}
        </AddressDisplay>
        <AddressDisplay>
          <strong>链 ID:</strong> {accountStore.currentAccount?.chainId}
        </AddressDisplay>
        <AddressDisplay>
          <strong>账户类型:</strong> 标准模式（路径B）
        </AddressDisplay>
        {accountStore.currentAccount?.eoaAddress && (
          <AddressDisplay>
            <strong>EOA地址:</strong> {accountStore.currentAccount.eoaAddress}
          </AddressDisplay>
        )}
      </Card>

      <Card>
        <h2>快速操作</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          <Button onClick={handleSendTransaction}>发送交易</Button>
          <Button onClick={() => navigate('/assets')}>资产管理</Button>
          <Button onClick={() => navigate('/guardians')}>守护人管理</Button>
          <Button onClick={handlePathConversion}>转换为赞助商</Button>
        </div>
      </Card>

      <Card>
        <h3>账户切换器</h3>
        <p style={{ fontSize: '14px', color: '#666' }}>
          您可以在智能合约账户和EOA账户之间切换使用
        </p>
      </Card>
    </>
  );

  /**
   * 渲染路径C（SPONSOR）视图
   */
  const renderSponsorView = () => (
    <>
      <Card>
        <h2>账户信息</h2>
        <AddressDisplay>
          <strong>智能合约地址:</strong> {accountStore.currentAccountAddress}
        </AddressDisplay>
        <AddressDisplay>
          <strong>链 ID:</strong> {accountStore.currentAccount?.chainId}
        </AddressDisplay>
        <AddressDisplay>
          <strong>账户类型:</strong> 赞助商模式（路径C）
        </AddressDisplay>
        {accountStore.currentAccount?.sponsorId && (
          <AddressDisplay>
            <strong>赞助商ID:</strong> {accountStore.currentAccount.sponsorId}
          </AddressDisplay>
        )}
      </Card>

      <Card>
        <h2>快速操作</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          <Button onClick={handleSponsorDashboard} style={{ background: '#28a745' }}>
            赞助商仪表板
          </Button>
          <Button onClick={handleSendTransaction}>发送交易</Button>
          <Button onClick={() => navigate('/assets')}>资产管理</Button>
          <Button onClick={() => navigate('/guardians')}>守护人管理</Button>
        </div>
      </Card>

      <Card>
        <h3>赞助商功能</h3>
        <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
          作为赞助商，您可以：
          <br />
          • 审核申请并代付Gas费用
          <br />
          • 管理您的渠道和审核规则
          <br />
          • 查看申请统计和数据分析
        </p>
        <Button onClick={handleSponsorDashboard} style={{ marginTop: '12px', background: '#28a745' }}>
          进入仪表板
        </Button>
      </Card>
    </>
  );

  return (
    <Container>
      <Title>AnDaoWallet</Title>

      {isLoading ? (
        <Card>
          <p>加载中...</p>
        </Card>
      ) : accountStore.currentAccount ? (
        <>
          {userType === UserType.SIMPLE && renderSimpleView()}
          {userType === UserType.STANDARD && renderStandardView()}
          {userType === UserType.SPONSOR && renderSponsorView()}
          {!userType && (
            <>
              <Card>
                <h2>账户信息</h2>
                <AddressDisplay>
                  <strong>地址:</strong> {accountStore.currentAccountAddress}
                </AddressDisplay>
                <AddressDisplay>
                  <strong>链 ID:</strong> {accountStore.currentAccount.chainId}
                </AddressDisplay>
              </Card>

              <Card>
                <h2>快速操作</h2>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <Button onClick={handleSendTransaction}>发送交易</Button>
                </div>
              </Card>
            </>
          )}
        </>
      ) : (
        <Card>
          <h2>欢迎使用 AnDaoWallet</h2>
          <p>创建一个智能合约账户开始使用</p>
          <Button onClick={handleCreateAccount} style={{ marginTop: '16px' }}>
            创建账户
          </Button>
        </Card>
      )}
    </Container>
  );
});
