# H5 Scripts

`h5/scripts` 已按职责拆分为两类：

## 1) 功能性脚本（functional）

目录：`h5/scripts/functional`

- `generate-test-accounts.ts`
- `generate-test-accounts-simple.ts`
- `mock-application-indexer.ts`

对应命令：

- `npm run test:accounts`
- `npm run test:accounts:simple`
- `npm run mock:indexer`

## 2) 管理性脚本（management）

目录：`h5/scripts/management`

- `upload_to_github.sh`
- `check-deployment.sh`
- `deploy-github-and-vercel.sh`
- `pwa-verification.ts`
- `security-audit.ts`
- `testnet-verification.ts`
- `start-local-dev.sh`
- `test-local-dev.sh`
- `bridge-connectivity-check.ts`

对应命令：

- `npm run pwa:verify`
- `npm run security:check`
- `npm run testnet:verify`
- `npm run deploy:github`
- `npm run deploy:check`
- `npm run deploy:all`
- `npm run dev:local:start`
- `npm run dev:local:test`
- `npm run bridge:check`

常用执行方式：

- `bash ./scripts/management/upload_to_github.sh "chore: update h5"`
- `bash ./scripts/management/check-deployment.sh`
- `bash ./scripts/management/deploy-github-and-vercel.sh "chore: deploy h5"`

## 🧪 Sponsor 索引 Mock 联调

### 启动服务
```bash
npm run mock:indexer
```

默认监听：`http://127.0.0.1:8787`

可选环境变量：
- `INDEXER_HOST`（默认 `127.0.0.1`）
- `INDEXER_PORT`（默认 `8787`）

### 前端配置
在 `h5/.env.local` 中配置：
```bash
VITE_APPLICATION_INDEXER_URL=http://127.0.0.1:8787/api/applications/by-sponsor
```

### 接口契约
- `GET /health`
- `GET /api/applications/by-sponsor?chainId=5003&sponsorAddress=0x...`

返回示例：
```json
{
  "items": [
    {
      "applicationId": "app-mock-001",
      "status": 1,
      "chainId": "5003"
    }
  ]
}
```

### 快速验证
```bash
curl "http://127.0.0.1:8787/api/applications/by-sponsor?chainId=5003&sponsorAddress=0x1234567890123456789012345678901234567890"
```
