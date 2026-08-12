# -*- coding: utf-8 -*-
"""
gen_s1_samples.py —— S1 自造王晨变体生成（2026-08-12 导入测试集批 3，reportlab 版）
同一份王晨数据（sample-resume.json 单一事实源）→ 4 种版式 PDF：
  single（单栏，B 档最易）/ two-column（双栏，unpdf 抽取易乱序）/ multipage（多页，分页）/ table（表格，字段在表格中）
目的：同一 ground truth 下测不同排版的 B 档识别差异（评测公平：内容一致、仅布局不同）。
依赖：python + reportlab（本机 4.4.10）。中文用系统字体（Windows 微软雅黑 msyh.ttc）。
用法：python scripts/gen_s1_samples.py（产物进 ../material/import-cases/s1/）
"""
import json
import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib import colors

HERE = pathlib.Path(__file__).resolve().parent
S1_DIR = HERE.parent / "material" / "import-cases" / "s1"
S1_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE = json.loads((HERE.parent / "project" / "src" / "shared" / "sample-resume.json").read_text(encoding="utf-8"))

# ── 中文字体注册（微软雅黑 ttc；取第一 font，避免 TTFont 不支持 ttc 的坑）──
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\simsun.ttc",
    r"C:\Windows\Fonts\Deng.ttf",
]
FONT = "Helvetica"
for fp in FONT_CANDIDATES:
    p = pathlib.Path(fp)
    if p.exists():
        try:
            pdfmetrics.registerFont(TTFont("CJK", str(p)))
            FONT = "CJK"
            break
        except Exception:
            continue
print("font:", FONT)

# ── 从 sample JSON 提取纯文本字段（与 B 档导入识别的输入一致）──
def plain(node):
    if not node:
        return ""
    if isinstance(node, str):
        return node
    if isinstance(node, list):
        return "".join(plain(x) for x in node if x)
    if node.get("type") in ("paragraph", "listItem", "bulletList", "doc"):
        sep = "\n" if node.get("type") == "bulletList" else ""
        return sep.join(plain(x) for x in (node.get("content") or []) if x)
    if node.get("type") == "text":
        return node.get("text") or ""
    return "".join(plain(x) for x in (node.get("content") or []) if x)


B = SAMPLE["basics"]
D = {
    "name": B["name"],
    "headline": B.get("headline", ""),
    "phone": B.get("phone", ""),
    "email": B.get("email", ""),
    "address": B.get("address", ""),
    "location": B.get("location", ""),
    "birthDate": B.get("birthDate", ""),
    "employmentStatus": B.get("employmentStatus", ""),
    "summary": plain(SAMPLE.get("summary", {}).get("content")),
    "education": [
        {"school": e.get("school"), "degree": e.get("degree"), "major": e.get("major"),
         "startDate": e.get("startDate"), "endDate": e.get("endDate"),
         "location": e.get("location"), "gpa": e.get("gpa"), "desc": plain(e.get("description"))}
        for e in SAMPLE.get("education", [])
    ],
    "work": [
        {"company": w.get("company"), "title": w.get("title"), "location": w.get("location"),
         "startDate": w.get("startDate"), "endDate": w.get("endDate"), "current": w.get("current", False),
         "summary": plain(w.get("summary"))}
        for w in SAMPLE.get("work", [])
    ],
    "projects": [
        {"name": p.get("name"), "role": p.get("role"),
         "startDate": p.get("startDate"), "endDate": p.get("endDate"), "desc": plain(p.get("description"))}
        for p in SAMPLE.get("projects", [])
    ],
    "skills": [
        {"name": s.get("name"), "category": s.get("category"), "level": s.get("level")}
        for s in SAMPLE.get("skills", [])
    ],
}

H1 = ParagraphStyle("h1", fontName=FONT, fontSize=18, leading=22, spaceAfter=2)
H2 = ParagraphStyle("h2", fontName=FONT, fontSize=13, leading=16, spaceBefore=10, spaceAfter=3)
MUTED = ParagraphStyle("muted", fontName=FONT, fontSize=9, leading=12, textColor=colors.HexColor("#555555"))
BODY = ParagraphStyle("body", fontName=FONT, fontSize=10, leading=14)
CELL = ParagraphStyle("cell", fontName=FONT, fontSize=9, leading=12)
CELLB = ParagraphStyle("cellb", fontName=FONT, fontSize=9, leading=12, fontName2=FONT)
BULLET = ParagraphStyle("bullet", fontName=FONT, fontSize=9.5, leading=13, leftIndent=12, bulletIndent=2)


def bullets(text):
    out = []
    for ln in (text or "").split("\n"):
        ln = ln.strip()
        if ln:
            out.append(Paragraph(ln, BULLET, bulletText="•"))
    return out


def header():
    return [
        Paragraph(D["name"], H1),
        Paragraph(f"{D['headline']} · {D['employmentStatus']} · {D['birthDate']}", MUTED),
        Paragraph(f"电话：{D['phone']} ｜ 邮箱：{D['email']} ｜ {D['location']}", MUTED),
        Paragraph(f"地址：{D['address']}", MUTED),
    ]


def sections_all():
    flow = [Paragraph("自我评价", H2), Paragraph(D["summary"], BODY)]
    flow.append(Paragraph("教育经历", H2))
    for e in D["education"]:
        flow.append(Paragraph(f"<b>{e['school']}</b> {e['degree']} {e['major']}（{e['startDate']} - {e['endDate']}，{e['location']}，GPA {e['gpa']}）", BODY))
        flow.extend(bullets(e["desc"]))
    flow.append(Paragraph("工作经历", H2))
    for w in D["work"]:
        end = "至今" if w["current"] else w["endDate"]
        flow.append(Paragraph(f"<b>{w['company']}</b> {w['title']}（{w['startDate']} - {end}，{w['location']}）", BODY))
        flow.extend(bullets(w["summary"]))
    flow.append(Paragraph("项目经历", H2))
    for p in D["projects"]:
        flow.append(Paragraph(f"<b>{p['name']}</b> {p['role']}（{p['startDate']} - {p['endDate']}）", BODY))
        flow.extend(bullets(p["desc"]))
    flow.append(Paragraph("专业技能", H2))
    for s in D["skills"]:
        flow.append(Paragraph(f"{s['category']}：{s['name']}（{s['level']}）", BODY, bulletText="•"))
    return flow


def build(path, flow, margin=18 * mm):
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=margin, rightMargin=margin, topMargin=margin, bottomMargin=margin)
    doc.build(flow)


# 1) 单栏
build(S1_DIR / "王晨_single.pdf", header() + sections_all())

# 2) 双栏（表格两列模拟左右分栏，unpdf 抽取顺序不稳定）
col_left = sections_all()[: 0]  # 头部在前
two_flow = header()
left = [Paragraph("自我评价", H2), Paragraph(D["summary"], BODY),
        Paragraph("教育经历", H2)]
for e in D["education"]:
    left.append(Paragraph(f"<b>{e['school']}</b> {e['degree']} {e['major']}（{e['startDate']}-{e['endDate']}）", BODY))
    left.extend(bullets(e["desc"]))
left.append(Paragraph("工作经历", H2))
for w in D["work"]:
    end = "至今" if w["current"] else w["endDate"]
    left.append(Paragraph(f"<b>{w['company']}</b> {w['title']}（{w['startDate']}-{end}）", BODY))
    left.extend(bullets(w["summary"]))
right = [Paragraph("联系方式", H2),
         Paragraph(f"电话：{D['phone']}<br/>邮箱：{D['email']}<br/>{D['location']}<br/>地址：{D['address']}", BODY),
         Paragraph("项目经历", H2)]
for p in D["projects"]:
    right.append(Paragraph(f"<b>{p['name']}</b> {p['role']}（{p['startDate']}-{p['endDate']}）", BODY))
    right.extend(bullets(p["desc"]))
right.append(Paragraph("专业技能", H2))
for s in D["skills"]:
    right.append(Paragraph(f"{s['category']}：{s['name']}（{s['level']}）", BODY))
two_flow.append(Table([[left, right]], colWidths=[85 * mm, 85 * mm]))
build(S1_DIR / "王晨_two-column.pdf", two_flow)

# 3) 多页（第二页强分页，测试分页文本归属）
mp = header() + sections_all()[: 8] + [PageBreak()] + [
    Paragraph("项目经历", H2),
] + [Paragraph(f"<b>{p['name']}</b> {p['role']}（{p['startDate']}-{p['endDate']}）", BODY) for p in D["projects"]] + \
    [Paragraph("专业技能", H2)] + \
    [Paragraph(f"{s['category']}：{s['name']}（{s['level']}）", BODY) for s in D["skills"]] + [
    Paragraph("补充说明", H2),
    Paragraph(f"本页为第二页，测试多页简历的文本抽取与字段归属。{D['name']} 拥有 {len(D['work'])} 段工作经历、{len(D['education'])} 段教育经历。", BODY),
]
build(S1_DIR / "王晨_multipage.pdf", mp)

# 4) 表格（字段在表格单元格中，测表格文本流）
table_flow = [
    Paragraph(D["name"], H1),
    Paragraph(f"{D['headline']}", MUTED),
    Table(
        [[Paragraph("电话", CELLB), Paragraph(D["phone"], CELL), Paragraph("邮箱", CELLB), Paragraph(D["email"], CELL)],
         [Paragraph("地址", CELLB), Paragraph(f"{D['address']}（{D['location']}）", CELL), Paragraph("", CELL), Paragraph("", CELL)],
         [Paragraph("出生年月", CELLB), Paragraph(D["birthDate"], CELL), Paragraph("在职状态", CELLB), Paragraph(D["employmentStatus"], CELL)]],
        colWidths=[25 * mm, 55 * mm, 25 * mm, 55 * mm],
    ),
    Paragraph("自我评价", H2), Paragraph(D["summary"], BODY),
    Paragraph("教育经历", H2),
    Table([[Paragraph("学校", CELLB), Paragraph("学历", CELLB), Paragraph("专业", CELLB), Paragraph("时间", CELLB), Paragraph("GPA", CELLB)]] +
          [[Paragraph(e["school"], CELL), Paragraph(e["degree"], CELL), Paragraph(e["major"], CELL),
            Paragraph(f"{e['startDate']} - {e['endDate']}", CELL), Paragraph(e["gpa"] or "", CELL)] for e in D["education"]],
          colWidths=[45 * mm, 20 * mm, 30 * mm, 35 * mm, 20 * mm]),
    Paragraph("工作经历", H2),
    Table([[Paragraph("公司", CELLB), Paragraph("职位", CELLB), Paragraph("时间", CELLB), Paragraph("职责", CELLB)]] +
          [[Paragraph(w["company"], CELL), Paragraph(w["title"], CELL),
            Paragraph(f"{w['startDate']} - {'至今' if w['current'] else w['endDate']}", CELL),
            Paragraph("<br/>".join((w["summary"] or "").split("\n")), CELL)] for w in D["work"]],
          colWidths=[40 * mm, 25 * mm, 30 * mm, 45 * mm]),
    Paragraph("专业技能", H2),
    Table([[Paragraph("类别", CELLB), Paragraph("技能", CELLB), Paragraph("水平", CELLB)]] +
          [[Paragraph(s["category"], CELL), Paragraph(s["name"], CELL), Paragraph(s["level"], CELL)] for s in D["skills"]],
          colWidths=[35 * mm, 65 * mm, 20 * mm]),
]
build(S1_DIR / "王晨_table.pdf", table_flow)

print("S1 完成：", sorted(p.name for p in S1_DIR.glob("王晨_*.pdf")))
