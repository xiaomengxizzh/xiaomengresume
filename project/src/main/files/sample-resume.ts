/**
 * 内置示例简历 —— F2「打开示例」入口的数据源（M1 补口 2026-08-07）
 * 数据与《项目实现情况》M1 示例蓝本同源（material/简历示例1.json 的宋哈娜案例），
 * 已对齐 F1 新 schema（schemaVersion 1 / basics 复数 / layout / boundJobIds）。
 * meta 不内嵌：由写入方（resume:create-sample handler → saveResume）补齐。
 */
import sample from '../../shared/sample-resume.json'
import { migrate, type Resume } from '../../shared/schema/resume'

/** 返回一份校验通过的示例简历（每次调用独立对象，可安全修改） */
export function createSampleResume(): Resume {
  // migrate 即 parse：保证内嵌数据永远合法，未来 schema 升级时此处自动暴露问题
  const resume = migrate(sample)
  return { ...resume, meta: undefined }
}
