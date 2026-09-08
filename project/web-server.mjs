// xiaomengresume web 静态服务（SPA 回退 → web.html）——仅限局域网（防火墙管控）
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
const ROOT = new URL('./src/renderer/dist-web/', import.meta.url).pathname
const PORT = 4173
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (p === '/') p = '/web.html'
    const f = normalize(join(ROOT, p))
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end() }
    const body = await readFile(f).catch(() => readFile(join(ROOT, 'web.html')))
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(500); res.end() }
}).listen(PORT, '0.0.0.0', () => console.log(`xiaomengresume web on :${PORT}`))
