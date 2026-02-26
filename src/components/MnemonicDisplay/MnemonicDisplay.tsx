/**
 * 助记词显示组件
 * 
 * 功能：
 * 1. 默认隐藏助记词，点击按钮显示
 * 2. 显示时增加醒目安全警告
 * 3. 支持倒计时自动隐藏（可选）
 * 
 * 安全特性：
 * - 默认隐藏，避免屏幕录制/截图泄露
 * - 显示时明确警告禁止截图/录屏/分享
 * - 支持一次性显示（显示后自动隐藏）
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  margin-bottom: 24px;
`;

const WarningBox = styled.div`
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #856404;
  
  strong {
    display: block;
    margin-bottom: 8px;
    font-size: 16px;
  }
  
  ul {
    margin: 8px 0 0 0;
    padding-left: 20px;
  }
  
  li {
    margin-bottom: 4px;
  }
`;

const MnemonicContainer = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 24px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.8;
  word-break: break-all;
  text-align: center;
  border: 2px solid #ffc107;
  position: relative;
`;

const ShowButton = styled.button`
  width: 100%;
  background: #4c6ef5;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 16px 24px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 16px;
  
  &:hover {
    background: #3b5bdb;
  }
  
  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const HideButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  color: #666;
  
  &:hover {
    background: #fff;
    border-color: #999;
  }
`;

const CountdownText = styled.div`
  text-align: center;
  font-size: 12px;
  color: #666;
  margin-top: 8px;
`;

interface MnemonicDisplayProps {
  /** 助记词短语 */
  mnemonic: string;
  /** 是否启用倒计时自动隐藏（秒数，0表示不启用） */
  autoHideSeconds?: number;
  /** 是否显示安全警告 */
  showWarning?: boolean;
  /** 自定义警告文本 */
  customWarning?: React.ReactNode;
}

/**
 * 助记词显示组件
 * 
 * 默认隐藏助记词，点击按钮显示，显示时增加安全警告
 */
export const MnemonicDisplay: React.FC<MnemonicDisplayProps> = ({
  mnemonic,
  autoHideSeconds = 0,
  showWarning = true,
  customWarning,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (isVisible && autoHideSeconds > 0) {
      setCountdown(autoHideSeconds);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setIsVisible(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isVisible, autoHideSeconds]);

  const handleShow = () => {
    setIsVisible(true);
    if (autoHideSeconds > 0) {
      setCountdown(autoHideSeconds);
    }
  };

  const handleHide = () => {
    setIsVisible(false);
    setCountdown(0);
  };

  const defaultWarning = (
    <WarningBox>
      <strong>⚠️ 安全警告</strong>
      <ul>
        <li>请勿截图、录屏或分享此助记词</li>
        <li>请勿在联网设备上存储助记词</li>
        <li>请使用纸质方式离线备份助记词</li>
        <li>助记词泄露将导致资产永久丢失</li>
      </ul>
    </WarningBox>
  );

  return (
    <Container>
      {!isVisible ? (
        <>
          {showWarning && (customWarning || defaultWarning)}
          <ShowButton onClick={handleShow}>
            🔒 点击显示助记词
          </ShowButton>
        </>
      ) : (
        <>
          {showWarning && (customWarning || defaultWarning)}
          <MnemonicContainer>
            <HideButton onClick={handleHide}>隐藏</HideButton>
            {mnemonic}
            {autoHideSeconds > 0 && countdown > 0 && (
              <CountdownText>
                {countdown}秒后自动隐藏
              </CountdownText>
            )}
          </MnemonicContainer>
        </>
      )}
    </Container>
  );
};
