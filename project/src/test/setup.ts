/**
 * vitest 全局 setup（经 vitest.config.ts → test.setupFiles 注入，所有测试文件生效）。
 *
 * 自动 cleanup：
 * - RTL 的 cleanup 已挂到全局 afterEach —— 新测试文件无需再手动 afterEach(cleanup)；
 * - 既有文件里的手动 cleanup 与自动 cleanup 并存无害（双保险），保留不删。
 * - document 不存在时跳过：项目多数测试为 node 环境（jsdom 由各 tsx 文件 pragma 声明）。
 *
 * 时钟敏感测试规范（2026-08-25 批 A 定案）：
 * 1. 涉及时间窗 / 防抖的断言必须用 vi.useFakeTimers 控制（配 advanceTimersByTime*），
 *    禁止依赖真实时钟间隔（真实等待在慢机/并行下必 flaky——tags-block 用例 H 教训）。
 * 2. 需要干净历史栈的 store 测试用 loadResume() 装载（内部 history.clear()），
 *    禁止依赖前一用例残留状态；纯逻辑历史栈用 createHistoryManager 新实例隔离。
 */
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
})
