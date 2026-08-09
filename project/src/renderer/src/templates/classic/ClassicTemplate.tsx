/**
 * ClassicTemplate —— classic 模板薄壳（F4：三套共享 ResumeBody 渲染器）
 * 排版对标 material/简历示例1.pdf（variant='classic' 分支完整保留 PDF 细节）。
 * 2026-08-08 D11：store 驱动；F16 redact-field 已由 ResumeBody 统一挂载。
 */
import { ResumeBody } from '../shared/ResumeBody'
import type { Resume } from '@shared/schema/resume'

export function ClassicTemplate({ resume }: { resume?: Resume }): React.JSX.Element {
  return <ResumeBody variant="classic" resume={resume} />
}
