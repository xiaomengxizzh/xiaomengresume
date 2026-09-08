/**
 * web-compat —— web 端旧引擎兼容垫层（2026-09-08）
 * 由 main-web.tsx 在应用代码前引入（仅 web 入口，桌面端不受影响）。
 * 逐项：仅当 API 缺失时补齐，存在时不覆盖原生实现。
 */

// Math.sumPrecise（ES2025，Chrome 137+/FF 138+ 才有）：unpdf 内嵌的 pdf.js 新版在
// 字体矩阵计算路径使用；旧内核缺失时该路径抛 TypeError 会让部分 PDF（自嵌字体）
// 解析直接失败。语义 = 对可迭代数字求和。
// （TS lib 版本尚无该 API，经断言访问，避免全局类型增广。）
const MathCompat = Math as unknown as { sumPrecise?: (values: Iterable<number>) => number }

if (typeof MathCompat.sumPrecise !== 'function') {
  Object.defineProperty(Math, 'sumPrecise', {
    value: (values: Iterable<number>): number => {
      let sum = 0
      for (const v of values) sum += v
      return sum
    },
    configurable: true,
    writable: true
  })
}

export {}
