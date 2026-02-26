/**
 * 恢复流程页面
 * 
 * 社交恢复流程，包括发起恢复请求和守护人投票
 */

import { useState } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { guardianService } from '@/services/GuardianService';
import { keyManagerService } from '@/services/KeyManagerService';
import { ErrorHandler } from '@/utils/errors';
import { validateEvmAddress } from '@/utils/pathFlowValidation';
import { trimInputFields, trimInputValue, validateRequiredFields } from '@/utils/formValidation';
import type { Address } from 'viem';

const Container = styled.div`
  max-width: 600px;
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
  margin-bottom: 12px;

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

const WarningBox = styled(InfoBox)`
  background: #fff3cd;
  border-color: #ffc107;
`;

export const RecoveryPage = observer(() => {
  const { accountStore } = useStore();
  const [accountAddress, setAccountAddress] = useState('');
  const [newOwnerAddress, setNewOwnerAddress] = useState('');
  const [isInitiating, setIsInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [generatedKeyAddress, setGeneratedKeyAddress] = useState<string | null>(null);
  const [voteAccountAddress, setVoteAccountAddress] = useState('');
  const [recoveryId, setRecoveryId] = useState('');
  const [guardianPassword, setGuardianPassword] = useState('');
  const [isVoting, setIsVoting] = useState(false);

  const currentAccount = accountStore.currentAccount;
  const currentChainId = currentAccount?.chainId || 0;

  const handleInitiateRecovery = async () => {
    const normalizedFields = trimInputFields({
      accountAddress,
      newOwnerAddress,
      password,
    });
    const accountAddressValue = normalizedFields.accountAddress;
    const newOwnerAddressValue = normalizedFields.newOwnerAddress;
    const passwordValue = normalizedFields.password;

    const requiredError = validateRequiredFields(
      [
        { value: accountAddressValue, label: '账户地址' },
        { value: newOwnerAddressValue, label: '新所有者地址' },
      ],
      '请填写所有字段'
    );
    if (requiredError) {
      setError(requiredError);
      return;
    }

    const accountAddressError = validateEvmAddress(accountAddressValue, '账户地址');
    if (accountAddressError) {
      setError(accountAddressError);
      return;
    }

    const newOwnerAddressError = validateEvmAddress(newOwnerAddressValue, '新所有者地址');
    if (newOwnerAddressError) {
      setError(newOwnerAddressError);
      return;
    }

    if (!passwordValue) {
      setError('请输入密码以解锁私钥');
      return;
    }

    setIsInitiating(true);
    setError(null);
    setSuccess(null);

    try {
      // 从安全存储获取签名者私钥
      // 注意：恢复流程中，可能需要使用守护人的私钥，这里简化处理
      const signerAddress = accountAddressValue as Address;
      const signerPrivateKey = await keyManagerService.getPrivateKey(signerAddress, passwordValue);

      if (!signerPrivateKey) {
        setError('无法获取签名者私钥，请检查密码');
        return;
      }

      // initiateRecovery 返回 { recoveryId, txHash }，同时在本地缓存恢复请求
      const { recoveryId: createdRecoveryId, txHash } = await guardianService.initiateRecovery(
        accountAddressValue as Address,
        currentChainId,
        newOwnerAddressValue as Address,
        undefined,
        signerPrivateKey
      );

      // 将生成的恢复请求 ID 预填到“守护人投票”区域，便于后续操作
      setRecoveryId(createdRecoveryId);

      setSuccess(`恢复请求已发起，恢复ID: ${createdRecoveryId}，交易哈希: ${txHash}`);
      setAccountAddress('');
      setNewOwnerAddress('');
    } catch (err) {
      setError(ErrorHandler.handleAndShow(err));
    } finally {
      setIsInitiating(false);
    }
  };

  /**
   * 生成新的所有者密钥并安全保存，便于恢复后立即使用
   */
  const handleGenerateNewKey = async () => {
    setError(null);
    setSuccess(null);

    const newOwnerPasswordValue = trimInputValue(newOwnerPassword);
    if (!newOwnerPasswordValue) {
      setError('请设置新密钥的加密密码');
      return;
    }

    setIsGeneratingKey(true);
    try {
      const { address, privateKey } = await keyManagerService.generatePrivateKey();
      await keyManagerService.savePrivateKey(address as Address, privateKey, newOwnerPasswordValue);
      setNewOwnerAddress(address);
      setGeneratedKeyAddress(address);
      setSuccess(`已生成新的所有者密钥，地址：${address}`);
    } catch (err) {
      setError(ErrorHandler.handleAndShow(err));
    } finally {
      setIsGeneratingKey(false);
    }
  };

  /**
   * 守护人投票支持恢复请求
   *
   * 技术路径：
   * 1. 当前钱包中的账户即为守护人账户（guardianAddress = currentAccount.owner/address）
   * 2. 通过 guardianPassword 从本地安全存储中解密出守护人的私钥
   * 3. 调用 GuardianService.voteForRecovery，内部根据私钥推导守护人地址并发送交易到恢复插件
   * 4. 恢复插件在链上根据当前守护人列表和投票记录统计是否已满足“超过一半守护人同意”的多数规则
   */
  const handleGuardianVote = async () => {
    if (!currentAccount) {
      setError('请先选择守护人账户');
      return;
    }

    const normalizedFields = trimInputFields({
      voteAccountAddress,
      recoveryId,
      guardianPassword,
    });
    const voteAccountAddressValue = normalizedFields.voteAccountAddress;
    const recoveryIdValue = normalizedFields.recoveryId;
    const guardianPasswordValue = normalizedFields.guardianPassword;

    const requiredError = validateRequiredFields([
      { value: voteAccountAddressValue, label: '要恢复的账户地址' },
      { value: recoveryIdValue, label: '恢复请求编号' },
    ]);
    if (requiredError) {
      setError(requiredError);
      return;
    }

    const voteAccountAddressError = validateEvmAddress(voteAccountAddressValue, '要恢复的账户地址');
    if (voteAccountAddressError) {
      setError(voteAccountAddressError);
      return;
    }

    if (!guardianPasswordValue) {
      setError('请输入守护人账户的密码');
      return;
    }

    setIsVoting(true);
    setError(null);
    setSuccess(null);

    try {
      // 从安全存储获取守护人私钥（使用当前账户的 owner 地址）
      const guardianOwnerAddress = currentAccount.owner as Address;
      const guardianPrivateKey = await keyManagerService.getPrivateKey(
        guardianOwnerAddress,
        guardianPasswordValue
      );

      if (!guardianPrivateKey) {
        setError('无法解锁守护人私钥，请检查密码');
        return;
      }

      const txHash = await guardianService.voteForRecovery(
        voteAccountAddressValue as Address,
        currentChainId,
        recoveryIdValue,
        guardianPrivateKey
      );

      setSuccess(`投票已提交，交易哈希：${txHash}`);
      setGuardianPassword('');
    } catch (err) {
      setError(ErrorHandler.handleAndShow(err));
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <Container>
      <Title>账户恢复</Title>

      <WarningBox>
        <strong>重要提示：</strong>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>账户恢复需要守护人投票确认</li>
          <li>请确保新所有者地址正确，恢复后原所有者将失去控制权</li>
          <li>恢复过程可能需要一些时间，请耐心等待</li>
        </ul>
      </WarningBox>

      <Card>
        <SectionTitle>发起恢复请求</SectionTitle>
        <InfoBox>
          如果您丢失了账户的私钥，可以通过守护人投票来恢复账户控制权。
          当超过一半的守护人同意恢复时，恢复插件会在链上自动完成恢复，账户的所有权将转移给新的所有者地址。
        </InfoBox>

        <Input
          type="text"
          placeholder="要恢复的账户地址 (0x...)"
          value={accountAddress}
          onChange={(e) => setAccountAddress(e.target.value)}
          disabled={isInitiating}
        />

        <Input
          type="text"
          placeholder="新所有者地址 (0x...)"
          value={newOwnerAddress}
          onChange={(e) => setNewOwnerAddress(e.target.value)}
          disabled={isInitiating}
        />

        <Input
          type="password"
          placeholder="请输入密码以解锁私钥"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isInitiating}
        />

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {success && <SuccessMessage>{success}</SuccessMessage>}

        <Button
          onClick={handleInitiateRecovery}
          disabled={isInitiating || !accountAddress || !newOwnerAddress || !password}
        >
          {isInitiating ? '发起中...' : '发起恢复请求'}
        </Button>
      </Card>

      <Card>
        <SectionTitle>生成新的所有者密钥</SectionTitle>
        <InfoBox>
          建议在恢复前生成新的所有者密钥并加密保存，确保恢复完成后立即拥有可用的控制密钥。
        </InfoBox>

        <Input
          type="password"
          placeholder="设置新密钥的保存密码"
          value={newOwnerPassword}
          onChange={(e) => setNewOwnerPassword(e.target.value)}
          disabled={isGeneratingKey}
        />

        {generatedKeyAddress && (
          <SuccessMessage>新密钥已保存，地址：{generatedKeyAddress}</SuccessMessage>
        )}

        <Button onClick={handleGenerateNewKey} disabled={isGeneratingKey}>
          {isGeneratingKey ? '生成中...' : '生成并保存新密钥'}
        </Button>
      </Card>

      <Card>
        <SectionTitle>守护人投票</SectionTitle>
        <InfoBox>
          如果您是账户的守护人，可以在此投票支持或反对恢复请求。
          当支持恢复的守护人数超过当前守护人总数的一半时（多数守护人同意），恢复将被执行。
        </InfoBox>
        <Input
          type="text"
          placeholder="要恢复的账户地址 (0x...)"
          value={voteAccountAddress}
          onChange={(e) => setVoteAccountAddress(e.target.value)}
          disabled={isVoting}
        />
        <Input
          type="text"
          placeholder="恢复请求ID（例如 recovery_xxx 或链上 bytes32）"
          value={recoveryId}
          onChange={(e) => setRecoveryId(e.target.value)}
          disabled={isVoting}
        />
        <Input
          type="password"
          placeholder="守护人账户密码（用于解锁私钥）"
          value={guardianPassword}
          onChange={(e) => setGuardianPassword(e.target.value)}
          disabled={isVoting}
        />
        <Button
          onClick={handleGuardianVote}
          disabled={
            isVoting ||
            !voteAccountAddress ||
            !recoveryId ||
            !guardianPassword ||
            !currentAccount
          }
        >
          {isVoting ? '投票中...' : '以当前账户身份投票支持恢复'}
        </Button>
      </Card>
    </Container>
  );
});
