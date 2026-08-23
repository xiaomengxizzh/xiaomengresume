/**
 * makePreviewResume —— 模板预览数据工厂（2026-08-23 R2 预览数据剥离）
 * 示例数据（王晨，shared 单一事实源；migrate 即 parse 兜底 schema 演进）深拷贝后
 * 把 layout 剥离为仅剩 templateId——删全部数值排版字段与 themeColor/resumeFont，
 * 让 ResumeBody 覆盖链（layout > 模板覆盖层草稿 > 模板出厂预设）回落后两层：
 * 模板设置屏拖滑杆（覆盖层草稿）实时生效；modern/compact 首次正确显示各自 preset。
 * classic 视觉不变（王晨 layout 原值 = classic 出厂 preset）。
 */
import { migrate, type Resume } from '@shared/schema/resume'
import sample from '@shared/sample-resume.json'

export function makePreviewResume(templateId: string): Resume {
  const resume = structuredClone(migrate(sample))
  resume.layout = { templateId }
  return resume
}
