## 描述 / Description

请简要描述此 PR 做了哪些更改，以及为什么。

Closes #（请关联 Issue 编号）

## 变更类型 / Type of change

- [ ] Bug fix（非破坏性的缺陷修复）
- [ ] New feature（非破坏性的新功能）
- [ ] Refactor（重构，不改变外部行为）
- [ ] Documentation（仅文档更改）
- [ ] CI / Build（CI 配置或构建脚本更改）
- [ ] Other（请说明）

## 自检清单 / Checklist

- [ ] 代码通过 `pnpm lint`（ESLint + Prettier）
- [ ] 代码通过 `pnpm typecheck`（TypeScript 类型检查）
- [ ] 新增功能有对应的单元测试 / 集成测试
- [ ] 所有测试通过 `pnpm test`
- [ ] 数据模型变更遵守「仅增不改 / schemaVersion 保持 1 / 零迁移」基线
- [ ] 新增 IPC 通道名已在 `src/shared/` 契约中注册
- [ ] UI 文案已走 `t('key')`，未硬编码中文字符串
- [ ] 新增依赖已通过 G.2 三问检查（无原生编译 / 无额外二进制 / 非 2 年未发版）
- [ ] 我的更改没有产生新的警告

## 截图（如果涉及 UI 更改）

| 变更前 | 变更后 |
|--------|--------|
|        |        |

## 额外说明

任何需要 reviewer 特别关注的说明。