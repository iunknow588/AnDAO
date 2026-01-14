/**
 * 欢迎页面
 * 
 * 三路径账户创建的统一入口
 * 提供三种不同的账户创建路径选择：
 * - 路径A：极简体验（无EOA用户）
 * - 路径B：标准模式（有EOA用户）
 * - 路径C：成为赞助商
 * 
 * 设计参考：参考Keplr钱包的欢迎页面设计风格
 * 
 * @module pages/WelcomePage
 */

import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { AccountCreationPath } from '@/types';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
  text-align: center;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: #666;
  margin-bottom: 48px;
  text-align: center;
`;

const PathsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  width: 100%;
  max-width: 1000px;
`;

const PathCard = styled.div`
  background: #ffffff;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  position: relative;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    border-color: #4c6ef5;
  }
`;

const PathIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  text-align: center;
`;

const PathTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 12px;
  text-align: center;
`;

const PathDescription = styled.div`
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 16px;
  
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    
    li {
      margin-bottom: 8px;
      padding-left: 20px;
      position: relative;
      
      &:before {
        content: '•';
        position: absolute;
        left: 0;
        color: #4c6ef5;
      }
    }
  }
`;

const Badge = styled.span`
  display: inline-block;
  background: #4c6ef5;
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
  position: absolute;
  top: 16px;
  right: 16px;
`;

const Footer = styled.div`
  margin-top: 48px;
  text-align: center;
  color: #999;
  font-size: 14px;
`;

/**
 * 欢迎页面组件
 * 
 * 显示三种账户创建路径的卡片，用户可以选择其中一种路径
 */
export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();

  /**
   * 处理路径选择
   * 
   * 根据选择的路径，导航到对应的创建页面
   */
  const handlePathSelect = (path: AccountCreationPath) => {
    switch (path) {
      case AccountCreationPath.PATH_A_SIMPLE:
        navigate('/wallet/create/path-a');
        break;
      case AccountCreationPath.PATH_B_STANDARD:
        navigate('/wallet/create/path-b');
        break;
      case AccountCreationPath.PATH_C_SPONSOR:
        navigate('/wallet/create/path-c');
        break;
      default:
        console.error('Unknown path:', path);
    }
  };

  return (
    <Container>
      <Title>欢迎使用 AnDao Wallet</Title>
      <Subtitle>智能合约钱包，让Web3更简单</Subtitle>

      <PathsContainer>
        {/* 路径A：极简体验 */}
        <PathCard onClick={() => handlePathSelect(AccountCreationPath.PATH_A_SIMPLE)}>
          <Badge>最受欢迎</Badge>
          <PathIcon>🚀</PathIcon>
          <PathTitle>极简体验（推荐新手）</PathTitle>
          <PathDescription>
            <ul>
              <li>直接创建智能合约账户</li>
              <li>无需现有钱包或Gas代币</li>
              <li>赞助商代付Gas费用</li>
              <li>适合Web3新手用户</li>
            </ul>
          </PathDescription>
        </PathCard>

        {/* 路径B：标准模式 */}
        <PathCard onClick={() => handlePathSelect(AccountCreationPath.PATH_B_STANDARD)}>
          <PathIcon>⚡</PathIcon>
          <PathTitle>标准模式</PathTitle>
          <PathDescription>
            <ul>
              <li>创建或导入EOA钱包</li>
              <li>作为控制者创建智能合约账户</li>
              <li>灵活支付Gas方式</li>
              <li>适合有经验的用户</li>
            </ul>
          </PathDescription>
        </PathCard>

        {/* 路径C：成为赞助商 */}
        <PathCard onClick={() => handlePathSelect(AccountCreationPath.PATH_C_SPONSOR)}>
          <PathIcon>💎</PathIcon>
          <PathTitle>成为赞助商</PathTitle>
          <PathDescription>
            <ul>
              <li>帮助他人创建账户</li>
              <li>可设置审核规则和渠道</li>
              <li>需要EOA账户支付Gas</li>
              <li>适合想要参与生态的用户</li>
            </ul>
          </PathDescription>
        </PathCard>
      </PathsContainer>

      <Footer>
        选择一种方式开始您的Web3之旅
      </Footer>
    </Container>
  );
};
