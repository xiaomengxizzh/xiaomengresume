# -*- coding: utf-8 -*-
import re, io

SRC = r"E:/ai/aiwork/newproject/xiaomengresume/file/原型线框图.html"
html = io.open(SRC, encoding="utf-8").read()
orig = html
report = []

def rep(old, new, label):
    global html
    n = html.count(old)
    html = html.replace(old, new)
    report.append((label, n))

# R1 header comment (line 24)
rep("全部 13 张界面线框图(①–⑬) + 图例",
    "全部 12 张界面线框图(①–⑪/⑬，⑫ ATS 屏已移除) + 图例", "R1 header comment")

# R2 line 27 comment
rep("2026-08-05 修订：纳入 F16 隐私打码 / F17 ATS 提示 / 开源免费定位 / 新增 ⑬ 模板编辑与主题定制（F4）。",
    "2026-08-05 修订：纳入 F16 隐私打码 / 开源免费定位 / 新增 ⑬ 模板编辑与主题定制（F4）；移除 F17 ATS 提示（默认所有模板兼容 ATS）。", "R2 header 修订说明")

# R3 meta line 30
rep("定稿 2026-08-05 · 2026-08-05 修订：纳入 F16 隐私打码 / F17 ATS 提示 / 开源免费定位 / 新增 ⑬ 模板编辑与主题定制（F4）· 配套",
    "定稿 2026-08-05 · 2026-08-05 修订：纳入 F16 隐私打码 / 开源免费定位 / 新增 ⑬ 模板编辑与主题定制（F4）；移除 F17 ATS 提示（默认所有模板兼容 ATS）· 配套", "R3 meta 修订说明")

# R4 ④ heading
rep("（F4，含 F17 ATS 角标）", "（F4）", "R4 ④ heading")

# R5 ④ ATS⚠ badge
rep('    <rect x="540" y="100" width="48" height="16" rx="4" fill="#3a2f12" stroke="#EF9F27" stroke-width="1"/>\n'
    '    <text x="546" y="112" style="fill:#EF9F27;font:500 9px sans-serif;">ATS⚠</text>\n', '', "R5 ④ ATS⚠ badge")

# R6 ④ desc
rep("套用后右侧预览实时换皮。<b>非 ATS 友好模板（如「学术衬线」）在缩略图右上角打「ATS⚠」角标（F17）</b>，提示导出前检查兼容性。",
    "套用后右侧预览实时换皮，所有内置模板默认兼容 ATS（单栏/标准标题/系统字体/文字可选）。", "R6 ④ desc")

# R7 ⑦ heading
rep("（F5，内嵌 F17 ATS 检查卡）", "（F5）", "R7 ⑦ heading")

# R8 ⑦ ATS card (8 lines)
rep('    <rect x="130" y="338" width="410" height="100" rx="10" class="box"/>\n'
    '    <text x="144" y="358" class="lbl" style="font-size:12px;">ATS 兼容性检查（F17）</text>\n'
    '    <text x="144" y="380" class="ok" style="font:500 11px sans-serif;">✓ 单栏布局</text>\n'
    '    <text x="144" y="400" class="ok" style="font:500 11px sans-serif;">✓ 文字可选中</text>\n'
    '    <text x="144" y="420" class="ok" style="font:500 11px sans-serif;">✓ 标准 section 命名</text>\n'
    '    <text x="340" y="380" class="warn" style="font:500 11px sans-serif;">⚠ 字体建议系统字体</text>\n'
    '    <text x="340" y="400" class="warn" style="font:500 11px sans-serif;">⚠ 日期格式统一</text>\n'
    '    <text x="340" y="420" class="ok" style="font:500 11px sans-serif;">✓ 无图片化文本</text>\n', '', "R8 ⑦ ATS card")

# R9 ⑦ desc
rep("选模板/主题/尺寸/包含项，选保存路径，一键出矢量 PDF（等字体加载完再 printToPDF）。<b>对话框内嵌「ATS 兼容性检查」卡片（F17）</b>：✓/⚠ 清单式提示，不阻塞导出，仅提示兼容性风险。",
    "选模板/主题/尺寸/包含项，选保存路径，一键出矢量 PDF（等字体加载完再 printToPDF），所有内置模板默认兼容 ATS。", "R9 ⑦ desc")

# R10 ⑫ ATS card removal (regex, no nested <div>)
m = re.search(r'<div class="card">\s*<h2>⑫ ATS 兼容提示（F17）.*?</div>', html, flags=re.S)
if m:
    html = html[:m.start()] + html[m.end():]
    report.append(("R10 ⑫ ATS card", 1))
    # collapse the triple blank line left behind into a single blank line
    html = html.replace("\n\n\n<div class=\"card\">", "\n\n<div class=\"card\">")
else:
    report.append(("R10 ⑫ ATS card", 0))

# R11 ⑬ ATS⚠ badge
rep('    <rect x="258" y="100" width="40" height="14" rx="4" fill="#3a2f12" stroke="#EF9F27" stroke-width="1"/>\n'
    '    <text x="264" y="111" style="fill:#EF9F27;font:500 9px sans-serif;">ATS⚠</text>\n', '', "R11 ⑬ ATS⚠ badge")

# R12 ⑬ desc
rep("投递格式由预设模板保证专业且 ATS 友好（F17）。",
    "投递格式由预设模板保证专业且 ATS 友好（默认所有模板兼容 ATS）。", "R12 ⑬ desc")

# R13 legend tags
rep('    <span class="tag">✓ / ⚠ / ✗ = ATS 检查项（F17）</span>\n'
    '    <span class="tag">ATS⚠ 角标 = 非 ATS 友好模板</span>\n', '', "R13 legend tags")

# R14 legend <p>
rep("2026-08-05 修订增补 F16 隐私打码 / F17 ATS 提示 / 开源免费定位 / ⑬ 模板编辑与主题定制（F4），对应界面已在 ① ④ ⑦ ⑨ ⑪ ⑫ ⑬ 重绘。",
    "2026-08-05 修订增补 F16 隐私打码 / 开源免费定位 / ⑬ 模板编辑与主题定制（F4），对应界面已在 ① ④ ⑦ ⑨ ⑪ ⑬ 重绘；移除 ⑫ ATS 屏。", "R14 legend <p>")

io.open(SRC, "w", encoding="utf-8").write(html)

print("=== wireframe edits ===")
for label, n in report:
    print(f"  {label}: {n} replacement(s)")
print("changed:", html != orig)
