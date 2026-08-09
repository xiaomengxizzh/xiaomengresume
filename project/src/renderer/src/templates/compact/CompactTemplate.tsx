/**
 * CompactTemplate —— compact 模板薄壳（F4：紧凑单栏）
 * 差异：行距收紧、节标题小号加粗、一页内承载更多条目（preset 0.85）。
 * 单栏铁律：ATS 默认兼容（设计保证）。
 */
import { ResumeBody } from '../shared/ResumeBody'
import type { Resume } from '@shared/schema/resume'

export function CompactTemplate({ resume }: { resume?: Resume }): React.JSX.Element {
  return <ResumeBody variant="compact" resume={resume} />
}
