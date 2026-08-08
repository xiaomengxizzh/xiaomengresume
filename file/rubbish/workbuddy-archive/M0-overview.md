# M0 骨架 — 交付概览

**日期**:2026-08-07 · **范围**:project/ 目录 · **目标**:技术栈冒烟验证(非功能开发)

## 启动前检查结论(用户提示缓存可能不完整 → 属实)

`deps-cache-reusable.tar.gz`(450 包)核对结果:

| 类别 | 结果 |
|---|---|
| 致命缺失 | electron 本体 / electron-vite / ai SDK v7 / zustand / electron-store / i18next / react-i18next / @electron-toolkit/preload / @tiptap/core / lucide-react / @types/react |
| 版本不符 | tailwindcss 缓存 3.4.17(项目要 ^4);electron 二进制缓存 33.4.11(项目要 ~43) |
| 决策 | 网络可用 → 直接联网 pnpm install,缓存仅作部分加速 |

## 交付清单

- [x] **脚手架**:electron-vite 5 + Vite 7 + React 19 + TS 5.9(strict)+ pnpm 11,`type: module`
- [x] **IPC 契约冻结**:`src/shared/ipc-channels.ts`(app:ping / app:get-info / print:pdf / ai:stream:test)+ AppInfo 类型
- [x] **令牌地基**:`src/shared/schema/settings.ts`(SettingsSchema:appearance/appearanceMode/language/temperature/maxTokens/providers/aiPrompts/storage/uiFont/resumeFont/importedFonts 全字段预留,zod v4)
- [x] **主进程**:窗口创建 + IPC 注册 + printToPDF 服务(`document.fonts.ready` 铁律时序)
- [x] **preload**:contextBridge 暴露 `window.electronAPI`(app/print/ai 三域)
- [x] **渲染进程**:i18n 脚手架(zh-CN/en 对称)+ 验证三卡 UI(IPC/PDF/AI 流式)+ 柔顺卡片风 CSS(light 令牌)
- [x] **工程资产**:MIT LICENSE / README 信任承诺 / GitHub Actions CI(typecheck+lint+test+build)/ eslint9 flat / prettier / .gitignore
- [x] **git**:已 init(分支 main),commit 待用户本机

## 验证结果

| 检查 | 结果 |
|---|---|
| `pnpm typecheck` | ✅ 全绿(node + web 双配置) |
| `pnpm lint` | ✅ 0 告警 |
| `pnpm test` | ✅ 4/4 通过(IPC 契约 + SettingsSchema 令牌) |
| `pnpm build` | ✅ 三端产物(main 3.94kB / preload 1.09kB / renderer 652kB) |
| AI SDK v7 ESM import | ✅ generateText / streamText / createDeepSeek 均可 import |
| electron 二进制 | ✅ 43.3.0(dist/version 确认) |

## 待用户本机验证(G.3 沙箱假阳性)

沙箱注入 `ELECTRON_RUN_AS_NODE=1` + GPU 不可用,GUI 冒烟无法在沙箱完成:

```bash
cd project
pnpm dev          # 开窗 → 点三张卡验证 IPC / 中文 PDF / AI 流式
git add -A && git commit -m "M0: skeleton"   # 首次 commit
git remote add origin <repo-url> && git push # 推 GitHub,CI 应绿
```

## 已知环境坑位(已写入项目记忆)

1. 跑 pnpm 需 `NODE_OPTIONS="--use-system-ca"` 覆盖 safe-delete 注入
2. pnpm 11 settings 在 `pnpm-workspace.yaml`(onlyBuiltDependencies + verifyDepsBeforeRun:false)
3. electron 构建脚本默认忽略 → 手动 `node node_modules/electron/install.js`
4. npm latest 有版本陷阱(TS7/vite8/eslint10),按《技术栈.md》锁定范围
