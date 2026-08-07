<div align="center">

# xiaomengresume

**开源免费 · 隐私优先 · 防盲信 AI 的简历工作台**

A desktop resume editor that respects your privacy and keeps you in control.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-43+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

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

> **中文简介**：一款从零构建的桌面简历编辑器，面向隐私敏感、被付费墙坑过、担心 AI 简历翻车的求职者。离线可用，本地存储，Mit 许可证，永久免费。

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
| Resume data model (versioned JSON, Zod schema) | ✅ Planned | M1 |
| Hybrid editor (structured form + Tiptap rich text) | ✅ Planned | M1 |
| Undo / Redo (50-step history) | ✅ Planned | M1 |
| Template system + themes (4 color themes) | ✅ Planned | M2 |
| PDF export (vector, WYSIWYG) | ✅ Planned | M2 |
| Privacy redaction mode | ✅ Planned | M2 |
| AI polish / grammar / match scoring (BYOK) | ✅ Planned | M3 |
| PDF / image import with 3-step verification | ✅ Planned | M4 |
| Multi-resume management | ✅ Planned | M1/M5 |
| Job directory & resume binding | ✅ Planned | v1.1 |
| Internationalization (zh/en) | ✅ Planned | M0+ |
| Auto-update via GitHub Releases | ✅ Planned | M5 |

> See full feature details in [file/项目功能.md](file/项目功能.md) (Chinese).

## 🚀 Quick Start / 快速开始

### Prerequisites

- **Node.js** >= 22
- **pnpm** >= 9

### Development

```bash
# Clone
git clone https://github.com/你的用户名/xiaomengresume.git
cd xiaomengresume

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

Pre-built binaries are available on the [Releases](https://github.com/你的用户名/xiaomengresume/releases) page:

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
| Encryption | electron-store + safeStorage (AES-256-GCM) |
| Packaging | electron-builder + GitHub Releases |
| CI | GitHub Actions |

> Full tech stack details: [file/技术栈.md](file/技术栈.md) (Chinese)

## 📁 Project Structure / 项目结构

```
xiaomengresume/
├── src/
│   ├── shared/        # Zod schemas, IPC contracts, shared types
│   ├── main/          # Electron main process
│   └── renderer/      # React SPA
├── .github/           # Issue/PR templates, CI
├── scripts/           # Tooling scripts
├── file/              # Project documentation (Chinese)
└── package.json
```

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

[MIT](LICENSE) © 2025 xiaomengresume contributors

Built from scratch. No third-party source code dependencies. Clean-room design.

---

<div align="center">
  <sub>Built with ❤️ for job seekers who value their privacy.</sub>
</div>