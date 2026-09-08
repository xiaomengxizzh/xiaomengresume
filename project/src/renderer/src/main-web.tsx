/**
 * main-web —— 纯浏览器开发入口（dev 专用，仅经 web.html 加载，不进桌面构建）
 *
 * 与 main.tsx 的差异只有一件事：渲染前确保 window.electronAPI 存在——
 * 浏览器里 preload 不会执行，缺失时挂 dev/web-electronapi-mock（localStorage 实现）。
 * 必须动态 import('./main')：静态 import 会提升到本文件语句之前，mock 挂载就晚了。
 */
import './lib/web-compat' // 旧引擎垫层（Math.sumPrecise 等）——必须在应用代码前
import { installWebElectronAPIMock } from './dev/web-electronapi-mock'
import { parseFile, setNextPickedFiles } from './dev/web-import'

if (!window.electronAPI) {
  installWebElectronAPIMock()
  // web 端自动化调试把手（E2E 绕过系统文件选择器；桌面端与 prod 主流程不依赖）
  ;(window as unknown as Record<string, unknown>).__xmWebDev = {
    parseFile,
    setNextPickedFiles,
    // 诊断：直接观察 unpdf extractImages 在浏览器里的返回形态
    diagImages: async (bytes: Uint8Array): Promise<unknown> => {
      const { getDocumentProxy, extractImages } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(bytes))
      try {
        const imgs = (await extractImages(pdf, 1)) as unknown as Array<Record<string, unknown>>
        return { count: imgs.length, imgs: imgs.map((i) => ({ w: i.width, h: i.height, ch: i.channels, dataLen: (i.data as Uint8Array)?.length ?? null, keys: Object.keys(i) })) }
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
    }
  }
}

void import('./main')
