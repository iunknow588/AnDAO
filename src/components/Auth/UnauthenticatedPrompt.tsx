import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { WALLET_USER_USE_CASES } from '@/services/walletUserUseCases';

const Card = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h2`
  margin: 0 0 10px;
  font-size: 20px;
  color: #1a1a1a;
`;

const Description = styled.p`
  margin: 0 0 16px;
  color: #555;
  line-height: 1.6;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
  flex-wrap: wrap;
`;

const Button = styled.button<{ $secondary?: boolean }>`
  background: ${(props) => (props.$secondary ? '#ffffff' : '#4c6ef5')};
  color: ${(props) => (props.$secondary ? '#4c6ef5' : '#ffffff')};
  border: 1px solid #4c6ef5;
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
`;

const SecurityBox = styled.div`
  border: 1px solid #ffd8a8;
  background: #fff4e6;
  color: #8f4e00;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 18px;
  font-size: 13px;
  line-height: 1.6;
`;

const UseCaseGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
`;

const UseCaseCard = styled.div`
  border: 1px solid #e9ecef;
  border-radius: 10px;
  padding: 12px;
`;

const UseCaseTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 14px;
  color: #1a1a1a;
`;

const UseCaseText = styled.p`
  margin: 0 0 6px;
  font-size: 13px;
  color: #555;
  line-height: 1.5;
`;

interface UnauthenticatedPromptProps {
  isFirstLogin: boolean;
}

export const UnauthenticatedPrompt: React.FC<UnauthenticatedPromptProps> = ({ isFirstLogin }) => {
  const navigate = useNavigate();

  return (
    <Card>
      <Title>{isFirstLogin ? '检测到未注册钱包' : '钱包已锁定或未登录'}</Title>
      <Description>
        {isFirstLogin
          ? '请先注册钱包再继续。若已有账户可直接登录解锁。'
          : '继续操作前请先登录；若是首次使用，请先注册钱包。'}
      </Description>

      <ActionRow>
        <Button onClick={() => navigate('/wallet/unlock')}>登录</Button>
        <Button $secondary onClick={() => navigate('/welcome')}>注册</Button>
      </ActionRow>

      <SecurityBox>
        注册与首次设置时，请务必保护好密码与私钥。不要截图、不要通过聊天工具发送、不要泄露给任何人。
      </SecurityBox>

      <UseCaseGrid>
        {WALLET_USER_USE_CASES.map((item) => (
          <UseCaseCard key={item.userType}>
            <UseCaseTitle>{item.title}</UseCaseTitle>
            <UseCaseText>{item.summary}</UseCaseText>
            <UseCaseText>{item.loginHint}</UseCaseText>
            <UseCaseText>{item.registerHint}</UseCaseText>
          </UseCaseCard>
        ))}
      </UseCaseGrid>
    </Card>
  );
};

