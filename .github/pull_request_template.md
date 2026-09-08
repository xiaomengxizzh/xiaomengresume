## 摘要 / Summary

清晰描述本次改动做了什么、为什么。

Closes #（请关联 Issue 编号）

## 变更类型 / Type of change

- [ ] `feat` 新功能
- [ ] `fix` 修复 Bug
- [ ] `refactor` 重构（不改变外部行为）
- [ ] `docs` 文档变更
- [ ] `style` 代码格式（不影响功能）
- [ ] `chore` 构建 / CI / 依赖变更
- [ ] `test` 测试相关

## 自检清单 / Checklist

- [ ] `pnpm lint` 通过（ESLint + Prettier）
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过
- [ ] 新增功能有对应测试
- [ ] 数据模型变更遵守「仅增不改 / schemaVersion 保持 1 / 零迁移」基线
- [ ] 新增 IPC 通道名已在 `src/shared/` 契约中注册
- [ ] UI 文案已走 `t('key')`，未硬编码中文字符串
- [ ] 新增依赖已通过 G.2 三问（无原生编译 / 无额外二进制 / 非 2 年未发版）
- [ ] 涉及持久化 / 自动保存 / 启动恢复 / 路由跳转的改动已通过 UI 冒烟（G.3 UI 轨）

## 项目定位符合性 / Project alignment

- [ ] 不与「开源免费 · 隐私优先 · 防盲信 AI」三大信任承诺冲突
- [ ] 不涉及「一键生成简历」等 AI 替代人工的功能

## 截图（如果涉及 UI 更改）

| 变更前 | 变更后 |
|--------|--------|
|        |        |

## 额外说明

任何需要 reviewer 特别关注的说明。
