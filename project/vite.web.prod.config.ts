// web 产品构建（2026-09-06 局域网上线用）：入口 web.html，浏览器直接可用
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: 'src/renderer',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  base: './',
  build: {
    outDir: 'dist-web',
    rollupOptions: { input: resolve('src/renderer/web.html') }
  }
})
