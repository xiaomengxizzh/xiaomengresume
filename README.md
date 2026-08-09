<div align="center">

# xiaomengresume

**开源免费 · 隐私优先 · 防盲信 AI 的简历工作台**

A desktop resume editor that respects your privacy and keeps you in control.

[![CI](https://github.com/xiaomengxizzh/xiaomengresume/actions/workflows/ci.yml/badge.svg)](https://github.com/xiaomengxizzh/xiaomengresume/actions/workflows/ci.yml)
[![Release](https://github.com/xiaomengxizzh/xiaomengresume/actions/workflows/release.yml/badge.svg)](https://github.com/xiaomengxizzh/xiaomengresume/actions/workflows/release.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-43+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

---

### 🛡️ 三大信任承诺 / Three Trust Promises

| 承诺 | 含义 |
|------|------|
| **真正免费** | 无水印、无付费墙、无隐藏收费、功能不阉割 |
| **数据主权** | 所有数据存本机、代码开源可审计、AI 用 BYOK（自带 Key） |
| **人工掌控** | AI 是辅助不是替代；导入简历走「三步核对」，绝不盲信 AI |

*以上承诺写进项目 DNA，任何界面文案不得与之矛盾。*

---

</div>

## 📖 About / 关于

xiaomengresume is a **clean-room built desktop resume editor** built with Electron. It's designed for job seekers who value privacy, hate paywalls, and want AI as a helpful assistant — not a replacement for human judgment.

> **中文简介**：一款从零构建的桌面简历编辑器，面向隐私敏感、被付费墙坑过、担心 AI 简历翻车的求职者。离线可用，本地存储，MIT 许可证，永久免费。

### Why xiaomengresume?

| Problem | Solution |
|---------|----------|
| Privacy concerns — resume data stored on third-party servers | **100% local storage** — your data never leaves your machine |
| Paywalls, watermarks, feature gating | **Truly free** — no accounts, no subscriptions, no hidden costs |
| AI-generated resumes all look the same | **AI as editor, not creator** — assistive only, no "one-click generate" |
| Importing old resumes is a black box | **Three-step verification** — review every field AI extracts |
| Overseas tools don't handle Chinese well | **Chinese-first** — native support for Chinese resumes and ATS |

## ✨ Features / 功能

| Feature | Status | Milestone |
|---------|--------|-----------|
| Resume data model (versioned JSON, Zod schema) | ✅ **Done (M1)** | M1 |
| Hybrid editor (structured form + Tiptap rich text) | ✅ **Done (M1)** | M1 |
| Undo / Redo (50-step history) | ✅ **Done (M1)** | M1 |
| Persistence & settings (atomic writes, crash recovery) | ✅ **Done (M1)** | M1/M5 |
| Internationalization (zh/en) | ✅ **Done (M0+)** | M0+ |
| Job directory & resume binding (data layer) | ✅ **Done (M1)** | v1.1 |
| Template system + themes (4 color themes) | 🚧 In progress (M2) | M2 |
| PDF export (vector, WYSIWYG) | 🚧 In progress (M2) | M2 |
| Privacy redaction mode | 📋 Planned | M2 |
| AI polish / grammar / match scoring (BYOK) | 📋 Planned | M3 |
| PDF / image import with 3-step verification | 📋 Planned | M4 |
| Auto-update via GitHub Releases | 📋 Planned | M5 |

> Full feature details & progress: [file/项目功能.md](file/项目功能.md) · [file/项目实现情况.md](file/项目实现情况.md) (Chinese)

## 🚀 Quick Start / 快速开始

### Prerequisites

- **Node.js** >= 22
- **pnpm** >= 11

### Development

```bash
# Clone (SSH)
git clone git@github.com:xiaomengxizzh/xiaomengresume.git
cd xiaomengresume

# Code lives in project/ (single repo, docs in file/)
cd project

# Install dependencies
pnpm install

# Start development
pnpm dev

# Lint & typecheck
pnpm lint
pnpm typecheck

# Run tests
pnpm test

# Build for production
pnpm build
```

### Download

Pre-built binaries will be published on the [Releases](https://github.com/xiaomengxizzh/xiaomengresume/releases) page (first release ships with M5):

- Windows: `.exe` (NSIS installer) + `.zip` (portable)
- macOS: `.dmg`
- Linux: `.AppImage`

## 🏗️ Tech Stack / 技术栈

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 43 |
| UI Framework | React 19 + TypeScript 5 |
| Build Tooling | Vite + electron-vite |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Rich Text | Tiptap v3 |
| State Management | Zustand |
| Validation | Zod |
| AI SDK | Vercel AI SDK v7 (BYOK, streamText) |
| i18n | react-i18next |
| Encryption | electron-store + safeStorage (AES-256-GCM) — API Key 加密（M3） |
| Packaging | electron-builder + GitHub Releases (M5) |
| CI | GitHub Actions |

> Full tech stack details: [file/技术栈.md](file/技术栈.md) (Chinese)

## 📁 Project Structure / 项目结构

```
xiaomengresume/
├── project/            # Application source (single git repo with docs below)
│   ├── src/shared/     # Zod schemas, IPC contracts, shared types
│   ├── src/main/       # Electron main process
│   └── src/renderer/   # React SPA
├── file/               # Project documentation (Chinese, 6 主文档 + detail/ 子文档层)
│   ├── 项目规范.md      # 唯一规范总集（路由/纪律/架构铁律）
│   ├── 技术栈.md        # 技术选型与架构
│   └── detail/         # 路由化子文档（functions/ logs/ api/）
├── scripts/            # Tooling scripts (docs-tool; split_docs = one-off doc splitter, already done)
├── .github/            # Issue/PR templates, CI, Release workflows
├── material/           # Sample resumes & reference assets
├── LICENSE
└── README.md
```

## 📚 Documentation / 文档（中文）

6 主文档体系 + 路由化子文档层，全部位于 `file/`：

| 文档 | 内容 |
|------|------|
| [项目介绍.md](file/项目介绍.md) | 是什么 / 为什么 / 面向谁 |
| [项目规范.md](file/项目规范.md) | **唯一规范总集**：文档体系 / 协作 / 纪律 / 架构铁律 |
| [技术栈.md](file/技术栈.md) | 技术选型、架构、依赖、约束与风险 |
| [项目功能.md](file/项目功能.md) | F1–F21 功能定义 + 路由表 |
| [项目实现情况.md](file/项目实现情况.md) | 已实现 / 待拍板 / 里程碑状态 |
| [项目日志.md](file/项目日志.md) | 开发记录流水（按月归档 `file/detail/logs/`） |

## 🤝 Contributing / 贡献

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:

- How to set up the development environment
- Code standards and architecture rules
- Commit convention (Conventional Commits)
- Pull request workflow

### Issue Templates

- [🐛 Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)
- [✨ Feature Request](.github/ISSUE_TEMPLATE/feature_request.md)

### Security

If you find a security vulnerability, please see [SECURITY.md](SECURITY.md) for our disclosure process.

## 📄 License

[MIT](LICENSE) © 2026 xiaomengresume contributors

Built from scratch. No third-party source code dependencies. Clean-room design.

---

<div align="center">
  <sub>Built with ❤️ for job seekers who value their privacy.</sub>
</div>
