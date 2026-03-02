# Security Scripts

安全审计脚本：

1. `security-audit.ts`：执行依赖漏洞扫描、静态检查与敏感信息检测。
2. `secret-scan-staged.sh`：Git `pre-commit` 钩子扫描暂存区，阻止 `.env/env.local`、疑似真实 `PRIVATE_KEY/MNEMONIC/SEED` 被提交。

## 使用方式

1. 安装依赖后，Husky 会通过 `npm run prepare` 自动激活。
2. 每次 `git commit` 前会自动运行暂存区密钥扫描。
3. 若确实需要提交示例值，请使用 `example/placeholder/dummy/test` 这类占位词，避免被判定为真实密钥。
