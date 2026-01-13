# H5 项目脚本说明

## 📁 脚本说明

### 本地开发脚本
- **文件**: `start-local-dev.sh` - 启动本地开发服务器
- **文件**: `test-local-dev.sh` - 测试本地开发服务器

### 验证脚本
- **文件**: `pwa-verification.ts` - PWA 验证脚本
- **文件**: `security-audit.ts` - 安全审计脚本
- **文件**: `testnet-verification.ts` - 测试网验证脚本

### GitHub 上传脚本
- **文件**: `../deploy/upload_to_github.sh` - 自动上传 H5 项目到 AnDAO GitHub 仓库
- **远程仓库**: `git@github.com:iunknow588/AnDAO.git`
- **使用方法**: `./deploy/upload_to_github.sh [commit-message]`

## 📋 功能说明

### 自动执行的操作
1. 检查是否在 h5 目录
2. 显示 Git 状态
3. 添加所有修改文件
4. 提交更改（使用默认或自定义提交信息）
5. 推送到 git@github.com:iunknow588/AnDAO.git

### 默认提交信息包含
- 代码分析与注释完善
- 代码质量改进
- 功能实现状态
- 技术栈说明

## ⚠️ 注意事项

1. 确保 SSH 密钥已配置
2. 确保有推送到 iunknow588/AnDAO 的权限
3. 脚本会自动初始化 Git 仓库（如果尚未初始化）
4. 默认推送到 main 分支

## 🔗 远程仓库

- 仓库地址: git@github.com:iunknow588/AnDAO.git
- 分支: main
