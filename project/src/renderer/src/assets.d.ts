// 静态资源模块声明（vite 支持 *.png import，但 TS 需要 ambient declaration）
declare module '*.png' {
  const src: string
  export default src
}
declare module '*.svg' {
  const src: string
  export default src
}