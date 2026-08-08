/**
 * ModernTemplate —— modern 模板薄壳（F4：现代单栏）
 * 差异：左对齐节标题带左侧 accent 色条、留白更大、间距宽松（preset 1.15）。
 * 单栏铁律：ATS 默认兼容（设计保证，见《技术栈.md》§3.7）。
 */
import { ResumeBody } from '../shared/ResumeBody'

export function ModernTemplate(): React.JSX.Element {
  return <ResumeBody variant="modern" />
}
