/**
 * wizard-topics.test.ts —— 向导数据定义完整性（B1 批）
 * 守护栏：id 唯一 / 步骤数 2~4 / 文案字段只放 i18n key 且前缀正确 /
 * targetView 值域与 App.tsx currentView 分支一致（运行时常量对照；编译期由类型保证）。
 */
import { describe, it, expect } from 'vitest'
import { WIZARD_TOPICS, WIZARD_CATEGORIES } from '../wizard-topics'

// 与 App.tsx renderView 分支一一对应（新增视图须同步此处）
const ALL_TARGET_VIEWS: readonly string[] = [
  'welcome',
  'editor',
  'resumes-home',
  'resumes-list',
  'resumes-recent',
  'resumes-new',
  'resumes-manage',
  'jobs-manage',
  'import-home',
  'ai-home',
  'ai:grammar',
  'ai:intro',
  'ai:polish',
  'ai:match',
  'settings-home',
  'settings-appearance',
  'settings-templates',
  'settings-ai',
  'settings-storage'
]

describe('WIZARD_TOPICS 数据完整性', () => {
  it('恰好 7 题，id 唯一', () => {
    expect(WIZARD_TOPICS).toHaveLength(7)
    const ids = WIZARD_TOPICS.map((tp) => tp.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('categoryKey 均落在 WIZARD_CATEGORIES 派生集合内', () => {
    const valid = new Set(WIZARD_CATEGORIES.map((c) => `wizard.category.${c}`))
    for (const tp of WIZARD_TOPICS) {
      expect(valid.has(tp.categoryKey)).toBe(true)
    }
    // 四个分类都有题（避免出现永远不渲染的空分类）
    const used = new Set(WIZARD_TOPICS.map((tp) => tp.categoryKey))
    expect(used.size).toBe(WIZARD_CATEGORIES.length)
  })

  it('每题 titleKey/hintKey 非空且以 wizard.topics.<id>. 开头', () => {
    for (const tp of WIZARD_TOPICS) {
      expect(tp.titleKey.length).toBeGreaterThan(0)
      expect(tp.titleKey).toBe(`wizard.topics.${tp.id}.title`)
      expect(tp.hintKey.length).toBeGreaterThan(0)
      expect(tp.hintKey).toBe(`wizard.topics.${tp.id}.hint`)
    }
  })

  it('每题 steps 2~4 条，且至少一步含 targetView（可直达入口）', () => {
    for (const tp of WIZARD_TOPICS) {
      expect(tp.steps.length).toBeGreaterThanOrEqual(2)
      expect(tp.steps.length).toBeLessThanOrEqual(4)
      expect(tp.steps.some((s) => s.targetView !== undefined)).toBe(true)
    }
  })

  it('每步 textKey 非空且形如 wizard.topics.<id>.step<N>', () => {
    for (const tp of WIZARD_TOPICS) {
      tp.steps.forEach((step, i) => {
        expect(step.textKey.length).toBeGreaterThan(0)
        expect(step.textKey).toBe(`wizard.topics.${tp.id}.step${i + 1}`)
      })
    }
  })

  it('targetView ∈ App.tsx currentView 值域（运行时对照）', () => {
    for (const tp of WIZARD_TOPICS) {
      for (const step of tp.steps) {
        if (step.targetView !== undefined) {
          expect(ALL_TARGET_VIEWS).toContain(step.targetView)
        }
      }
    }
  })
})
