import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  isAddress,
  parseEther,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

type EnvMap = Record<string, string>;

const APPLICATION_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'getSponsor',
    stateMutability: 'view',
    inputs: [{ name: 'sponsorAddress', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'sponsorAddress', type: 'address' },
          { name: 'gasAccountAddress', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'storageType', type: 'uint8' },
          { name: 'isActive', type: 'bool' },
          { name: 'registeredAt', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'registerSponsor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sponsorAddress', type: 'address' },
      { name: 'gasAccountAddress', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'storageType', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setSponsorContractWhitelist',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'targetContracts', type: 'address[]' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setSponsorUserWhitelist',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'users', type: 'address[]' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'canSponsorFor',
    stateMutability: 'view',
    inputs: [
      { name: 'sponsorAddress', type: 'address' },
      { name: 'targetContractAddress', type: 'address' },
      { name: 'ownerAddress', type: 'address' },
      { name: 'eoaAddress', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

interface SponsorInfoTuple {
  sponsorAddress: Address;
  gasAccountAddress: Address;
  name: string;
  description: string;
  storageType: number;
  isActive: boolean;
  registeredAt: bigint;
}

function loadEnvFile(filePath: string): EnvMap {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const envMap: EnvMap = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const index = trimmed.indexOf('=');
    if (index <= 0) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    envMap[key] = value;
  }
  return envMap;
}

function loadMergedEnv(cwd: string): EnvMap {
  const extraEnvFile = process.env.SPONSOR_E2E_ENV_FILE?.trim();
  const defaultSponsorEnv = path.join(cwd, '.env.sponsor-e2e.local');
  const extraEnv = extraEnvFile
    ? loadEnvFile(path.isAbsolute(extraEnvFile) ? extraEnvFile : path.join(cwd, extraEnvFile))
    : loadEnvFile(defaultSponsorEnv);

  return {
    ...loadEnvFile(path.join(cwd, '.env.example')),
    ...loadEnvFile(path.join(cwd, '.env.local')),
    ...loadEnvFile(path.join(cwd, 'env.local')),
    ...extraEnv,
  };
}

function pickEnv(env: EnvMap, key: string, fallback = ''): string {
  const fromProcess = process.env[key];
  if (fromProcess && fromProcess.trim()) {
    return fromProcess.trim();
  }
  const fromFile = env[key];
  if (fromFile && fromFile.trim()) {
    return fromFile.trim();
  }
  return fallback;
}

function requireAddress(value: string, name: string): Address {
  if (!isAddress(value)) {
    throw new Error(`${name} is not a valid address: ${value}`);
  }
  return value as Address;
}

function parseOptionalAddress(value: string): Address | null {
  if (!value) {
    return null;
  }
  if (!isAddress(value)) {
    throw new Error(`Invalid optional address: ${value}`);
  }
  return value as Address;
}

function parseBoolean(value: string, fallback = false): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function tryResolveRegistryFromBroadcast(cwd: string, chainId: number): string {
  try {
    const runLatest = path.join(
      cwd,
      'smart-services',
      'broadcast',
      'DeployApplicationRegistry.s.sol',
      String(chainId),
      'run-latest.json'
    );
    if (!fs.existsSync(runLatest)) {
      return '';
    }
    const raw = fs.readFileSync(runLatest, 'utf8');
    const json = JSON.parse(raw) as {
      transactions?: Array<{
        contractAddress?: string;
        contractName?: string;
        transactionType?: string;
      }>;
    };
    const tx = (json.transactions || []).find((item) => {
      return (
        item.transactionType === 'CREATE' &&
        typeof item.contractAddress === 'string' &&
        (item.contractName === 'ApplicationRegistry' || item.contractName === undefined)
      );
    });
    return tx?.contractAddress || '';
  } catch {
    return '';
  }
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const fileEnv = loadMergedEnv(cwd);

  const chainId = Number(pickEnv(fileEnv, 'SPONSOR_E2E_CHAIN_ID', '43113'));
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(`Invalid SPONSOR_E2E_CHAIN_ID: ${chainId}`);
  }
  const rpcUrl = pickEnv(
    fileEnv,
    'SPONSOR_E2E_RPC_URL',
    pickEnv(fileEnv, 'VITE_AVALANCHE_FUJI_RPC_URL', 'https://api.avax-test.network/ext/bc/C/rpc')
  );
  const registryFallback =
    pickEnv(fileEnv, 'VITE_APPLICATION_REGISTRY_ADDRESS') ||
    tryResolveRegistryFromBroadcast(cwd, chainId);
  const registryAddress = requireAddress(
    pickEnv(fileEnv, 'SPONSOR_E2E_APPLICATION_REGISTRY_ADDRESS', registryFallback),
    'SPONSOR_E2E_APPLICATION_REGISTRY_ADDRESS'
  );
  const sponsorPrivateKey = pickEnv(fileEnv, 'SPONSOR_E2E_SPONSOR_PRIVATE_KEY') as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(sponsorPrivateKey)) {
    throw new Error('SPONSOR_E2E_SPONSOR_PRIVATE_KEY is required and must be 32-byte hex');
  }
  const targetContractAddress = requireAddress(
    pickEnv(fileEnv, 'SPONSOR_E2E_TARGET_CONTRACT_ADDRESS'),
    'SPONSOR_E2E_TARGET_CONTRACT_ADDRESS'
  );
  const sentinelContractAddress = requireAddress(
    pickEnv(
      fileEnv,
      'SPONSOR_E2E_SENTINEL_CONTRACT_ADDRESS',
      '0x1000000000000000000000000000000000000001'
    ),
    'SPONSOR_E2E_SENTINEL_CONTRACT_ADDRESS'
  );
  const ownerAddress = requireAddress(
    pickEnv(fileEnv, 'SPONSOR_E2E_OWNER_ADDRESS'),
    'SPONSOR_E2E_OWNER_ADDRESS'
  );
  const sentinelOwnerAddress = requireAddress(
    pickEnv(
      fileEnv,
      'SPONSOR_E2E_SENTINEL_OWNER_ADDRESS',
      '0x2000000000000000000000000000000000000002'
    ),
    'SPONSOR_E2E_SENTINEL_OWNER_ADDRESS'
  );
  const eoaAddress =
    parseOptionalAddress(pickEnv(fileEnv, 'SPONSOR_E2E_EOA_ADDRESS')) ||
    '0x0000000000000000000000000000000000000000';
  const autoRegisterSponsor = parseBoolean(
    pickEnv(fileEnv, 'SPONSOR_E2E_AUTO_REGISTER'),
    false
  );
  if (targetContractAddress.toLowerCase() === sentinelContractAddress.toLowerCase()) {
    throw new Error('target contract address must be different from sentinel contract address');
  }
  if (ownerAddress.toLowerCase() === sentinelOwnerAddress.toLowerCase()) {
    throw new Error('owner address must be different from sentinel owner address');
  }

  const account = privateKeyToAccount(sponsorPrivateKey);
  const sponsorAddress = account.address;
  const chain = defineChain({
    id: chainId,
    name: `sponsor-e2e-${chainId}`,
    nativeCurrency: {
      name: 'Native',
      symbol: 'NATIVE',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    chain,
    account,
    transport: http(rpcUrl),
  });

  const [balance, blockNumber] = await Promise.all([
    publicClient.getBalance({ address: sponsorAddress }),
    publicClient.getBlockNumber(),
  ]);
  console.log(`[context] chainId=${chainId}`);
  console.log(`[context] rpc=${rpcUrl}`);
  console.log(`[context] registry=${registryAddress}`);
  console.log(`[context] sponsor=${sponsorAddress}`);
  console.log(`[context] balance=${formatEther(balance)} native`);
  console.log(`[context] blockNumber=${blockNumber}`);
  if (balance < parseEther('0.001')) {
    throw new Error('Sponsor account balance is too low for on-chain writes');
  }

  const sponsorInfo = (await publicClient.readContract({
    address: registryAddress,
    abi: APPLICATION_REGISTRY_ABI,
    functionName: 'getSponsor',
    args: [sponsorAddress],
  })) as SponsorInfoTuple;

  if (!sponsorInfo.isActive) {
    if (!autoRegisterSponsor) {
      throw new Error(
        'Sponsor is not active on chain. Set SPONSOR_E2E_AUTO_REGISTER=true to register automatically.'
      );
    }
    console.log('[step] sponsor is inactive, registering sponsor on chain...');
    const registerTx = await walletClient.writeContract({
      address: registryAddress,
      abi: APPLICATION_REGISTRY_ABI,
      functionName: 'registerSponsor',
      args: [sponsorAddress, sponsorAddress, 'E2E Sponsor', 'auto registered by e2e script', 0],
      account,
      chain,
    });
    console.log(`[tx] registerSponsor => ${registerTx}`);
    await publicClient.waitForTransactionReceipt({ hash: registerTx });
  }

  const checkGate = async (label: string): Promise<boolean> => {
    const allowed = await publicClient.readContract({
      address: registryAddress,
      abi: APPLICATION_REGISTRY_ABI,
      functionName: 'canSponsorFor',
      args: [sponsorAddress, targetContractAddress, ownerAddress, eoaAddress],
    });
    console.log(`[gate] ${label}: canSponsorFor=${allowed}`);
    return Boolean(allowed);
  };

  console.log('[step] baseline gate check');
  await checkGate('before-write');

  console.log('[step] add contract whitelist and user whitelist (with sentinel entries)');
  const addContractTx = await walletClient.writeContract({
    address: registryAddress,
    abi: APPLICATION_REGISTRY_ABI,
    functionName: 'setSponsorContractWhitelist',
    args: [[targetContractAddress, sentinelContractAddress], true],
    account,
    chain,
  });
  console.log(`[tx] setSponsorContractWhitelist(allow=true) => ${addContractTx}`);
  await publicClient.waitForTransactionReceipt({ hash: addContractTx });

  const addUserTx = await walletClient.writeContract({
    address: registryAddress,
    abi: APPLICATION_REGISTRY_ABI,
    functionName: 'setSponsorUserWhitelist',
    args: [[ownerAddress, sentinelOwnerAddress], true],
    account,
    chain,
  });
  console.log(`[tx] setSponsorUserWhitelist(allow=true) => ${addUserTx}`);
  await publicClient.waitForTransactionReceipt({ hash: addUserTx });

  const allowedAfterAdd = await checkGate('after-add');
  if (!allowedAfterAdd) {
    throw new Error('Expected canSponsorFor=true after whitelist add');
  }

  console.log('[step] remove target entries and verify gate blocked (sentinel remains)');
  const removeUserTx = await walletClient.writeContract({
    address: registryAddress,
    abi: APPLICATION_REGISTRY_ABI,
    functionName: 'setSponsorUserWhitelist',
    args: [[ownerAddress], false],
    account,
    chain,
  });
  console.log(`[tx] setSponsorUserWhitelist(allow=false) => ${removeUserTx}`);
  await publicClient.waitForTransactionReceipt({ hash: removeUserTx });

  const removeContractTx = await walletClient.writeContract({
    address: registryAddress,
    abi: APPLICATION_REGISTRY_ABI,
    functionName: 'setSponsorContractWhitelist',
    args: [[targetContractAddress], false],
    account,
    chain,
  });
  console.log(`[tx] setSponsorContractWhitelist(allow=false) => ${removeContractTx}`);
  await publicClient.waitForTransactionReceipt({ hash: removeContractTx });

  const allowedAfterRemove = await checkGate('after-remove');
  if (allowedAfterRemove) {
    throw new Error('Expected canSponsorFor=false after whitelist remove');
  }

  console.log('[step] cleanup sentinel entries');
  const cleanupUserTx = await walletClient.writeContract({
    address: registryAddress,
    abi: APPLICATION_REGISTRY_ABI,
    functionName: 'setSponsorUserWhitelist',
    args: [[sentinelOwnerAddress], false],
    account,
    chain,
  });
  console.log(`[tx] cleanup setSponsorUserWhitelist(sentinel, false) => ${cleanupUserTx}`);
  await publicClient.waitForTransactionReceipt({ hash: cleanupUserTx });

  const cleanupContractTx = await walletClient.writeContract({
    address: registryAddress,
    abi: APPLICATION_REGISTRY_ABI,
    functionName: 'setSponsorContractWhitelist',
    args: [[sentinelContractAddress], false],
    account,
    chain,
  });
  console.log(`[tx] cleanup setSponsorContractWhitelist(sentinel, false) => ${cleanupContractTx}`);
  await publicClient.waitForTransactionReceipt({ hash: cleanupContractTx });

  console.log('[result] Sponsor whitelist e2e passed.');
}

main().catch((error) => {
  console.error('[result] Sponsor whitelist e2e failed:', error);
  process.exit(1);
});
