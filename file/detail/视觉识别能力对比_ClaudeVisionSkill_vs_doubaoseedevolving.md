# 视觉识别能力对比：Claude Vision Skill vs doubao-seed-evolving

> 调研日期：2026-08-11。报告人：研究代理。全部关键论断附一手来源（GitHub 仓库源码/README、GitHub API、Dify 官方插件元数据、官方发布会报道）。
> 命名说明：`doubaoseedevolvin` = 火山方舟模型 `doubao-seed-evolving`（豆包 Seed 系列视觉模型）的用户口述简写。

## 一、结论先行

1. **选定的「claude vision skill」项目 = `asuojun/claude-vision-skill`**（github.com/asuojun/claude-vision-skill，1753★，无 License，JavaScript）。GitHub 搜索 `claude vision skill` 与 `claude-vision-skill` 均以它为最高星、名称最贴合的项目；Anthropic 官方 `anthropics/skills` 仓库中**不存在** vision 相关 skill（已核对其文件树）。
2. **它本身没有视觉能力**：它是一条"桥接工具链"——Node 脚本把图片转 base64 发给第三方 vision 模型（默认阿里云百炼千问 VL），把模型返回的文字描述喂回给无视觉能力的底座模型（如 DeepSeek）。识别能力的上限 = 它背后接的那个模型，不是它自己。
3. **`doubao-seed-evolving` 是模型本体**：字节豆包 Seed 旗舰通用模型（2026-06-23 随 Seed 2.1 上线），周更滚动发布、统一 Model ID、原生多模态视觉（图片+视频），走火山方舟 OpenAI 兼容 API。视觉是官方宣传的强项。
4. **两者是"工具链"与"模型"的关系，可互相组合**：`xiincs/claude-code-vision-skill`（167★，MIT，正规 Claude Code Skill 格式）正是一例——它内置豆包 provider，默认模型即 `doubao-seed-2-0-pro-260215`，把豆包 Seed 系列视觉接进了 Claude Code。
5. **本仓库现状 = 豆包直连方案**：本地 `~/.agents/scripts/vision-analyze.mjs` 直接调火山方舟 `/api/v3/chat/completions`、模型 `doubao-seed-evolving`，即"原生视觉模型直连"，比"claude vision skill 桥接"更简单、无第三方中转。

## 二、对比总表

| 维度 | asuojun/claude-vision-skill（选定） | xiincs/claude-code-vision-skill（备选，最接近的"真·Skill"） | doubao-seed-evolving（豆包 Seed 视觉模型） |
|---|---|---|---|
| 本质 | 工具链（桥接脚本 + CLAUDE.md 指令） | 工具链（正规 Claude Code Skill + CLI） | 视觉大模型本体（火山方舟托管） |
| 视觉实现 | 无原生能力；图片 base64 → 转发第三方 vision 模型 | 同左，多 provider 转发 | 原生多模态视觉（features: vision + video） |
| 默认后端 | 阿里云百炼 `qwen3.5-omni-plus` / `qwen-vl-max`（可换 OpenAI 等任意 OpenAI 兼容） | 豆包 `doubao-seed-2-0-pro-260215` / 千问 `qwen-vl-max` / `gpt-4o` / `claude-sonnet-5` / 任意自定义 | 自身（火山方舟） |
| 输入格式 | 本地图片（jpg/png/gif/webp/bmp）、图片 URL | 本地图片 png/jpg/jpeg/webp/gif | 图片；视频（按 Dify 元数据）；API 层为 OpenAI `image_url` 内容块 |
| 输出 | 模型的文字描述（OCR/描述/问答），无结构化、无坐标 | 同左 | 文字/JSON；可配 `reasoning_effort`（minimal/low/medium/high） |
| 上下文 | 无（单次请求，`max_tokens` 默认 1024） | 无（单次请求，`max_tokens` 默认 4096） | 官方宣称 1M（约 26 万 token 于 Dify 元数据，疑旧版） |
| 使用方式 | `node vision.js <图片> [问题]`，CLAUDE.md 指示 AI 在遇到图片时自动调用 | `python vision.py <图片> <提示>`，SKILL.md 自动触发 + SessionStart 路由钩子 | 直接 API：`POST /api/v3/chat/completions`（OpenAI 兼容），也可经 `/responses` |
| 依赖模型数 | 1 个 vision 后端 + 1 个底座模型 | 4 内置 + 任意自定义 | 自身（无需额外模型） |
| 获取成本/许可 | 开源免费但**无 License**（使用有法律风险）；模型调用按量付费 | MIT 开源；模型调用按量付费 | 闭源商业 API：输入 ¥6 / 输出 ¥30 每百万 token（Dify 元数据）；另有月套餐 ¥9.9 |
| 隐私 | 图片发往第三方（阿里云/OpenAI），双重出本机 | 同左（豆包/千问/OpenAI/Anthropic 任选） | 图片发往火山方舟（仍属"出本机"，但链路单一、无需二次转发） |
| 可靠性/局限 | 能力取决于后端模型；无 license；脚本简单无容错 | 功能完整（路由/多 provider/测试），能力仍取决于后端模型 | 官方周更迭代、幻觉控制改善；闭源、依赖国内 API 网络 |

## 三、任务 A：claude vision skill 项目定位与实现机制

### A.1 选定项目

检索过程：GitHub API 搜索（`api.github.com/search/repositories?q=claude+vision+skill` 与 `q=claude-vision-skill`），命中多个候选；再核验 Anthropic 官方 `anthropics/skills` 仓库文件树——无任何 vision/screenshot 类 skill。

| 候选 | 星数 | License | 备注 |
|---|---|---|---|
| **asuojun/claude-vision-skill**（选定） | 1753 | 无 | 名称与"claude vision skill"完全对应，星数最高 |
| xiincs/claude-code-vision-skill | 167 | MIT | 正规 Skill 格式，内置豆包视觉，与本次对比最相关 |
| mikefutia/claude-vision | 87 | 无 | "Claude Vision Skill (Mike Futia \| SCALE AI)" |
| lqc2007224-max/claude-code-vision-skill | 24 | 无 | Gemini + Qwen-VL 双引擎 |
| Anionex/agent-vision-toolkit | 388 | MIT | 面向纯文本模型的通用视觉工具箱 |

选定仓库元数据（GitHub API，2026-08-11）：`asuojun/claude-vision-skill`，创建 2026-05-02，最后 push 2026-05-02，83 forks，语言 JavaScript，仓库无 description，**无 License**。

### A.2 实现机制（源码/README，一手）

文件结构仅 5 个文件：`vision.js`（核心脚本）、`CLAUDE.md`、`README.md`、`cyberboss-setup.md`、`.gitignore`。

- **获得视觉的方式：纯桥接，非模型。** `vision.js` 读取本地图片（或 `--url` 图片链接）→ 转 base64 data URL → POST 到 OpenAI 兼容的 `chat/completions`（默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`，阿里云百炼）→ 打印模型文字回复。（来源：`vision.js` 源码，github.com/asuojun/claude-vision-skill/blob/master/vision.js）
- **默认后端模型**：千问 `qwen3.5-omni-plus` / `qwen-vl-max`（README 推荐，新用户 100 万 token 免费），可选 OpenAI `gpt-4o-mini` 或"任何 OpenAI 兼容格式"——改 `BASE_URL` 与模型名即可，不绑定厂商。（来源：README.md）
- **与 Claude Code 的集成方式：不是正式 Skill，是"脚本 + CLAUDE.md 指令"。** CLAUDE.md 写死规则："你的底层模型不具备原生识图能力。遇到图片时，不要用 Read 工具，改用 `node vision.js "<图片路径>" "..."`"。触发场景包括用户分享图片路径/URL、"Saved attachments:" 附件等。（来源：CLAUDE.md）
- **输入输出**：输入本地图片或图片 URL；输出为后端模型的文字描述（支持描述、OCR 类问答、按问题回答），无结构化数据、无坐标定位。（来源：vision.js / README.md）
- **运行方式**：`node vision.js <图片路径> [问题]`，依赖 Node + 可选 dotenv；API key 走 `DASHSCOPE_API_KEY` 环境变量或 `.env`。脚本无重试、无批处理。（来源：vision.js）
- **目标用户**：以 DeepSeek 等无视觉能力模型为 Claude Code 底座的用户——补齐"看图"能力。（来源：README.md / CLAUDE.md）

### A.3 备选：xiincs/claude-code-vision-skill（最接近的"真·Skill"，且用豆包）

- 正规 Claude Code Skill 格式（`vision/SKILL.md`）+ Python CLI（`vision/vision.py`）+ `install.py` 安装器 + pytest 测试 + SessionStart 钩子做"原生/外部"视觉路由判断。（来源：README.md，github.com/xiincs/claude-code-vision-skill）
- 多 provider 转发架构，**内置豆包 provider**：默认模型 `doubao-seed-2-0-pro-260215`、base `https://ark.cn-beijing.volces.com/api/v3`（即火山方舟），走 OpenAI 兼容协议；另支持千问、OpenAI、Anthropic 及任意自定义端点。（来源：vision/vision.py `PROVIDERS` 表、vision/SKILL.md）
- 支持输入 png/jpg/jpeg/webp/gif；定位"截图/UI/图表分析 + 前端布局自动化检查（配合 browser-harness 截图）"。（来源：vision.py `MIME_MAP`、README.md）
- **对本仓库的启示**：它证明了"豆包 Seed 系列视觉能力 + Claude Code 生态"是已被社区验证的组合路径；且它内置的 Ark base URL 与本仓库 `vision-analyze.mjs` 完全一致。

## 四、任务 B：doubao-seed-evolving 视觉能力（官方/一手交叉）

> 火山方舟官方文档站（docs.volcengine.com/docs/82379/*）与 Ark 控制台模型页为 JS 渲染，WebFetch 抓不到正文（实测空页）；以下结论用官方发布报道、官方生态元数据、官方推广语转引三路交叉，不确定性逐条标注。

1. **身份与归属**：`doubao-seed-evolving` 是字节豆包 Seed 系列的旗舰通用模型，2026-06-23 随 Doubao-Seed 2.1 在火山引擎 FORCE 大会上线迭代，定位"深度思考模型"，面向 Agent 与 Coding 场景（复杂任务编排、长程规划、代码生成、工具调用）。闭源，仅 API 访问，无公开参数规模。（来源：IT之家 2026-06-23《字节豆包 Seed 2.1 Pro 和 Turbo 深度思考模型发布》ithome.com/0/967/314.htm）
2. **"一张永远最新的模型卡片"**：取消版本号，以周为单位滚动更新，统一 Model ID `doubao-seed-evolving`，调用方"一次接入、无感升级、零迁移成本"，每周至少一个版本。（来源：官方推广语（ruanyf 周刊转引），github.com/ruanyf/articles/blob/main/2026/ar/20260808-seed-evolving.md；IT之家）
3. **视觉能力（核心问题）**：
   - Dify 官方插件元数据明确列出 features：`vision`、`video`、`agent-thought`、`tool-call` 等 → 原生多模态，图片+视频输入。（来源：github.com/langgenius/dify-official-plugins/blob/main/models/volcengine/models/llm/doubao-seed-evolving-latest-version.yaml）
   - 官方向媒体宣传：Seed 模型具备视觉能力，且是强项（"视觉能力不用说，这是它的强项"）。（来源：ruanyf 周刊转引官方推广）
   - **注**：IT之家发布报道仅把"多模态理解"记在 2.1 Pro/Turbo 名下、未单列 evolving——与本仓库实测（doubao-seed-evolving 已稳定用于图像分析）及 Dify 元数据不一致，按多数证据判定：支持视觉，图片输入可靠，视频输入据 Dify 元数据标注。
4. **上下文长度**：官方推广语与 2026-07 中文媒体均称 1M 上下文；Dify 元数据标 `context_size: 262144`（256K，疑旧版本）。**两值不一致，以官方 1M 为准，标注"未查到官方权威单页数值"**。（来源：ruanyf 周刊；知乎/掘金 2026-07-15《Doubao-Seed-Evolving 升级：1M 上下文来了》；Dify YAML）
5. **API 调用方式**：火山方舟 OpenAI 兼容。`POST https://ark.cn-beijing.volces.com/api/v3/chat/completions`，消息体 `content` 数组含 `image_url`（base64 data URL 或 URL）+ `text`；新版本还支持 `openai-responses` 协议；支持 `reasoning_effort` 参数（minimal/low/medium/high，旗舰默认 high）。（来源：本仓库 `~/.agents/scripts/vision-analyze.mjs` 实测；github.com/CherryHQ/cherry-studio/blob/main/packages/provider-registry/src/providers/doubao.ts）
6. **定价**：按量 input ¥6 / output ¥30 每百万 token（Dify 元数据）；另有单月套餐 ¥9.9（ruanyf 转引官方）。**以方舟控制台实时价格为准**。
7. **能力侧重**：Coding 工程、Agent 检索/工具调用显著增强，幻觉控制改善；官方称在长程任务质量评分中超越 Doubao-Seed-2.1-pro。（来源：ruanyf 转引官方推广语）

## 五、任务 C：对比要点分析与场景建议

- **本质差异：模型 vs 工具链。** doubao-seed-evolving 自身具备视觉理解（模型能力）；claude vision skill 不产生能力，只是把图"递"给另一个模型。任何"claude vision skill"的识别质量都无法超过其接的模型，而 doubao-seed-evolving 的识别质量即模型本身。
- **识别能力域**：doubao 覆盖 OCR、布局/UI 理解、语义理解、多模态推理（图片+视频、1M 上下文支持长文档/多图场景）；claude vision skill 的输出完全取决于后端（默认千问 VL），且单请求 `max_tokens` 默认仅 1024，不适合作长分析。
- **使用方式**：claude vision skill 绑定 Claude Code 生态（脚本/CLAUDE.md/SKILL.md 触发）；doubao 是通用 OpenAI 兼容 API，任何语言/框架一行调用（本仓库 vision-analyze.mjs 即如此）。
- **成本**：claude vision skill 本体免费但**无 License**（不得商用，风险自负）且仍需自备 vision 后端 key 按量付费；doubao 为官方计费（或 ¥9.9 月套餐），链路单一无中间商。
- **隐私/可靠性**：claude vision skill 图片二次转发（本机 → 阿里云/OpenAI），数据出本机两次；doubao 直连火山方舟一次。两者都不满足"全本机"，但直连方案面更小、可控性更好。幻觉风险同属大模型通用问题，doubao 官方称已改善幻觉控制。
- **适合场景**：
  - doubao-seed-evolving 直连 → 本仓库开发期像素级视觉核验（对照 material/ 示例图逐项比对布局/样式，问题导向问答），简单、稳定、与既有 key 复用；也是任何"一次性图片分析"的默认选择。
  - claude-vision-skill 类桥接 → 仅当底座模型无视觉且不想换底座（如必须用 DeepSeek 当 Claude Code 底座）时补位；选 `xiincs/claude-code-vision-skill`（MIT，内置豆包）优于 `asuojun` 版（无 License、非正式 Skill 格式）。
  - 两者可叠加：把 doubao-seed-evolving 配成 xiincs 的自定义 provider，既保留底座模型，又复用豆包视觉——与本仓库现有 API key 直接兼容。

## 六、来源清单（一手优先）

| # | 来源 | URL | 用途 |
|---|---|---|---|
| 1 | GitHub API 仓库搜索 | https://api.github.com/search/repositories?q=claude+vision+skill | 候选项目检索 |
| 2 | asuojun/claude-vision-skill（GitHub API 元数据） | https://api.github.com/repos/asuojun/claude-vision-skill | 星数/时间/License/语言 |
| 3 | asuojun/claude-vision-skill · README.md | https://github.com/asuojun/claude-vision-skill/blob/master/README.md | 项目定位/后端模型/配置流程 |
| 4 | asuojun/claude-vision-skill · vision.js（源码） | https://github.com/asuojun/claude-vision-skill/blob/master/vision.js | 实现机制（base64→OpenAI 兼容 API） |
| 5 | asuojun/claude-vision-skill · CLAUDE.md | https://github.com/asuojun/claude-vision-skill/blob/master/CLAUDE.md | 与 Claude Code 集成方式 |
| 6 | anthropics/skills 官方仓库文件树 | https://github.com/anthropics/skills | 核验官方无 vision skill |
| 7 | xiincs/claude-code-vision-skill（GitHub API + README） | https://github.com/xiincs/claude-code-vision-skill | 备选项目元数据与能力 |
| 8 | xiincs · vision/vision.py（源码） | https://github.com/xiincs/claude-code-vision-skill/blob/main/vision/vision.py | 内置豆包 provider / Ark base URL / 输入格式 |
| 9 | xiincs · vision/SKILL.md | https://github.com/xiincs/claude-code-vision-skill/blob/main/vision/SKILL.md | provider 表与路由机制 |
| 10 | Dify 官方插件 · doubao-seed-evolving 元数据 YAML | https://github.com/langgenius/dify-official-plugins/blob/main/models/volcengine/models/llm/doubao-seed-evolving-latest-version.yaml | vision/video 特性、context_size、定价 |
| 11 | Cherry Studio · provider-registry doubao.ts | https://github.com/CherryHQ/cherry-studio/blob/main/packages/provider-registry/src/providers/doubao.ts | Ark 协议、effort 参数、种子 2.x 模型族 |
| 12 | 阮一峰周刊（转引官方推广语，二手） | https://github.com/ruanyf/articles/blob/main/2026/ar/20260808-seed-evolving.md | 周更机制、1M 上下文、视觉强项、月套餐 |
| 13 | IT之家（官方发布会报道，二手） | https://www.ithome.com/0/967/314.htm | 2026-06-23 发布、定位 Agent/Coding |
| 14 | 本仓库 `~/.agents/scripts/vision-analyze.mjs` | 本机（不入库） | Ark /api/v3 直连实测、image_url 传图格式 |
| — | 火山方舟模型详情页 | https://ark.volcengine.com/region:cn-beijing/model/detail?name=doubao-seed-evolving | JS 渲染，WebFetch 未取到正文，标注"未查到" |
| — | 火山方舟文档站 82379 系列 | https://docs.volcengine.com/docs/82379/1330310 | JS 渲染，正文未取到，标注"未查到" |
