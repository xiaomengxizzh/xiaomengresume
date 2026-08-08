/**
 * recovery.ts —— 崩溃恢复的纯函数（零 electron 依赖，便于 node 环境单测）
 *
 * 临时文件命名 <uuid>.json.tmp：恢复时从目录文件名提取裸 uuid。
 * 2026-08-08 修复：原实现 slice(0,-4) 留下 ".json" 后缀，recoverPending 的
 * assertUuid 必抛 → 崩溃恢复协议 100% 失效（P0）。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 从目录文件名中提取待恢复的简历 uuid（仅 .tmp 文件，剥掉 ".json.tmp" 并校验 uuid） */
export function extractPendingIds(files: string[]): string[] {
  return files
    .filter((f) => f.endsWith('.tmp'))
    .map((f) => f.slice(0, -9))
    .filter((id) => UUID_RE.test(id))
}
