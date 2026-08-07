import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/** vitest 独立配置：复用 electron-vite 别名（@shared / @renderer），node 环境跑纯逻辑测试 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}']
  }
})
