// xiaomengresume web 静态服务（SPA 回退 → web.html）——仅限局域网（防火墙管控）
// 2026-09-08 多用户优化：① 缓存策略（html no-cache 保证更新即时可见；带 hash 的
// assets/ 长缓存 immutable）② 带 extension 的 404 不做 SPA 回退（防止 JS/CSS 404
// 被回退成 text/html 引起难排查的白屏）③ 文本类型补 charset=utf-8。
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
const ROOT = new URL('./src/renderer/dist-web/', import.meta.url).pathname
const PORT = 4173
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
}

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (p === '/') p = '/web.html'
    const f = normalize(join(ROOT, p))
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end() }

    let body: Buffer
    try {
      const s = await stat(f)
      if (s.isDirectory()) throw new Error('is directory')
      body = await readFile(f)
    } catch {
      // SPA 回退仅限无 extension 的路径；assets/JS/CSS 404 如实 404（不回退成 HTML）
      if (extname(p) === '') {
        body = await readFile(join(ROOT, 'web.html'))
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        return res.end('404 Not Found')
      }
    }

    const ext = extname(p)
    const cache = ext === '.html' || p === '/web.html'
      ? 'no-cache'
      : p.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable' // 文件名带内容 hash，可永久缓存
        : 'public, max-age=3600'
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache })
    res.end(body)
  } catch { res.writeHead(500); res.end() }
}).listen(PORT, '0.0.0.0', () => console.log(`xiaomengresume web on :${PORT}`))
