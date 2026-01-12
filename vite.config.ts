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
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'AnDaoWallet',
        short_name: 'AnDaoWallet',
        description: 'Smart Contract Wallet based on Account Abstraction (ERC-4337)',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@kernel-dev': path.resolve(__dirname, '../kernel-dev/src')
    }
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
    rollupOptions: {
      output: {
        manualChunks: (id) => {
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
          // 页面组件
          if (id.includes('/pages/')) {
            return 'pages';
          }
          // 服务层
          if (id.includes('/services/')) {
            return 'services';
          }
        },
        // 优化 chunk 大小
        chunkSizeWarningLimit: 1000,
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

