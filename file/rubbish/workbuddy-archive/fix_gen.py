# -*- coding: utf-8 -*-
import io

P = r"E:/ai/aiwork/newproject/xiaomengresume/gen_nav_proto.py"
s = io.open(P, encoding="utf-8").read()
o = s
rep = []
def R(old, new, label):
    global s
    n = s.count(old)
    s = s.replace(old, new)
    rep.append((label, n))

# 1 docstring
R("提取 13 张界面线框图", "提取 12 张界面线框图", "docstring 13->12")
# 2 comment
R("parsed 索引: 0..12 = ①..⑬ ; 13 = 图例",
  "parsed 索引: 0..10 = ①..⑪ ; 11 = ⑬ ; 12 = 图例（⑫ ATS 屏已移除）", "comment index")
# 3 SCREEN_SVG
R("""    's-main': 9,
    's-privacy': 10, 's-ats': 11, 's-template-edit': 12,
}""",
"""    's-main': 9,
    's-privacy': 10, 's-template-edit': 11,
}""", "SCREEN_SVG")
# 4 ROLE
R("""    's-template': '模板画廊 + 主题色板(非 ATS 友好模板打角标)',""",
"""    's-template': '模板画廊 + 主题色板',""", "ROLE template")
R("""    's-export': '导出 PDF 对话框(内嵌 ATS 检查卡)',
    's-ats': 'ATS 兼容性检查清单(纯本地规则，不阻塞导出)',""",
"""    's-export': '导出 PDF 对话框',""", "ROLE export/ats")
# 5 LABEL
R("""    's-manage': '简历管理', 's-export': '导出 PDF', 's-ats': 'ATS 提示',""",
"""    's-manage': '简历管理', 's-export': '导出 PDF',""", "LABEL")
# 6 STATIONS
R("""            's-export', 's-ats', 's-privacy', 's-legend']""",
"""            's-export', 's-privacy', 's-legend']""", "STATIONS")
# 7 CHIPS
R("""    's-export': [('ATS 检查 ▸ ATS 提示', 's-ats'), ('导出（完成）', '__done__'),
                 ('← 返回主界面', 's-main')],
    's-ats': [('知道了 ▸ 导出', 's-export')],""",
"""    's-export': [('导出（完成）', '__done__'),
                 ('← 返回主界面', 's-main')],""", "CHIPS")

io.open(P, "w", encoding="utf-8").write(s)
print("=== gen_nav_proto.py edits ===")
for l, n in rep:
    print(f"  {l}: {n}")
print("changed:", s != o)
