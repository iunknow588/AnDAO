/**
 * 全局错误边界组件
 * 
 * 捕获 React 组件树中的错误，提供友好的错误提示
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import styled from 'styled-components';
import { ErrorHandler } from '@/utils/errors';
import { monitoringService } from '@/services/MonitoringService';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background: #f8f9fa;
`;

const ErrorCard = styled.div`
  max-width: 600px;
  width: 100%;
  background: #ffffff;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: #e03131;
  margin-bottom: 16px;
`;

const Message = styled.p`
  font-size: 16px;
  color: #495057;
  margin-bottom: 24px;
  line-height: 1.6;
`;

const Details = styled.details`
  margin-bottom: 24px;
  
  summary {
    cursor: pointer;
    font-size: 14px;
    color: #868e96;
    margin-bottom: 8px;
    
    &:hover {
      color: #495057;
    }
  }
  
  pre {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 16px;
    font-size: 12px;
    color: #212529;
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
  }
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

  &:not(:last-child) {
    margin-right: 12px;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误
    ErrorHandler.logError(error, 'ErrorBoundary');
    
    // 保存错误信息
    this.setState({
      error,
      errorInfo,
    });

    // 发送错误到监控服务（如果已启用）
    monitoringService.captureException(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    // 调用自定义错误处理
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误界面
      const errorMessage = this.state.error
        ? ErrorHandler.handleError(this.state.error)
        : '发生未知错误';

      return (
        <Container>
          <ErrorCard>
            <Title>出错了</Title>
            <Message>{errorMessage}</Message>
            
            {this.state.errorInfo && (
              <Details>
                <summary>查看错误详情</summary>
                <pre>
                  {this.state.error?.stack}
                  {'\n\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </Details>
            )}

            <ButtonGroup>
              <Button onClick={this.handleReset}>重试</Button>
              <Button onClick={this.handleReload}>刷新页面</Button>
            </ButtonGroup>
          </ErrorCard>
        </Container>
      );
    }

    return this.props.children;
  }
}

