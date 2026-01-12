/**
 * ESLint 安全配置
 * 
 * 用于检测代码中的安全漏洞和潜在风险
 */

module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    // 安全相关规则
    'no-eval': 'error', // 禁止使用 eval()
    'no-implied-eval': 'error', // 禁止使用隐式 eval()
    'no-new-func': 'error', // 禁止使用 new Function()
    'no-script-url': 'error', // 禁止使用 javascript: URL
    
    // 防止 XSS
    'no-danger': 'off', // 注意：需要安装 eslint-plugin-react 才能使用
    'react/no-danger': 'warn', // 警告使用 dangerouslySetInnerHTML
    
    // 防止原型污染
    'no-prototype-builtins': 'error',
    
    // 防止不安全的正则表达式
    'no-control-regex': 'error',
    'no-regex-spaces': 'error',
    
    // 防止不安全的类型转换
    'no-implicit-coercion': 'warn',
    
    // 防止内存泄漏
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    
    // 代码质量
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    
    // React 安全
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
};

