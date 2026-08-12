/**
 * diagnostics/logger.ts —— 本地日志（M5-6 D6，技术栈 §3.11.1 #8）
 * electron-log 5.4.4（过 G.2：零依赖/MIT/93KB/ESM 兼容/维护活跃）：
 *  - file transport → userData/logs/app.log（主日志）
 *  - 5MB × 3 轮转：electron-log 内建仅单份归档（main.old.log），archiveLogFn 自实现多份轮转
 *  - 脱敏：AI 调用只记模型 id/端点 host，不记 prompt 正文与 API Key（调用方保证）；
 *    本层额外 hook 记录错误（不含敏感值）。
 * 导出：logs:export（register.ts）将 logs/*.log* 打包 zip（复用 createZip），二次扫描剔除 Key 痕迹。
 */
import log from 'electron-log/main'
import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const KEEP = 3 // 3 份（app.log + 2 份轮转）
const LOG_DIR = 'logs'

/** 初始化（app ready 前调用一次） */
export function initLogger(): void {
  log.initialize()
  log.transports.file.resolvePathFn = () => join(app.getPath('userData'), LOG_DIR, 'app.log')
  log.transports.file.maxSize = MAX_SIZE
  // 多份轮转：旧日志按时间戳滚动保留 KEEP-1 份，超限删除最旧
  log.transports.file.archiveLogFn = async (file) => {
    try {
      const dir = join(app.getPath('userData'), LOG_DIR)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const archived = join(dir, `app.${stamp}.log`)
      await fs.rename(file.path, archived)
      const files = (await fs.readdir(dir)).filter((f) => f.startsWith('app.') && f.endsWith('.log') && f !== 'app.log')
      files.sort()
      while (files.length >= KEEP) {
        const oldest = files.shift()
        if (oldest) await fs.unlink(join(dir, oldest)).catch(() => {})
      }
    } catch {
      // 轮转失败不阻断（日志非关键路径）
    }
  }
  log.errorHandler.startCatching()
}

export default log
