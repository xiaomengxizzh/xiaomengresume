# 导入测试集（import-cases）

> 2026-08-12 建 · 用途：评测 B 档本地规则（`project/src/main/import/rules.ts`）对不同版式 PDF 简历的字段识别质量（天池三级加权 F1）。A 档（AI 映射）样本保留待后续。

## 目录结构

| 目录 | 内容 | 入库 | 说明 |
|---|---|---|---|
| `s1/` | 自造王晨变体（单栏/双栏/多页/表格） | ✅ | 补中文缺口；王晨 JSON → 静态 HTML → Edge headless print-to-pdf |
| `s2/` | 开源中英文模板样本 | ✅ | 来源与许可见 `sources.json`；仅 PDF 文件（API 直下，不 clone 仓库） |
| `s3/` | 真实简历（LinkedIn parser / bjherger） | ❌ gitignore | **含真实个人信息，仅本地测试**；已匿名化（假 PII） |
| `.src-tmp/` | 仓库 clone 暂存 | ❌ gitignore | 收集过程临时用，用完即删 |

## 样本构成

| 级别 | 数量 | 来源 | 版式覆盖 |
|---|---|---|---|
| S1 | 4 | 自造（王晨） | 单栏/双栏/多页/表格 |
| S2 | ~20 | latexcv / moderncv / dyweb / deedy / Awesome-CV / sb2nov / AltaCV / typst 等 | 中英、单栏/双栏/sidebar/infographic |
| S3 | 17 | lesterchan/linkedin-pdf-resume-parser（12）+ bjherger/ResumeParser（5） | 真实世界分布 |

## 许可与隐私声明

- **s1/**：自造数据（虚构人物「王晨」），MIT 项目内可自由使用。
- **s2/**：各仓库许可证见 `sources.json`（MIT / Apache-2.0 / LPPL / CC-BY / Unlicense 等）；再分发保留对应许可证文本。
- **s3/**：真实简历含真人姓名/联系方式——**仅本地测试，不得随仓库分发**；已用假姓名/电话/邮箱/地址替换（假 PII 匿名化）。若需公开样本，参考 dotin 数据集做法（README 声明匿名化后公开）。

## ground truth 标注口径（expected.json）

按 **B 档当前可识别字段** 标注：

```jsonc
{
  "basics": { "name?", "phone?", "email?", "address?", "location?", "website?", "birthDate?", "employmentStatus?", "headline?" },
  "counts": { "education?", "work?", "projects?", "skills?" }
}
```

- 每份 PDF 一个 `expected.json` 同名存放；字段按简历中真实出现为准，缺失标 `null`。
- 标注来源：unpdf 抽取文本 → 人工核对填写。

## 评测

`scripts/import_bench.mjs`（天池三级加权 F1）：
- 单值字段（basics）：归一化后精确匹配
- 列表字段（counts）：条数多集匹配
- 长文本字段：字符重叠 P/R/F1
- 汇总：按版式分类统计平均 F1 + 命中率；每份输出命中/缺失/多余明细。

## 复现

```bash
# 依赖：node + Edge（s1 生成用）
node scripts/import_bench.mjs            # 跑全量评测（B 档）
# S3 收集与匿名化：见 s3/ 内说明（本地）
```
