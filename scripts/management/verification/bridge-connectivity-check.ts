import * as fs from "node:fs";
import * as path from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

function loadEnvFromFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const map: Record<string, string> = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    map[key] = value;
  }

  return map;
}

function loadProjectEnv(cwd: string): Record<string, string> {
  const envLocal = loadEnvFromFile(path.join(cwd, ".env.local"));
  const legacyEnvLocal = loadEnvFromFile(path.join(cwd, "env.local"));
  const envExample = loadEnvFromFile(path.join(cwd, ".env.example"));

  return {
    ...envExample,
    ...legacyEnvLocal,
    ...envLocal,
  };
}

function pickEnv(
  envFromFiles: Record<string, string>,
  key: string,
  fallback = ""
): string {
  const fromProcess = process.env[key];
  if (fromProcess !== undefined && fromProcess !== "") return fromProcess;
  if (envFromFiles[key] !== undefined && envFromFiles[key] !== "") {
    return envFromFiles[key];
  }
  return fallback;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkEvmRpc(
  name: string,
  rpcUrl: string,
  expectedChainId: number
): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(
      rpcUrl,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      },
      8000
    );

    if (!response.ok) {
      return {
        name,
        ok: false,
        detail: `HTTP ${response.status}`,
      };
    }

    const json = (await response.json()) as { result?: string };
    const chainHex = json.result ?? "";
    const actual = Number.parseInt(chainHex, 16);
    if (actual !== expectedChainId) {
      return {
        name,
        ok: false,
        detail: `chainId mismatch, expected ${expectedChainId}, got ${actual || "unknown"}`,
      };
    }

    return {
      name,
      ok: true,
      detail: `ok (chainId=${actual})`,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : "unknown error",
    };
  }
}

async function checkSolanaRpc(name: string, rpcUrl: string): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(
      rpcUrl,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getHealth",
          params: [],
        }),
      },
      8000
    );

    if (!response.ok) {
      return {
        name,
        ok: false,
        detail: `HTTP ${response.status}`,
      };
    }

    const json = (await response.json()) as { result?: string; error?: unknown };
    if (json.result === "ok") {
      return { name, ok: true, detail: "ok" };
    }

    if (json.error) {
      return {
        name,
        ok: false,
        detail: `rpc error: ${JSON.stringify(json.error)}`,
      };
    }

    return { name, ok: true, detail: "reachable" };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : "unknown error",
    };
  }
}

async function checkHttpReachability(
  name: string,
  endpoint: string
): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(endpoint, { method: "GET" }, 8000);
    if (response.status >= 500) {
      return { name, ok: false, detail: `HTTP ${response.status}` };
    }
    return { name, ok: true, detail: `reachable (HTTP ${response.status})` };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : "unknown error",
    };
  }
}

function printResult(result: CheckResult): void {
  const mark = result.ok ? "PASS" : "FAIL";
  // Keep output plain for CI logs.
  console.log(`[${mark}] ${result.name}: ${result.detail}`);
}

type LocalMockContext = {
  avalancheRpc: string;
  avalancheBundler: string;
  solanaRpc: string;
  solanaBridgeEndpoint: string;
  close: () => Promise<void>;
};

function parseJsonBody(
  req: IncomingMessage
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!raw) {
          resolve(null);
          return;
        }
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

async function startLocalMockContext(): Promise<LocalMockContext> {
  const evmServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("method not allowed");
      return;
    }
    const body = await parseJsonBody(req);
    const id = body?.id ?? 1;
    const method = body?.method;

    res.setHeader("content-type", "application/json");
    if (method === "eth_chainId") {
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result: "0xa869" }));
      return;
    }
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not mocked: ${String(method)}` },
      })
    );
  });

  const solanaServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || "/";
    if (url.startsWith("/bridge")) {
      if (req.method === "GET") {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true, service: "local-solana-bridge-mock" }));
        return;
      }
      if (req.method === "POST") {
        const body = await parseJsonBody(req);
        const id = body?.id ?? 1;
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            txHash: "mock-solana-tx-hash",
            signature: "mock-solana-signature",
          })
        );
        return;
      }
      res.statusCode = 405;
      res.end("method not allowed");
      return;
    }

    if (url.startsWith("/rpc")) {
      const body = await parseJsonBody(req);
      const id = body?.id ?? 1;
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result: "ok" }));
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  await new Promise<void>((resolve) => evmServer.listen(0, "127.0.0.1", () => resolve()));
  await new Promise<void>((resolve) =>
    solanaServer.listen(0, "127.0.0.1", () => resolve())
  );

  const evmAddress = evmServer.address();
  const solanaAddress = solanaServer.address();
  if (!evmAddress || typeof evmAddress === "string") {
    throw new Error("Failed to bind local EVM mock server");
  }
  if (!solanaAddress || typeof solanaAddress === "string") {
    throw new Error("Failed to bind local Solana mock server");
  }

  const evmBase = `http://127.0.0.1:${evmAddress.port}`;
  const solanaBase = `http://127.0.0.1:${solanaAddress.port}`;

  return {
    avalancheRpc: `${evmBase}/rpc`,
    avalancheBundler: `${evmBase}/bundler`,
    solanaRpc: `${solanaBase}/rpc`,
    solanaBridgeEndpoint: `${solanaBase}/bridge`,
    close: async () => {
      await Promise.all([
        new Promise<void>((resolve) => evmServer.close(() => resolve())),
        new Promise<void>((resolve) => solanaServer.close(() => resolve())),
      ]);
    },
  };
}

async function main(): Promise<void> {
  const useLocalMock = process.argv.includes("--use-local-mock");
  const cwd = process.cwd();
  const env = loadProjectEnv(cwd);

  let avalancheRpc = pickEnv(
    env,
    "VITE_AVALANCHE_FUJI_RPC_URL",
    "https://api.avax-test.network/ext/bc/C/rpc"
  );
  let avalancheBundler = pickEnv(env, "VITE_AVALANCHE_FUJI_BUNDLER_URL", "");

  const solanaNetwork = pickEnv(env, "VITE_SOLANA_NETWORK", "solana-devnet");
  let solanaBridgeEndpoint = pickEnv(env, "VITE_SOLANA_BRIDGE_ENDPOINT", "");
  let solanaRpc =
    solanaNetwork === "solana-mainnet" || solanaNetwork === "solana-mainnet-beta"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";
  let localMockContext: LocalMockContext | null = null;

  if (useLocalMock) {
    localMockContext = await startLocalMockContext();
    avalancheRpc = localMockContext.avalancheRpc;
    avalancheBundler = localMockContext.avalancheBundler;
    solanaRpc = localMockContext.solanaRpc;
    solanaBridgeEndpoint = localMockContext.solanaBridgeEndpoint;
  }

  const results: CheckResult[] = [];

  console.log("== Avalanche checks ==");
  results.push(
    await checkEvmRpc("Avalanche Fuji RPC", avalancheRpc, 43113)
  );

  if (avalancheBundler) {
    results.push(
      await checkEvmRpc("Avalanche Fuji Bundler", avalancheBundler, 43113)
    );
  } else {
    results.push({
      name: "Avalanche Fuji Bundler",
      ok: false,
      detail: "VITE_AVALANCHE_FUJI_BUNDLER_URL is empty",
    });
  }

  console.log("== Solana checks ==");
  results.push(
    await checkSolanaRpc(`Solana RPC (${solanaNetwork})`, solanaRpc)
  );

  if (solanaBridgeEndpoint) {
    results.push(
      await checkHttpReachability("Solana Bridge Endpoint", solanaBridgeEndpoint)
    );
  } else {
    results.push({
      name: "Solana Bridge Endpoint",
      ok: false,
      detail: "VITE_SOLANA_BRIDGE_ENDPOINT is empty",
    });
  }

  console.log("== Summary ==");
  for (const result of results) {
    printResult(result);
  }

  const failed = results.filter((r) => !r.ok);
  if (localMockContext) {
    await localMockContext.close();
  }
  if (failed.length > 0) {
    process.exitCode = 1;
    return;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
