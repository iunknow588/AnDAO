/**
 * 助记词验证组件
 * 
 * 功能：
 * 1. 随机抽取2-3个位置
 * 2. 要求用户输入对应单词
 * 3. 验证通过后才能继续
 * 
 * 安全特性：
 * - 确保用户真正记住或正确备份了助记词
 * - 防止用户直接勾选复选框而不备份
 */

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';

const Container = styled.div`
  margin-bottom: 24px;
`;

const Title = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
`;

const Description = styled.p`
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
`;

const VerificationItem = styled.div`
  margin-bottom: 16px;
`;

const PositionLabel = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 8px;
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

const InfoBox = styled.div`
  background: #e7f5ff;
  border: 1px solid #4c6ef5;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #1a1a1a;
`;

interface MnemonicVerificationProps {
  /** 助记词数组（12或24个单词） */
  mnemonicWords: string[];
  /** 验证通过回调 */
  onVerified: () => void;
  /** 验证位置数量（默认3个） */
  verificationCount?: number;
}

/**
 * 助记词验证组件
 * 
 * 随机抽取2-3个位置，要求用户输入对应单词，验证通过后才能继续
 */
export const MnemonicVerification: React.FC<MnemonicVerificationProps> = ({
  mnemonicWords,
  onVerified,
  verificationCount = 3,
}) => {
  // 随机选择验证位置（在组件初始化时生成，保持不变）
  const verificationPositions = useMemo(() => {
    const positions: number[] = [];
    const totalWords = mnemonicWords.length;
    const count = Math.min(verificationCount, Math.floor(totalWords / 2)); // 最多选择一半的位置
    
    while (positions.length < count) {
      const pos = Math.floor(Math.random() * totalWords);
      if (!positions.includes(pos)) {
        positions.push(pos);
      }
    }
    
    return positions.sort((a, b) => a - b); // 按位置排序
  }, [mnemonicWords.length, verificationCount]);

  const [userInputs, setUserInputs] = useState<{ [position: number]: string }>({});
  const [errors, setErrors] = useState<{ [position: number]: string }>({});
  const [isVerified, setIsVerified] = useState(false);

  // 初始化用户输入
  useEffect(() => {
    const inputs: { [position: number]: string } = {};
    verificationPositions.forEach((pos) => {
      inputs[pos] = '';
    });
    setUserInputs(inputs);
  }, [verificationPositions]);

  const handleInputChange = (position: number, value: string) => {
    setUserInputs((prev) => ({
      ...prev,
      [position]: value.trim().toLowerCase(),
    }));
    
    // 清除该位置的错误
    if (errors[position]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[position];
        return newErrors;
      });
    }
  };

  const validateInputs = (): boolean => {
    const newErrors: { [position: number]: string } = {};
    let isValid = true;

    verificationPositions.forEach((pos) => {
      const userInput = userInputs[pos]?.trim().toLowerCase();
      const correctWord = mnemonicWords[pos]?.toLowerCase();

      if (!userInput) {
        newErrors[pos] = '请输入单词';
        isValid = false;
      } else if (userInput !== correctWord) {
        newErrors[pos] = '单词不正确';
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleVerify = () => {
    if (validateInputs()) {
      setIsVerified(true);
      onVerified();
    }
  };

  const getPositionText = (position: number): string => {
    const positionNames = [
      '第1个', '第2个', '第3个', '第4个', '第5个', '第6个',
      '第7个', '第8个', '第9个', '第10个', '第11个', '第12个',
      '第13个', '第14个', '第15个', '第16个', '第17个', '第18个',
      '第19个', '第20个', '第21个', '第22个', '第23个', '第24个',
    ];
    return positionNames[position] || `第${position + 1}个`;
  };

  const allInputsFilled = verificationPositions.every(
    (pos) => userInputs[pos]?.trim()
  );

  return (
    <Container>
      <Title>验证助记词</Title>
      <Description>
        为了确保您已正确备份助记词，请按照提示输入对应位置的单词。
      </Description>

      <InfoBox>
        <strong>提示：</strong>
        请根据助记词的位置，输入对应位置的单词。例如，如果提示"第3个单词"，
        请输入您备份的助记词中第3个位置的单词。
      </InfoBox>

      {verificationPositions.map((position) => (
        <VerificationItem key={position}>
          <PositionLabel>
            {getPositionText(position)}单词：
          </PositionLabel>
          <Input
            type="text"
            value={userInputs[position] || ''}
            onChange={(e) => handleInputChange(position, e.target.value)}
            placeholder={`请输入${getPositionText(position)}单词`}
            error={errors[position]}
            disabled={isVerified}
          />
        </VerificationItem>
      ))}

      {isVerified ? (
        <SuccessMessage>✅ 验证通过！您可以继续下一步。</SuccessMessage>
      ) : (
        <>
          {Object.keys(errors).length > 0 && (
            <ErrorMessage>
              请检查输入的单词是否正确
            </ErrorMessage>
          )}
          <Button
            onClick={handleVerify}
            disabled={!allInputsFilled || isVerified}
          >
            验证
          </Button>
        </>
      )}
    </Container>
  );
};
