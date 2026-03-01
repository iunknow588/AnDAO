# H5 Scripts

`h5/scripts` 已按职责拆分为两类：

## 1) 功能性脚本（functional）

目录：`h5/scripts/functional`

- `mock-application-indexer.ts`
- `generate-test-accounts.ts`（已迁移）
- `generate-test-accounts-simple.ts`（已迁移）
- `generate-avalanche-test-accounts.ts`（已迁移）
- `avalanche-faucet-assistant.ts`（已迁移）
- `mock-application-indexer.ts`（保留）

对应命令：

- `npm run test:accounts`（已移除）
- `npm run test:accounts:simple`（已移除）
- `npm run test:accounts:avalanche`（已移除）
- `npm run test:accounts:avalanche:faucet`（已移除）
- `npm run mock:indexer`（保留）

说明：
- 测试账号与领币脚本已迁移至 `/home/lc/luckee_dao/works-docs/道安钱包项目/测试账号`
- 当前 `h5` 仅保留业务联调脚本 `mock:indexer`

## 2) 管理性脚本（management）

目录：`h5/scripts/management`

- `deploy/`：发布与部署脚本
- `verification/`：连通性与独立性校验脚本
- `security/`：安全审计脚本
- `dev/`：本地开发辅助脚本
- `lib/`：管理脚本共享模块

对应命令：

- `npm run pwa:verify`
- `npm run security:check`
- `npm run testnet:verify`
- `npm run deploy:github`
- `npm run deploy:vercel`
- `npm run deploy:check`
- `npm run deploy:all`
- `npm run dev:local:start`
- `npm run dev:local:test`
- `npm run bridge:check`

常用执行方式：

- `bash ./scripts/management/deploy/upload-to-github.sh "chore: update h5"`
- `bash ./scripts/management/deploy/deploy-vercel.sh`
- `bash ./scripts/management/deploy/check-deployment.sh`
- `bash ./scripts/management/deploy/deploy-github-and-vercel.sh "chore: deploy h5"`

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
