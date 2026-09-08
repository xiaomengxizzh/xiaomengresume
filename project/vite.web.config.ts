import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

/**
 * 根路径 → web.html 重定向（dev 便利）：web.html 才是纯浏览器入口（带 electronAPI mock），
 * 根路径的 index.html 是 Electron 专用入口，浏览器直开会因 window.electronAPI 缺失崩成白屏。
 * 端口监视类工具只会记 "127.0.0.1:5174" 不带路径，点开即落根路径——这里统一接住。
 */
function webEntryRedirect(): Plugin {
  return {
    name: 'web-entry-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/') {
          res.statusCode = 302
          res.setHeader('Location', '/web.html')
          res.end()
          return
        }
        next()
      })
    }
  }
}

/**
 * 纯浏览器开发服务器（dev:web）——只渲染 renderer，不启动 Electron 主进程。
 * 与 electron.vite.config.ts 的 renderer 段保持同构（同插件、同别名），
 * 端口 5174 避让 electron-vite dev 的 5173；入口 = src/renderer/web.html。
 */
export default defineConfig({
  root: 'src/renderer',
  plugins: [react(), tailwindcss(), webEntryRedirect()],
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
