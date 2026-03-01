# Verification Scripts

验证与连通性检查脚本：

1. `verify-standalone.sh`：校验 h5 独立性（无外部目录依赖 + 可构建）。
2. `pwa-verification.ts`：校验 PWA 配置与关键文件。
3. `testnet-verification.ts`：测试网功能验证（账户、交易、插件等）。
4. `bridge-connectivity-check.ts`：RPC/Bundler/Bridge 连通性检查。
5. `sponsor-policy-e2e.ts`：Sponsor 白名单链上 E2E（加白放行 -> 删白拦截）。
   - 环境加载顺序：`.env.example` -> `.env.local` -> `env.local` -> `.env.sponsor-e2e.local`
   - 可用 `SPONSOR_E2E_ENV_FILE=xxx` 指定自定义环境文件
