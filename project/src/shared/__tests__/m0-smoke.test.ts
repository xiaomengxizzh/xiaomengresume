import { describe, it, expect } from 'vitest'
import { IPC } from '../ipc-channels'
import { SettingsSchema, defaultSettings } from '../schema/settings'

describe('IPC 契约（M0）', () => {
  it('冻结了 M0 三大通道', () => {
    expect(IPC.App.Ping).toBe('app:ping')
    expect(IPC.Print.Pdf).toBe('print:pdf')
    expect(IPC.Ai.StreamTest).toBe('ai:stream:test')
  })
})

describe('IPC 契约（M2 F5 导出）', () => {
  it('冻结 export:run 通道', () => {
    expect(IPC.Export.Run).toBe('export:run')
  })
})

describe('SettingsSchema（M0 令牌地基）', () => {
  it('默认值：light / fixed / zh-CN / 0.7 / 4096', () => {
    const s = defaultSettings()
    expect(s.appearance).toBe('light')
    expect(s.appearanceMode).toBe('fixed')
    expect(s.language).toBe('zh-CN')
    expect(s.temperature).toBe(0.7)
    expect(s.maxTokens).toBe(4096)
  })

  it('非法 appearance 被拒绝', () => {
    const r = SettingsSchema.safeParse({ appearance: 'neon' })
    expect(r.success).toBe(false)
  })

  it('四服务商缺省均 disabled', () => {
    const s = defaultSettings()
    expect(s.providers.deepseek.enabled).toBe(false)
    expect(s.providers.google.enabled).toBe(false)
  })

  it('M2 F5：export.lastFolder 缺省为空对象', () => {
    const s = defaultSettings()
    expect(s.export).toEqual({})
  })
})
