# H5 项目 GitHub 上传脚本

## 📁 脚本说明

### 上传脚本
- **文件**: `upload_to_github.sh`
- **功能**: 自动上传 H5 项目到 AnDAO GitHub 仓库
- **远程仓库**: `git@github.com:iunknow588/AnDAO.git`

## 🚀 快速使用

```bash
# 在 h5 项目目录运行
cd /home/lc/luckee_dao/AnDaoWallet/h5
./scripts/upload_to_github.sh
```

或使用自定义提交信息：

```bash
./scripts/upload_to_github.sh "feat: 你的提交信息"
```

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
