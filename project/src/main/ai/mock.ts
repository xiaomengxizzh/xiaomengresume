/**
 * ai/mock.ts —— AI mock 流（M3，Q2 拍板：仅 dev 模式 + XM_AI_MOCK=1 启用）
 * 用途：无 API Key 的开发/CI 环境验证 IPC 链路与渲染层接线（不冒充真实 AI）。
 * 生产构建无此路径（is.dev 拦截）。
 */
import { is } from '@electron-toolkit/utils'
import type { GrammarIssue } from '../../shared/schema/grammar'
import type { MatchScore } from '../../shared/schema/match'
import type { AiIntroArgs, AiPolishArgs, AiGrammarArgs, AiMatchArgs } from '../../shared/ipc-channels'

/** dev + XM_AI_MOCK=1 时启用 mock */
export function isAiMock(): boolean {
  return is.dev && process.env.XM_AI_MOCK === '1'
}

export async function mockGrammar(_args: AiGrammarArgs): Promise<GrammarIssue[]> {
  return [
    { from: 0, to: 4, message: '（mock）示例语法问题：此处建议改写', suggestion: '示例修正' }
  ]
}

export async function mockIntro(
  args: AiIntroArgs,
  onDelta: (delta: string) => void
): Promise<string> {
  const sample = args.mode === 'translate'
    ? 'Mock translated summary: experienced software engineer with a proven track record.'
    : '（mock 草稿）拥有多年软件开发经验，具备良好的工程实践能力与团队协作精神。'
  for (const ch of sample) {
    await new Promise((r) => setTimeout(r, 8))
    onDelta(ch)
  }
  return sample
}

export async function mockPolish(
  _args: AiPolishArgs,
  onDelta: (delta: string) => void
): Promise<string> {
  const sample = '（mock 润色稿）负责核心模块的架构设计与落地，显著提升系统稳定性与可维护性。'
  for (const ch of sample) {
    await new Promise((r) => setTimeout(r, 8))
    onDelta(ch)
  }
  return sample
}

export async function mockMatch(_args: AiMatchArgs): Promise<MatchScore> {
  return {
    overall: 82,
    dimensions: [
      { name: '技能匹配', score: 85, comment: '（mock）核心技能与岗位要求高度契合' },
      { name: '经验深度', score: 80, comment: '（mock）相关领域经验充足' }
    ],
    suggestions: [
      { field: 'summary.content', text: '（mock）建议在自我评价中突出项目量化成果', priority: 'high' }
    ]  }
}
