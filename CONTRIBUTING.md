# Contributing to xiaomengresume

欢迎贡献！本指南帮助你快速上手。

> **项目定位**：开源免费 · 隐私优先 · 防盲信 AI 的简历工作台
> **许可**：MIT

---

## 目录

- [环境要求](#环境要求)
- [本地开发](#本地开发)
- [项目结构](#项目结构)
- [代码规范](#代码规范)
- [Commit 约定](#commit-约定)
- [PR 流程](#pr-流程)
- [Issue 指南](#issue-指南)

---

## 环境要求

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | >= 22 | 推荐使用 [fnm](https://github.com/Schniz/fnm) 或 [nvm](https://github.com/nvm-sh/nvm) 管理 |
| pnpm | >= 11 | 本项目强制使用 pnpm，`package.json` 中已锁定 `packageManager` |
| Git | >= 2.40 | 用于版本管理 |

## 本地开发

```bash
# 1. 克隆仓库
git clone git@github.com:xiaomengxizzh/xiaomengresume.git
cd xiaomengresume

# 2. 安装依赖（pnpm 必须）
pnpm install

# 3. 启动开发环境
pnpm dev          # 启动 Electron 开发窗口（热重载）

# 4. 其他常用命令
pnpm lint         # ESLint + Prettier 检查
pnpm typecheck    # TypeScript 类型检查
pnpm test         # 运行测试
pnpm build        # 构建生产版本
```

> **注意**：本项目使用 `electron-vite` 管理构建管线，主进程与渲染进程分别编译。首次启动如遇问题，请确认 Node.js 版本 >= 22。

## 项目结构

```
xiaomengresume/
├── project/            # 应用源码（Electron 主进程 + React 渲染进程 + shared 契约层）
│   └── src/
│       ├── shared/     # Zod schema、IPC 契约、类型（主/渲染进程共享）
│       ├── main/       # Electron 主进程（AI / 文件 / 打印 / 加密 / IPC handlers）
│       └── renderer/   # React SPA（编辑器 / 预览 / 设置 / 导入向导）
├── file/               # 项目文档（6 主文档 + detail/ 子文档层）
├── .github/            # Issue/PR 模板、CI、Release workflows
├── scripts/            # 文档工具脚本（docs-tool；split_docs 历史一次性拆分、已完成）
├── LICENSE
└── package.json
```

## 代码规范

### 通用

- **TypeScript**：严格模式，所有代码必须通过 `pnpm typecheck`
- **命名风格**：文件名使用 kebab-case（`my-component.tsx`），类型和接口使用 PascalCase，函数和变量使用 camelCase
- **格式化**：Prettier 统一格式，提交前运行 `pnpm lint`

### 架构铁律

1. **主进程统一承载 AI / 文件 / 打印 / 加密**，渲染进程纯 UI，API Key 永不落前端
2. **Zod 简历数据模型为唯一事实源**，编辑态与打印态共享数据模型 + CSS 变量
3. **AI 定位**：只做辅助编辑（润色 / 语法 / 匹配度），**禁止「一键生成简历」**
4. **所有 IPC 通道名**必须在 `src/shared/` 中注册，主进程 handler → preload 暴露 → 渲染进程调用
5. **UI 文案**从第一行代码起走 `t('key')`，禁止硬编码中文字符串

### 数据模型规范

- 数据模型变更遵守「仅增不改 / schemaVersion 保持 1 / 零迁移」基线
- 简历 JSON 顶层 schema 首字段为 `schemaVersion: z.literal(1)`
- 每次 schema 变更 → 升版本 → 加 `migrate()` case

### 依赖引入（G.2 三问）

引入新依赖前，请自问三个问题：

1. **需要原生编译吗？**（高风险，尽量避开）
2. **会下载额外二进制吗？**（高风险，需要离线缓存方案）
3. **npm 上超过 2 年没发版了吗？**（中风险，可能弃坑）

## Commit 约定

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/)，格式：

```
<type>(<scope>): <简短描述>

<详细说明（可选）>
```

### 常用 type

| type | 含义 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `refactor` | 重构 |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响功能） |
| `chore` | 构建/CI/依赖变更 |
| `test` | 测试相关 |
| `perf` | 性能优化 |

### 示例

```
feat(editor): 添加撤销/重做功能（50 步历史栈）
fix(export): 修复中文 PDF 乱码问题
docs(readme): 更新快速开始指南
```

## PR 流程

1. **Fork 仓库** 并创建你的特性分支（`feat/xxx` 或 `fix/xxx`）
2. **提交代码**：确保通过 `pnpm lint`、`pnpm typecheck`、`pnpm test`
3. **填写 PR 模板**：关联 Issue，完成自检清单
4. **等待审核**：维护者会 review 并给出反馈
5. **合并**：通过后 squash merge 到 main 分支

### 提交前请确认

- [ ] `pnpm lint` 通过
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过
- [ ] 新增功能有对应测试
- [ ] 数据模型变更已走「仅增不改」原则
- [ ] UI 文案使用 `t('key')` 而非硬编码
- [ ] 新增依赖已过 G.2 三问
- [ ] **新增/变更超出《项目介绍》《项目功能》《技术栈》描述范围 → 已同步对应文档**（含索引表，与代码同批提交；仅修复既有行为则显式标注无需动）

## Issue 指南

- **Bug 报告**：请使用 Bug Report 模板，提供完整的复现步骤和环境信息，并附上日志（设置 → 关于 → 导出日志）
- **功能请求**：请使用 Feature Request 模板，说明场景和方案，并确认不与三大信任承诺冲突
- **提问 / 讨论**：请使用 [Discussions](https://github.com/xiaomengxizzh/xiaomengresume/discussions)

---

**再次感谢你的贡献！** 🎉