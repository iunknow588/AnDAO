/**
 * 插件管理页面
 * 
 * 管理 ERC-7579 插件的安装、卸载和配置
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/stores';
import { pluginService } from '@/services/PluginService';
import { keyManagerService } from '@/services/KeyManagerService';
import { IPlugin, PluginType } from '@/types/plugins';
import { ErrorHandler } from '@/utils/errors';
import { validateEvmAddress } from '@/utils/pathFlowValidation';
import { trimInputValue } from '@/utils/formValidation';
import type { Address } from 'viem';

const Container = styled.div`
  max-width: 800px;
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

const PluginList = styled.div`
  margin-top: 16px;
`;

const PluginItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 12px;
`;

const PluginInfo = styled.div`
  flex: 1;
`;

const PluginName = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
`;

const PluginDescription = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 4px;
`;

const PluginAddress = styled.div`
  font-family: monospace;
  font-size: 12px;
  color: #999;
  word-break: break-all;
`;

const StatusBadge = styled.span<{ installed: boolean }>`
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  background: ${(props) => (props.installed ? '#2f9e44' : '#999')};
  color: #ffffff;
  margin-right: 12px;
`;

const Button = styled.button`
  background: #4c6ef5;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  margin-left: 8px;

  &:hover {
    background: #3b5bdb;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const DangerButton = styled(Button)`
  background: #e03131;

  &:hover {
    background: #c92a2a;
  }
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

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #999;
`;

const getPluginTypeName = (type: PluginType): string => {
  const typeMap: Record<PluginType, string> = {
    [PluginType.VALIDATOR]: '验证器',
    [PluginType.EXECUTOR]: '执行器',
    [PluginType.FALLBACK]: '回退',
    [PluginType.HOOK]: '钩子',
    [PluginType.POLICY]: '策略',
    [PluginType.SIGNER]: '签名器',
  };
  return typeMap[type] || '未知';
};

export const PluginsPage = observer(() => {
  const { accountStore } = useStore();
  const [plugins, setPlugins] = useState<IPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newPluginAddress, setNewPluginAddress] = useState('');
  const [newPluginType, setNewPluginType] = useState<PluginType>(PluginType.EXECUTOR);
  const [isInstalling, setIsInstalling] = useState<string | null>(null);
  const [isUninstalling, setIsUninstalling] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const currentAccount = accountStore.currentAccount;
  const currentChainId = currentAccount?.chainId || 0;

  useEffect(() => {
    if (currentAccount) {
      loadPlugins();
    }
    // 仅在账户切换时刷新插件列表
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount]);

  const loadPlugins = async () => {
    if (!currentAccount) return;

    setIsLoading(true);
    setError(null);

    try {
      await pluginService.init(currentAccount.address as Address, currentChainId);
      const list = pluginService.getAllPlugins();
      setPlugins(list);
    } catch (err) {
      setError(ErrorHandler.handleAndShow(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallPlugin = async (plugin: IPlugin) => {
    if (!currentAccount) {
      setError('请先选择账户');
      return;
    }

    const passwordValue = trimInputValue(password);
    if (!passwordValue) {
      setShowPasswordInput(true);
      setError('请输入密码以解锁私钥');
      return;
    }

    setIsInstalling(plugin.id);
    setError(null);
    setSuccess(null);

    try {
      const ownerAddress = currentAccount.owner as Address;
      const signerPrivateKey = await keyManagerService.getPrivateKey(ownerAddress, passwordValue);

      if (!signerPrivateKey) {
        setError('无法获取签名者私钥，请检查密码');
        setShowPasswordInput(true);
        return;
      }

      const txHash = await pluginService.installPlugin(
        currentAccount.address as Address,
        currentChainId,
        plugin,
        {},
        signerPrivateKey
      );

      setSuccess(`插件安装成功，交易哈希: ${txHash}`);
      setPassword('');
      setShowPasswordInput(false);
      await loadPlugins();
    } catch (err) {
      setError(ErrorHandler.handleAndShow(err));
    } finally {
      setIsInstalling(null);
    }
  };

  const handleUninstallPlugin = async (plugin: IPlugin) => {
    if (!currentAccount) {
      setError('请先选择账户');
      return;
    }

    const passwordValue = trimInputValue(password);
    if (!passwordValue) {
      setShowPasswordInput(true);
      setError('请输入密码以解锁私钥');
      return;
    }

    setIsUninstalling(plugin.id);
    setError(null);
    setSuccess(null);

    try {
      const ownerAddress = currentAccount.owner as Address;
      const signerPrivateKey = await keyManagerService.getPrivateKey(ownerAddress, passwordValue);

      if (!signerPrivateKey) {
        setError('无法获取签名者私钥，请检查密码');
        setShowPasswordInput(true);
        return;
      }

      const txHash = await pluginService.uninstallPlugin(
        currentAccount.address as Address,
        currentChainId,
        plugin.id,
        signerPrivateKey
      );

      setSuccess(`插件卸载成功，交易哈希: ${txHash}`);
      setPassword('');
      setShowPasswordInput(false);
      await loadPlugins();
    } catch (err) {
      setError(ErrorHandler.handleAndShow(err));
    } finally {
      setIsUninstalling(null);
    }
  };

  const handleAddPlugin = () => {
    const pluginAddressValue = trimInputValue(newPluginAddress);
    const pluginAddressError = validateEvmAddress(pluginAddressValue, '插件地址');
    if (pluginAddressError) {
      setError(pluginAddressError);
      return;
    }

    const plugin: IPlugin = {
      id: `plugin-${pluginAddressValue.toLowerCase()}`,
      name: `Plugin ${pluginAddressValue.slice(0, 10)}...`,
      type: newPluginType,
      address: pluginAddressValue as Address,
      version: '1.0.0',
      installed: false,
    };

    pluginService.registerPlugin(plugin);
    setNewPluginAddress('');
    loadPlugins();
  };

  if (!currentAccount) {
    return (
      <Container>
        <Title>插件管理</Title>
        <Card>
          <EmptyState>请先创建或导入账户</EmptyState>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Title>插件管理</Title>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      <Card>
        <SectionTitle>添加插件</SectionTitle>
        <Input
          type="text"
          placeholder="插件合约地址 (0x...)"
          value={newPluginAddress}
          onChange={(e) => setNewPluginAddress(e.target.value)}
        />
        <select
          value={newPluginType}
          onChange={(e) => setNewPluginType(Number(e.target.value) as PluginType)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '16px',
            marginBottom: '16px',
          }}
        >
          {Object.values(PluginType)
            .filter((v) => typeof v === 'number')
            .map((type) => (
              <option key={type} value={type}>
                {getPluginTypeName(type as PluginType)}
              </option>
            ))}
        </select>
        <Button onClick={handleAddPlugin} disabled={!newPluginAddress}>
          添加插件
        </Button>
      </Card>

      {showPasswordInput && (
        <Card>
          <SectionTitle>输入密码</SectionTitle>
          <Input
            type="password"
            placeholder="请输入密码以解锁私钥"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Card>
      )}

      <Card>
        <SectionTitle>已安装的插件</SectionTitle>
        {isLoading ? (
          <EmptyState>加载中...</EmptyState>
        ) : plugins.filter((p) => p.installed).length === 0 ? (
          <EmptyState>暂无已安装的插件</EmptyState>
        ) : (
          <PluginList>
            {plugins
              .filter((p) => p.installed)
              .map((plugin) => (
                <PluginItem key={plugin.id}>
                  <PluginInfo>
                    <PluginName>{plugin.name}</PluginName>
                    <PluginDescription>{plugin.description || '无描述'}</PluginDescription>
                    <PluginAddress>{plugin.address}</PluginAddress>
                  </PluginInfo>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <StatusBadge installed={plugin.installed}>已安装</StatusBadge>
                    <DangerButton
                      onClick={() => handleUninstallPlugin(plugin)}
                      disabled={isUninstalling === plugin.id || !!isInstalling}
                    >
                      {isUninstalling === plugin.id ? '卸载中...' : '卸载'}
                    </DangerButton>
                  </div>
                </PluginItem>
              ))}
          </PluginList>
        )}
      </Card>

      <Card>
        <SectionTitle>可用插件</SectionTitle>
        {isLoading ? (
          <EmptyState>加载中...</EmptyState>
        ) : plugins.filter((p) => !p.installed).length === 0 ? (
          <EmptyState>暂无可用插件</EmptyState>
        ) : (
          <PluginList>
            {plugins
              .filter((p) => !p.installed)
              .map((plugin) => (
                <PluginItem key={plugin.id}>
                  <PluginInfo>
                    <PluginName>{plugin.name}</PluginName>
                    <PluginDescription>{plugin.description || '无描述'}</PluginDescription>
                    <PluginAddress>{plugin.address}</PluginAddress>
                  </PluginInfo>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <StatusBadge installed={plugin.installed}>未安装</StatusBadge>
                    <Button
                      onClick={() => handleInstallPlugin(plugin)}
                      disabled={isInstalling === plugin.id || !!isUninstalling || !password}
                    >
                      {isInstalling === plugin.id ? '安装中...' : '安装'}
                    </Button>
                  </div>
                </PluginItem>
              ))}
          </PluginList>
        )}
      </Card>
    </Container>
  );
});
