/**
 * 发送交易页面
 * 
 * 参考 Keplr 钱包的交易页面设计，但代码完全独立实现
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { useNavigate } from 'react-router-dom';
import { transactionRelayer, FallbackModeError } from '@/services/TransactionRelayer';
import { tokenService, TokenInfo } from '@/services/TokenService';
import { keyManagerService } from '@/services/KeyManagerService';
import { ErrorHandler } from '@/utils/errors';
import { encodeFunctionData, parseAbi } from 'viem';
import type { UserOperation } from '@/utils/kernel-types';
import { FallbackModeDialog } from '@/components/FallbackModeDialog';
import { rpcClientManager } from '@/utils/RpcClientManager';
import { requireChainConfig } from '@/utils/chainConfigValidation';
import { parsePositiveAmountToUnits, validateEvmAddress } from '@/utils/pathFlowValidation';
import { trimInputValue } from '@/utils/formValidation';

const Container = styled.div`
  max-width: 600px;
  margin: 0 auto;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 16px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #1a1a1a;
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

const Button = styled.button`
  width: 100%;
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

const ErrorMessage = styled.div`
  color: #e03131;
  font-size: 14px;
  margin-top: 8px;
`;

const Select = styled.select`
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  margin-bottom: 16px;
  background: #ffffff;

  &:focus {
    outline: none;
    border-color: #4c6ef5;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  margin-bottom: 8px;
`;

const GasSettings = styled.div`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
`;

const GasInput = styled(Input)`
  margin-bottom: 8px;
`;

const InfoText = styled.p`
  font-size: 12px;
  color: #666;
  margin-top: 4px;
`;

const PreviewBox = styled.div`
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
  background: #f8f9fa;
  font-size: 13px;
`;

const PreviewRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  gap: 8px;
  word-break: break-all;
`;

// ERC-20 transfer ABI
const ERC20_TRANSFER_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
]);

interface PendingFallbackTransaction {
  accountAddress: string;
  chainId: number;
  target: `0x${string}`;
  callData: string;
  ownerPrivateKey: `0x${string}`;
  signerPrivateKey: `0x${string}`;
  value: bigint;
  historyTo: string;
  historyValue: bigint;
  historyType: 'transfer' | 'contract';
}

export const SendTransactionPage = observer(() => {
  const { accountStore } = useStore();
  const navigate = useNavigate();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<'native' | string>('native');
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [showGasSettings, setShowGasSettings] = useState(false);
  const [maxFeePerGas, setMaxFeePerGas] = useState('');
  const [maxPriorityFeePerGas, setMaxPriorityFeePerGas] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [preview, setPreview] = useState<{ userOp: UserOperation; estimatedFee: bigint } | null>(null);
  const [showFallbackDialog, setShowFallbackDialog] = useState(false);
  const [fallbackEstimatedGas, setFallbackEstimatedGas] = useState(0n);
  const [fallbackGasPrice, setFallbackGasPrice] = useState(0n);
  const [fallbackAccountBalance, setFallbackAccountBalance] = useState(0n);
  const [pendingTransaction, setPendingTransaction] =
    useState<PendingFallbackTransaction | null>(null);

  useEffect(() => {
    // 表单变化时清理预览，避免展示过期数据
    setPreview(null);
  }, [to, amount, selectedToken, accountStore.currentAccount]);

  useEffect(() => {
    loadTokens();
    // 仅在当前账户切换时加载代币列表
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountStore.currentAccount]);

  const loadTokens = async () => {
    if (!accountStore.currentAccount) return;
    
    try {
      const chainTokens = await tokenService.getTokens(accountStore.currentAccount.chainId);
      setTokens(chainTokens);
    } catch (error) {
      console.error('加载代币列表失败:', error);
    }
  };

  const buildTransactionPayload = () => {
    if (!accountStore.currentAccount) {
      throw new Error('请先选择账户');
    }

    const recipient = trimInputValue(to);
    const recipientError = validateEvmAddress(recipient, '收款地址');
    if (recipientError) {
      throw new Error(recipientError);
    }

    let callData: string;
    let value: bigint = BigInt(0);
    let target: `0x${string}`;

    if (selectedToken === 'native') {
      // 原生代币转账
      value = parsePositiveAmountToUnits(amount, 18, '转账金额');
      callData = '0x';
      target = recipient as `0x${string}`;
    } else {
      // ERC-20 代币转账
      const token = tokens.find((t) => t.address.toLowerCase() === selectedToken.toLowerCase());
      if (!token) {
        throw new Error('未找到代币信息');
      }

      const amountWei = parsePositiveAmountToUnits(amount, token.decimals, '转账金额');
      callData = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, amountWei],
      });
      target = selectedToken as `0x${string}`;
    }

    return { target, callData, value, recipient };
  };

  const handlePreview = async () => {
    if (!accountStore.currentAccount) {
      setError('请先选择账户');
      return;
    }

    setIsPreviewing(true);
    setError(null);

    try {
      const { target, callData, value } = buildTransactionPayload();
      const result = await transactionRelayer.previewTransaction(
        accountStore.currentAccount.address as `0x${string}`,
        accountStore.currentAccount.chainId,
        target,
        callData,
        value
      );
      setPreview(result);
      setShowPasswordInput(false);
    } catch (err) {
      setPreview(null);
      setError(ErrorHandler.handleAndShow(err));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSend = async () => {
    const passwordValue = trimInputValue(password);
    if (!passwordValue) {
      setShowPasswordInput(true);
      setError('请输入密码以解锁私钥');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      if (!accountStore.currentAccount) {
        throw new Error('请先选择账户');
      }

      // 从安全存储获取签名者私钥
      const ownerAddress = accountStore.currentAccount.owner as `0x${string}`;
      const signerPrivateKey = await keyManagerService.getPrivateKey(ownerAddress, passwordValue);

      if (!signerPrivateKey) {
        setError('无法获取签名者私钥，请检查密码');
        setShowPasswordInput(true);
        setIsSending(false);
        return;
      }

      const { target, callData, value, recipient } = buildTransactionPayload();
      const historyTo = selectedToken === 'native' ? recipient : selectedToken;
      const historyValue = selectedToken === 'native' ? value : BigInt(0);
      const historyType: 'transfer' | 'contract' = selectedToken === 'native' ? 'transfer' : 'contract';

      try {
        // 构造转账数据
        const txHash = await transactionRelayer.sendTransaction(
          accountStore.currentAccount.address as `0x${string}`,
          accountStore.currentAccount.chainId,
          target,
          callData,
          signerPrivateKey as `0x${string}`,
          value
        );

        // 记录交易历史
        const { transactionHistoryService } = await import('@/services/TransactionHistoryService');
        await transactionHistoryService.addTransaction({
          hash: txHash,
          chainId: accountStore.currentAccount.chainId,
          from: accountStore.currentAccount.address,
          to: historyTo,
          value: historyValue,
          status: 'pending',
          timestamp: Date.now(),
          type: historyType,
          data: callData,
        });

        ErrorHandler.showSuccess(`交易已发送，交易哈希: ${txHash}`);
        console.log('交易哈希:', txHash);
        
        // 清空表单
        setTo('');
        setAmount('');
        setPassword('');
        setShowPasswordInput(false);
        setPreview(null);
        
        // 跳转到交易历史页面
        navigate('/transactions');
      } catch (fallbackError) {
        // 检查是否是降级模式错误
        if (fallbackError instanceof FallbackModeError) {
          // 获取账户余额和 Gas 价格
          requireChainConfig(accountStore.currentAccount.chainId, ['rpcUrl']);

          const publicClient = rpcClientManager.getPublicClient(accountStore.currentAccount.chainId);
          const [balance, gasPrice] = await Promise.all([
            publicClient.getBalance({ address: accountStore.currentAccount.address as `0x${string}` }),
            publicClient.getGasPrice(),
          ]);

          // 保存待处理的交易信息
          setPendingTransaction({
            accountAddress: accountStore.currentAccount.address,
            chainId: accountStore.currentAccount.chainId,
            target,
            callData,
            ownerPrivateKey: signerPrivateKey as `0x${string}`,
            signerPrivateKey: signerPrivateKey as `0x${string}`, // 使用同一个私钥
            value,
            historyTo,
            historyValue,
            historyType,
          });

          // 显示降级模式对话框
          setFallbackEstimatedGas(fallbackError.estimatedGas);
          setFallbackGasPrice(gasPrice);
          setFallbackAccountBalance(balance);
          setShowFallbackDialog(true);
          setIsSending(false);
          return;
        }
        // 其他错误继续抛出
        throw fallbackError;
      }

    } catch (err) {
      setError(ErrorHandler.handleAndShow(err));
      console.error('交易发送失败:', err);
    } finally {
      setIsSending(false);
    }
  };

  /**
   * 处理降级模式确认
   */
  const handleFallbackConfirm = async () => {
    if (!pendingTransaction || !accountStore.currentAccount) {
      setError('交易信息丢失，请重新发送');
      setShowFallbackDialog(false);
      return;
    }

    setIsSending(true);
    setShowFallbackDialog(false);

    try {
      // 使用降级模式发送交易
      const txHash = await transactionRelayer.sendTransactionWithFallback(
        pendingTransaction.accountAddress as `0x${string}`,
        pendingTransaction.chainId,
        pendingTransaction.target as `0x${string}`,
        pendingTransaction.callData,
        pendingTransaction.ownerPrivateKey,
        pendingTransaction.signerPrivateKey,
        pendingTransaction.value
      );

      // 记录交易历史
      const { transactionHistoryService } = await import('@/services/TransactionHistoryService');
      await transactionHistoryService.addTransaction({
        hash: txHash,
        chainId: pendingTransaction.chainId,
        from: pendingTransaction.accountAddress,
        to: pendingTransaction.historyTo,
        value: pendingTransaction.historyValue,
        status: 'pending',
        timestamp: Date.now(),
        type: pendingTransaction.historyType,
        data: pendingTransaction.callData,
      });

      ErrorHandler.showSuccess(`交易已发送（降级模式），交易哈希: ${txHash}`);
      console.log('交易哈希（降级模式）:', txHash);
      
      // 清空表单和状态
      setTo('');
      setAmount('');
      setPassword('');
      setShowPasswordInput(false);
      setPreview(null);
      setPendingTransaction(null);
      
      // 跳转到交易历史页面
      navigate('/transactions');
    } catch (err) {
      setError(ErrorHandler.handleAndShow(err));
      console.error('降级模式交易失败:', err);
    } finally {
      setIsSending(false);
    }
  };

  /**
   * 处理降级模式取消
   */
  const handleFallbackCancel = () => {
    setShowFallbackDialog(false);
    setPendingTransaction(null);
    setError('已取消降级模式发送');
  };

  if (!accountStore.currentAccount) {
    return (
      <Container>
        <Card>
          <Title>未选择账户</Title>
          <p>请先创建或导入账户</p>
          <Button onClick={() => navigate('/wallet/create')}>去创建账户</Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Card>
        <Title>发送交易</Title>

        {showPasswordInput && (
          <Input
            type="password"
            placeholder="请输入密码以解锁私钥"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSending}
          />
        )}

        <Input
          type="text"
          placeholder="收款地址 (0x...)"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={isSending}
        />

        <Label>代币类型</Label>
        <Select
          value={selectedToken}
          onChange={(e) => setSelectedToken(e.target.value)}
          disabled={isSending}
        >
          <option value="native">原生代币 (ETH/MNT)</option>
          {tokens.map((token) => (
            <option key={token.address} value={token.address}>
              {token.symbol} - {token.name}
            </option>
          ))}
        </Select>

        <Input
          type="text"
          placeholder="金额"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isSending}
        />

        <button
          type="button"
          onClick={() => setShowGasSettings(!showGasSettings)}
          style={{
            background: 'none',
            border: 'none',
            color: '#4c6ef5',
            cursor: 'pointer',
            fontSize: '14px',
            marginBottom: '16px',
            textDecoration: 'underline',
          }}
        >
          {showGasSettings ? '隐藏' : '显示'} Gas 设置
        </button>

        {showGasSettings && (
          <GasSettings>
            <Label>Max Fee Per Gas (Gwei)</Label>
            <GasInput
              type="text"
              placeholder="自动估算"
              value={maxFeePerGas}
              onChange={(e) => setMaxFeePerGas(e.target.value)}
              disabled={isSending}
            />
            <InfoText>留空将使用自动估算的 Gas 价格</InfoText>

            <Label>Max Priority Fee Per Gas (Gwei)</Label>
            <GasInput
              type="text"
              placeholder="自动估算"
              value={maxPriorityFeePerGas}
              onChange={(e) => setMaxPriorityFeePerGas(e.target.value)}
              disabled={isSending}
            />
            <InfoText>留空将使用自动估算的优先费用</InfoText>
          </GasSettings>
        )}

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <Button onClick={handlePreview} disabled={isPreviewing || isSending}>
          {isPreviewing ? '预览中...' : '预览交易'}
        </Button>

        {preview && (
          <PreviewBox>
            <PreviewRow>
              <span>预估费用</span>
              <strong>{preview.estimatedFee.toString()} wei</strong>
            </PreviewRow>
            <PreviewRow>
              <span>CallGasLimit</span>
              <span>{preview.userOp.callGasLimit.toString()}</span>
            </PreviewRow>
            <PreviewRow>
              <span>VerificationGasLimit</span>
              <span>{preview.userOp.verificationGasLimit.toString()}</span>
            </PreviewRow>
            <PreviewRow>
              <span>PreVerificationGas</span>
              <span>{preview.userOp.preVerificationGas.toString()}</span>
            </PreviewRow>
            <PreviewRow>
              <span>Paymaster</span>
              <span>{preview.userOp.paymasterAndData === '0x' ? '未启用' : preview.userOp.paymasterAndData.slice(0, 42)}</span>
            </PreviewRow>
          </PreviewBox>
        )}

        <Button onClick={handleSend} disabled={isSending || !password}>
          {isSending ? '发送中...' : '发送交易'}
        </Button>
      </Card>

      {/* 降级模式确认对话框 */}
      <FallbackModeDialog
        open={showFallbackDialog}
        estimatedGas={fallbackEstimatedGas}
        gasPrice={fallbackGasPrice}
        accountBalance={fallbackAccountBalance}
        onConfirm={handleFallbackConfirm}
        onCancel={handleFallbackCancel}
      />
    </Container>
  );
});
