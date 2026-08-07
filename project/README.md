# xiaomengresume

<p align="center">
  <img src="build/icon.png" width="160" height="160" alt="xiaomengresume 图标">
</p>

> **开源免费 · 隐私优先 · 防盲信 AI 的简历工作台**

一款离线优先的桌面简历编辑器。您的简历数据**仅保存在本机**，不经过任何服务器；AI 只做**辅助编辑**（润色 / 语法纠正 / 匹配打分 / 自我介绍），**绝不一键生成简历**——最终内容由您掌控。

## 信任承诺

- ✅ **离线优先**：简历数据只存本机（默认 `文档/xiaomengresume`），无云端、无账号、无遥测
- ✅ **AI 辅助而非代笔**：AI 输出始终以草稿形式呈现，接受 / 放弃由您决定
- ✅ **不编造事实**：AI 提示词硬约束——只改已有内容，禁止虚构简历外信息
- ✅ **API Key 安全**：服务商 Key 经操作系统级加密（safeStorage）保存，绝不落盘明文
- ✅ **开源透明**：MIT 许可，代码全部公开，可自行审计

## 技术栈

Electron · electron-vite · React 19 · TypeScript (strict) · Zod · Zustand · pnpm

> 编辑器富文本（Tiptap）与样式方案（Tailwind CSS v4）按里程碑随 M1/M2 引入，不阻塞当前骨架。

## 开发

```bash
pnpm install
pnpm dev        # 开发模式（热更新）
pnpm build      # 构建（主进程 / preload / 渲染进程）
pnpm typecheck  # 类型检查
pnpm lint       # ESLint
pnpm test       # Vitest
```

## 路线图

- **M0 骨架**（当前）：脚手架 + IPC 契约 + 中文 PDF 导出链路 + AI 流式链路验证
- **M1 编辑器**：结构化简历编辑（字段集 / 撤销重做 / 保存）
- **M2 模板**：模板系统 + PDF 导出 + 隐私打码
- **M3 AI**：语法纠正 / 自我介绍 / 润色 / 匹配打分 + 岗位目录
- **M4 导入**：PDF / Word / JSON 导入核对
- **M5 发布**：设置完善 + 打包发布

## 许可

MIT © xiaomengresume contributors
