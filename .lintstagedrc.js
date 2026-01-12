/**
 * lint-staged 配置
 * 
 * 在 Git 提交前自动运行代码检查和格式化
 */

module.exports = {
  // TypeScript 和 JavaScript 文件
  '*.{ts,tsx,js,jsx}': [
    'eslint --fix',
    'prettier --write',
  ],
  // JSON 文件
  '*.{json,jsonc}': [
    'prettier --write',
  ],
  // Markdown 文件
  '*.md': [
    'prettier --write',
  ],
  // CSS 和其他样式文件
  '*.{css,scss,sass,less}': [
    'prettier --write',
  ],
};

