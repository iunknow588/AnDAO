import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'AnDaoWallet',
        short_name: 'AnDaoWallet',
        description: 'Smart Contract Wallet based on Account Abstraction (ERC-4337)',
        theme_color: '#4c6ef5',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 注意：已移除 @kernel-dev 路径别名，项目使用本地定义的 ABI（kernel-types.ts）
      // 合约代码已独立到外部目录，Vercel 部署仅包含 UI 部分
    }
  },
  optimizeDeps: {
    // 排除可选依赖，避免 Vite 在开发模式下尝试预构建
    exclude: ['@sentry/react'],
  },
  server: {
    port: 3000,
    // 注意：本应用为纯客户端应用，无自建后端 API
    // 如需代理外部服务（如 RPC/Bundler），可在此配置
    // proxy: {
    //   '/rpc': {
    //     target: 'https://rpc.mantle.xyz',
    //     changeOrigin: true,
    //     rewrite: (path) => path.replace(/^\/rpc/, '')
    //   }
    // }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Only split third-party dependencies to avoid circular app chunks.
          if (!id.includes('/node_modules/')) {
            return;
          }
          // React 相关
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'react-vendor';
          }
          // MobX 相关
          if (id.includes('mobx')) {
            return 'mobx-vendor';
          }
          // Viem/Ethers 相关
          if (id.includes('viem') || id.includes('ethers')) {
            return 'web3-vendor';
          }
        },
      }
    },
    // 启用压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境移除 console
        drop_debugger: true,
      },
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
  }
});
