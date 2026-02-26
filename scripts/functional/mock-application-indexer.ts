/**
 * Sponsor application indexer mock server
 *
 * 用于本地联调 VITE_APPLICATION_INDEXER_URL：
 * - GET /health
 * - GET /api/applications/by-sponsor?chainId=5003&sponsorAddress=0x...
 */

import { createServer } from 'node:http';

type JsonRecord = {
  applicationId: string;
  accountAddress: `0x${string}`;
  ownerAddress: `0x${string}`;
  eoaAddress: `0x${string}`;
  sponsorId: `0x${string}`;
  chainId: string;
  storageIdentifier: string;
  storageType: number;
  status: number;
  reviewStorageIdentifier: string;
  createdAt: string;
  reviewedAt: string;
  deployedAt: string;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const DEFAULT_SPONSOR = '0x1234567890123456789012345678901234567890';
const PORT = Number(process.env.INDEXER_PORT || 8787);
const HOST = process.env.INDEXER_HOST || '127.0.0.1';

const fixtures = new Map<string, JsonRecord[]>();

const defaultItems: JsonRecord[] = [
  {
    applicationId: 'app-mock-001',
    accountAddress: '0x1111111111111111111111111111111111111111',
    ownerAddress: '0x2222222222222222222222222222222222222222',
    eoaAddress: ZERO_ADDRESS,
    sponsorId: DEFAULT_SPONSOR as `0x${string}`,
    chainId: '5003',
    storageIdentifier: 'ipfs://QmMock001',
    storageType: 0,
    status: 1,
    reviewStorageIdentifier: 'ipfs://QmReview001',
    createdAt: '1771000000',
    reviewedAt: '1771000500',
    deployedAt: '0',
  },
  {
    applicationId: 'app-mock-002',
    accountAddress: '0x3333333333333333333333333333333333333333',
    ownerAddress: '0x4444444444444444444444444444444444444444',
    eoaAddress: ZERO_ADDRESS,
    sponsorId: DEFAULT_SPONSOR as `0x${string}`,
    chainId: '5003',
    storageIdentifier: 'ipfs://QmMock002',
    storageType: 0,
    status: 0,
    reviewStorageIdentifier: '',
    createdAt: '1771001000',
    reviewedAt: '0',
    deployedAt: '0',
  },
];

fixtures.set(`5003:${DEFAULT_SPONSOR.toLowerCase()}`, defaultItems);

function writeJson(
  res: import('node:http').ServerResponse<import('node:http').IncomingMessage>,
  status: number,
  body: unknown
) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const method = req.method || 'GET';
  const parsed = new URL(req.url || '/', `http://${HOST}:${PORT}`);

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
    return;
  }

  if (parsed.pathname === '/health') {
    writeJson(res, 200, { ok: true, service: 'mock-application-indexer' });
    return;
  }

  if (parsed.pathname === '/api/applications/by-sponsor' && method === 'GET') {
    const chainId = parsed.searchParams.get('chainId');
    const sponsorAddress = parsed.searchParams.get('sponsorAddress')?.toLowerCase();
    if (!chainId || !sponsorAddress) {
      writeJson(res, 400, { error: 'chainId and sponsorAddress are required' });
      return;
    }

    const items = fixtures.get(`${chainId}:${sponsorAddress}`) || [];
    writeJson(res, 200, { items });
    return;
  }

  writeJson(res, 404, { error: 'Not Found' });
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-indexer] listening at http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(
    `[mock-indexer] try: http://${HOST}:${PORT}/api/applications/by-sponsor?chainId=5003&sponsorAddress=${DEFAULT_SPONSOR}`
  );
});
