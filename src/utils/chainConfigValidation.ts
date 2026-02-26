import { getChainConfigByChainId } from '@/config/chains';
import type { ChainConfig } from '@/types';

export type RequiredChainField =
  | 'rpcUrl'
  | 'bundlerUrl'
  | 'paymasterAddress'
  | 'kernelFactoryAddress'
  | 'entryPointAddress'
  | 'multiChainValidatorAddress'
  | 'recoveryPluginAddress';

const FIELD_LABEL: Record<RequiredChainField, string> = {
  rpcUrl: 'RPC 节点 URL',
  bundlerUrl: 'Bundler URL',
  paymasterAddress: 'Paymaster 地址',
  kernelFactoryAddress: 'Kernel Factory 地址',
  entryPointAddress: 'EntryPoint 地址',
  multiChainValidatorAddress: 'MultiChainValidator 地址',
  recoveryPluginAddress: 'Recovery Plugin 地址',
};

const FIELD_ENV_SUFFIX: Record<RequiredChainField, string> = {
  rpcUrl: 'RPC_URL',
  bundlerUrl: 'BUNDLER_URL',
  paymasterAddress: 'PAYMASTER_ADDRESS',
  kernelFactoryAddress: 'KERNEL_FACTORY_ADDRESS',
  entryPointAddress: 'ENTRYPOINT_ADDRESS',
  multiChainValidatorAddress: 'MULTI_CHAIN_VALIDATOR_ADDRESS',
  recoveryPluginAddress: 'RECOVERY_PLUGIN_ADDRESS',
};

function getEnvPrefix(chainName: string): string {
  return chainName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export function ensureChainConfigFields(
  chainConfig: ChainConfig,
  requiredFields: RequiredChainField[]
): ChainConfig {
  for (const field of requiredFields) {
    const value = chainConfig[field];
    if (typeof value !== 'string' || value.trim() === '') {
      const envVar = `VITE_${getEnvPrefix(chainConfig.name)}_${FIELD_ENV_SUFFIX[field]}`;
      throw new Error(
        `${FIELD_LABEL[field]} 未配置（当前链：${chainConfig.name}，Chain ID: ${chainConfig.chainId}）。请检查环境变量 ${envVar}`
      );
    }
  }
  return chainConfig;
}

export function requireChainConfig(
  chainId: number,
  requiredFields: RequiredChainField[] = []
): ChainConfig {
  const chainConfig = getChainConfigByChainId(chainId);
  if (!chainConfig) {
    throw new Error(`链配置未找到（Chain ID: ${chainId}）。请检查网络选择或链配置。`);
  }
  return ensureChainConfigFields(chainConfig, requiredFields);
}

export function getChainNativeSymbol(chainId: number, fallback: string = 'ETH'): string {
  try {
    return requireChainConfig(chainId).nativeCurrency.symbol;
  } catch {
    return fallback;
  }
}
