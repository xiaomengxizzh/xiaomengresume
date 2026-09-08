/**
 * safeUuid —— crypto.randomUUID 的安全上下文兜底（2026-09-08 web 端局域网部署）
 * randomUUID 仅在安全上下文（https / localhost）暴露；局域网 http://<ip>:port 访问时
 * 该 API 整体缺失。兜底走 crypto.getRandomValues（所有上下文可用）按 RFC4122 v4 模板生成。
 * 渲染端统一入口：web 垫层用 uuidV4FromGetRandomValues 做 polyfill 值（勿用 safeUuid——
 * 它的"原生可用则透传"判断在 polyfill 已就位后会自指递归，见 2026-09-08 崩溃复盘）；
 * 直接调用方用 safeUuid。
 */
export function uuidV4FromGetRandomValues(): string {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => {
    const n = Number(c)
    return (n ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (n / 4)))).toString(16)
  })
}

export function safeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return uuidV4FromGetRandomValues()
}
