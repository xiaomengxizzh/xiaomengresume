# F12 · API Key 管理（BYOK）— M5

> 本文件由 `scripts/split_docs.py` 从《项目功能.md》拆分（2026-08-08 路由化定案）；真相源 = 本文档。
> **✅ 已落码（2026-08-09 M3，设置屏 UI 提前 + Q10 扩展）**：settings.ai 屏——四家 tab（DeepSeek/火山/OpenAI/Gemini：apiKey 脱敏输入 + 官网「获取 API Key」+ 模型 ID + 启用开关）+ **自定义 OpenAI 兼容服务商**（`customProviders`：名称/baseURL/modelId/apiKey/启用）+ 全局参数（温度/最长上下文）+ 提示词四卡；`ai:config:get/save`（apiKey 入 safeStorage keyring，其余明文 store）。

### F12 · API Key 管理（BYOK）— M5
- **需求**：用户填写自带供应商 API Key，加密存本地，运行时解密使用。
- **实现框架**：设置界面输入 Key + 选模型/endpoint（豆包 `createOpenAI({ baseURL })`）；主进程 `safeStorage.encryptString` / `decryptString`；Linux 降级见《项目规范.md》4.6。
- **用户视角**：「设置 → AI 设置」填 Key + 选模型/填 endpoint，存本机加密；Windows/macOS 系统级加密，少数 Linux 降级并弹告警，不明文裸存。

#### F12 AI 设置具体化落地点（WP-S2 · S 阶段定案）

> 对应待拍板 #17（四服务商均纳入）；`SettingsSchema` 增 `providers` / `temperature` / `maxTokens`，R 批 `aiPrompts` 四键并入 `settings.ai` 功能屏。落码要点见《技术栈.md》§3.9 / §3.11。

1. **四服务商配置** `providers: { deepseek, volcengine, openai, google }`，每家 `{ apiKey?, modelId?, enabled }`——apiKey 走 `safeStorage`（含 Linux 降级），modelId/enabled 走明文 electron-store。
2. **全局 AI 参数**：`temperature`（0–1，默认 0.7，UI 0.01 步进）、`maxTokens`（默认 4096，硬上限 32768，UI 100 步进）。
3. **`settings.ai` 功能屏**：顶层四服务商横向 tab（DeepSeek / 火山引擎 / OpenAI / Gemini）；tab 面板右半 = API Key 输入（占位 `sk-...`）+「获取 API Key ↗」按钮（`shell.openExternal(providerLink)`）+ 模型 ID 下拉/手填 + 「启用」开关；左半 = 服务商名 + 简介 + 状态徽章（已连接 / 未配置 / 已禁用）；下方全局参数三卡 = 温度 / 最长上下文 / 系统提示词（复用 `AiPromptCard` 状态机，与 R 批 aiPrompts 四卡同款）。
4. **IPC**：`ai:config:get`（apiKey 脱敏返回前 4 后 4 + `••••`）/ `ai:config:save`（主进程按 providerId 分发：apiKey 入 safeStorage，其余入 store），冻结于 `src/shared/ipc-channels.ts`。
5. **AI handler 接入**：四 handler（`src/main/ai/{grammar,intro,polish,match}.ts`）经 `getAiConfig(providerId)`（`src/main/ai/config.ts`）统一读温度/maxTokens/model，缺省回退内置默认（DeepSeek `deepseek-chat` / 火山方舟 baseURL+用户 modelId / OpenAI `gpt-4o-mini` / Gemini `gemini-2.0-flash`）；`enabled=false` 抛 `PROVIDER_DISABLED`。
6. **服务商官网 URL 常量**（`src/main/ai/provider-links.ts`）：DeepSeek `https://platform.deepseek.com/api_keys` / 火山方舟 `https://www.volcengine.com/product/doubao` / OpenAI `https://platform.openai.com/api-keys` / AI Studio `https://aistudio.google.com/apikey`。
7. **i18n key**：`settings.ai.title/providers/deepseek/volcengine/openai/gemini/apiKey/getKey/modelId/enabled/connected/unconfigured/disabled/temperature/maxTokens/systemPrompt`（zh/en 同构）。
