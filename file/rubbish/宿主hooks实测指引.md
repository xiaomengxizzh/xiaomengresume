# 宿主 hooks 实测指引（草稿）

> 日期：2026-08-06 ｜ 定位：用户侧验证指南（过程文档）。合并归属 `file/rubbish/`（组长移动即可，不挂索引、不记日志、可随时清理）。
> 性质：用户操作指南。4 事件职责引用 WP-V1 §五（同源）；措辞保守——不承诺宿主支持、不写"必须配"。

## 一、背景

- **为什么测**：G.6 压缩恢复协议依赖 PreCompact 事件在压缩前刷新状态层；但本宿主**是否支持 PreCompact 事件未知**，需用户实测确认。
- **已核实事实（2026-08-06 实测）**：`~/.workbuddy/settings.json` 无 `hooks` 字段；未发现独立 hooks 配置文件；系统仅确认 `user-prompt-submit-hook` 一种事件存在。
- **结论**：**PreCompact 支持度未知，待实测**。本指引提供验证路径与可选配置，不保证结果。

## 二、3 步验证路径

| 步 | 动作 | 预期结果 |
|---|---|---|
| ① | 查 WorkBuddy 设置界面 / 官方文档，确认 hooks 配置入口与**支持的事件列表** | 得到本宿主支持的事件清单（是否含 PreCompact/SessionStart/Stop） |
| ② | 配最小 `user-prompt-submit-hook`（command = `echo hook-fired >> /tmp/hook-test.log`），发一条消息 | 日志文件出现 `hook-fired`，证明 hook 机制可用 |
| ③ | 依据 ① 的事件清单，确认是否含 **PreCompact** | 含 → 可配 G.6 自动状态刷新；不含 → 走 §五 降级路径 |

## 三、4 个值得配的事件

| 事件 | 职责（与 WP-V1 §五 一致） | 建议 |
|---|---|---|
| **SessionStart** | 只读注入：把 MEMORY.md 状态小节 + 本批简报注入首轮 | 可选：若宿主支持，提升续接速度 |
| **PreCompact** | 只写状态层：`docs-tool.py state` 刷新四要素到 MEMORY.md | **最有价值**：实现 G.6 自动续接；不支持则降级 |
| **Stop** | 只提醒不代写：提示"本批剩 X 项未合并" | 可选：防漏合并 |
| **UserPromptSubmit** | 只注入不写：注入相关状态片段 | 已确认存在，可复用 |

- **红线一致**：任何 hook 都**禁写 `file/` 正式文档**（只写 `.workbuddy/memory/`），与单写者铁律对齐。

## 四、配置示例（PreCompact 调 docs-tool state）

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "C:/Users/zzh/.workbuddy/binaries/python/versions/3.13.12/python.exe E:/ai/aiwork/newproject/xiaomengresume/scripts/docs-tool.py state"
          }
        ]
      }
    ]
  }
}
```

- **注意**：`state` 须 **< 1s**（防阻塞压缩）；写目标限定 `.workbuddy/memory/`（不碰 `file/`）；绝对路径按本机 managed Python 与项目根目录调整。
- 该示例**直接复制前须确认**：① 宿主支持 PreCompact；② `scripts/docs-tool.py` 已实现（本批仅规格，代码后置）；③ 路径正确。

## 五、不支持时的降级路径

1. **automation 定时**：用 WorkBuddy 自动化（每日批次收口）定时跑 `docs-tool.py state`，等价周期性刷新状态层；
2. **G.6 纪律（AI 自觉）**：会话收尾/压缩前，AI 自觉刷新 MEMORY.md 四要素（G.6 §三 时机），效果等价；
3. **会话开始手动 snapshot**：每次开工先 `docs-tool.py snapshot` 建基线（docs-tool 不依赖 hook 的核心逻辑独立可用）。

## 六、安全注意

- **只从可信来源复制配置**：hook 会执行命令，恶意配置 = 任意代码执行；
- **hook 越小越好**：只做一件事（如刷新状态），不串联复杂逻辑；
- **async 慎用**：阻塞型 hook（如 PreCompact）须快速返回，避免卡住宿主流程；
- **先测后留**：配完用 §二 验证，确认无误再长期保留。
