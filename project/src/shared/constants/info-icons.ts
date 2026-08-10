/**
 * 基础信息图标 ID 字面量源（2026-08-07 UI 重构 · PDF 还原）
 * shared 层同时被 schema（zod enum）和 renderer（InfoIcons 组件）引用，确保字面量类型一致。
 */
export const INFO_ICON_IDS = ['mail', 'phone', 'pin', 'globe', 'briefcase', 'calendar', 'link', 'user', 'star', 'map'] as const
export type InfoIconId = (typeof INFO_ICON_IDS)[number]