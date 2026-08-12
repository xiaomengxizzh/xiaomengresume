# 导入 B 档评测报告（2026-08-12）

> 测试集 50 份 PDF 简历（S1 自造 4 / S2 开源 21 / S3 真实 25）· 天池三级加权 F1 · B 档本地规则（`rules.ts` 线上源码零 mock）
> 复现：`node scripts/import_bench.mjs --dump`

## 一、总体结果

| 分组 | n | 总 F1 | basics F1 | counts F1 |
|---|---|---|---|---|
| **S1 自造（王晨中文）** | 4 | **0.708** | 0.750 | 0.625 |
| **S2 开源（中英模板）** | 21 | **0.376** | 0.352 | 0.440 |
| **S3 真实（LinkedIn+bjherger）** | 25 | **0.355** | **0.071** | 0.540 |

**核心结论**：B 档对「中文自造、版式规整」的简历识别尚可（0.71），对**真实世界 PDF（尤其 LinkedIn 导出）基本失效**（basics 仅 0.071）。

## 二、按版式特征归类（识别难度）

| 特征 | 样本 | 表现 |
|---|---|---|
| 中文单栏/双栏（S1） | 王晨×4 | 最好，缺 address/headline |
| 英文单栏（sb2nov/S2 部分） | 0.50-0.60 | 中等 |
| 英文双栏（deedy/AltaCV） | 0.25-0.40 | 弱（unpdf 抽取乱序） |
| LinkedIn 导出（S3） | 0.14-0.43 | **basics 全灭** |
| 占位符模板（John Doe 系） | 0.33-0.40 | phone 占位符格式识别失败 |

## 三、失败根因分析（已代码实证）

### P0 · LinkedIn 导出 basics 全灭（S3 basics=0.071）
- **根因**：unpdf 抽取文本首行是 `Page 1`（分页标记）→ `Page 1⏎Andrew Wang⏎职位⏎邮箱` 整段归入 `unclassified`
- B 档 basics 提取要求「命中至少一个联系方式正则」才生效，但：
  1. `Page 1` 被当作姓名首行候选（污染）
  2. 邮箱在第三行，而 B 档 basics 处理对 unclassified 首段的姓名/职位行解析依赖行序，页标记插入后错位
  3. 部分 LinkedIn 样本无邮箱/电话（只有职位）→ 联系方式正则零命中 → basics 段整体放弃
- **影响**：25 份真实样本中 20 份 LinkedIn 全灭，拖垮 S3

### P1 · 电话格式覆盖不足（S2 多处）
- 占位符电话 `+1 (234) 567 890` / `(+82) 10-9030-1843` / `000-00-0000` / `+1-123-456-7890`
- B 档正则 `1[3-9]\d{9}|0\d{2,3}-\d{7,8}` 仅覆盖中国大陆手机/座机，**不覆盖国际格式/占位符**
- 命中失败 → 且电话是 basics 生效条件之一 → 连锁丢字段

### P2 · headline/address/location 提取弱（S1/S2 普遍缺）
- S1 中文缺 `headline`（职业）——B 档对「姓名行下一行的职位」无中文启发式
- S2 多处缺 address/location——占位符地址 `street and number – postcode city` 格式未识别

### P3 · counts 列表识别波动
- counts F1 0.44-0.54：多页（multipage 0.50）/双栏（deedy 0.25）/表格（table 0.50）明显低于单栏
- LinkedIn work 条目数识别 0.25-0.75 不稳定

## 四、badcase 回归层（F1 最低 10，后续改规则必测）

| F1 | 样本 | 缺字段 | 原因 |
|---|---|---|---|
| 0.14 | s2/Deedy-Resume-for-Chinese__resume | phone | 国际格式 1111 1111 111 |
| 0.14 | s3/linkedin/AndrewWang | name/email/headline | Page 1 污染 |
| 0.14 | s3/linkedin/BernardTraquena | name/email/headline | Page 1 污染 |
| 0.17 | s3/linkedin/SimYanTing | headline | 无联系方式 |
| 0.20 | s3/bjherger/Brendan_Herger_Resume | phone/email/address/website/headline | 多字段格式 |
| 0.25 | s2/Deedy*deedy_resume×2 | phone/website | 双栏乱序 |
| 0.25 | s3/linkedin/LesterChan | name/email/website/headline | Page 1 + 无电话 |
| 0.25 | s3/linkedin/WillisWee | name/email/website/headline | Page 1 + 无电话 |

## 五、改进建议（rules.ts，按优先级）

1. **P0：清理 PDF 抽取文本中的分页标记**（`Page N` / 页脚重复行）——在 `splitBySectionAnchors` 前 strip，或 unclassified 首段解析跳过 `Page \d+` 行 → **预期 S3 basics 从 0.071 → 0.5+**
2. **P0：电话正则扩展国际格式**（`+1 (234) 567 890` / `(+82) 10-...` / `+49 176`）→ 修复 S2 占位符 + bjherger
3. **P1：中文 headline 启发式**（姓名行后非空短行 = 职业）→ 修复 S1 中文
4. **P1：address/location 提取扩展**（`street and number – postcode city` 占位符格式、`Page St` 街址）
5. **P2：basics 生效条件放宽**——允许「仅姓名 + 无联系方式」时也提取 basics（LinkedIn 无邮箱样本）

## 六、备注

- ground truth：S1 由 sample-resume.json 精确生成；S2/S3 人工核对（basics 可靠；counts 为目测估算，评测后如命中异常已复核）
- A 档（AI 映射）未评测：样本与 expected.json 已就绪，后续 `XM_AI_KEY=1` 开关对比
- 图片简历（小红书扫描件）不在本测试集：无文本层，归 M6 vision 测试
- 测试集结构见 `material/import-cases/README.md`；s3/ 真实简历 gitignore 本地不入库
