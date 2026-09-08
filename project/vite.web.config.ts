import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

/**
 * 纯浏览器开发服务器（dev:web）——只渲染 renderer，不启动 Electron 主进程。
 * 与 electron.vite.config.ts 的 renderer 段保持同构（同插件、同别名），
 * 端口 5174 避让 electron-vite dev 的 5173；入口 = src/renderer/web.html。
 */
export default defineConfig({
  root: 'src/renderer',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  server: {
    port: 5174
  }
})
