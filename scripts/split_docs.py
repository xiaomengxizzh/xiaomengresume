#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
split_docs.py —— 巨型主文档路由化拆分（2026-08-08 定案，见《项目规范.md》§1.2 演进）

拆分规则（用户拍板 2026-08-08）：
  - 《项目功能.md》：功能详情按 F 编号拆到 file/detail/functions/Fxx_*.md；
    三/四/五章整体拆为子文档；主文档保留 定位+索引路由表+一、功能总览（铁律常量级）。
  - 《项目日志.md》：开发记录按月份归档到 file/detail/logs/YYYY-MM.md；
    主文档保留 定位+月度索引+项目定位+基础文档+后续记录规范+历史附录。

用法：python scripts/split_docs.py
产物：file/detail/ 下子文档 + 两个主文档重建（路由骨架，摘要人工精修）。
"""
import re
import os
import shutil
from pathlib import Path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILE_DIR = os.path.join(ROOT, 'file')
DETAIL = os.path.join(FILE_DIR, 'detail')
FUNCS = os.path.join(DETAIL, 'functions')
LOGS = os.path.join(DETAIL, 'logs')

FUNC_SRC = os.path.join(FILE_DIR, '项目功能.md')
LOG_SRC = os.path.join(FILE_DIR, '项目日志.md')

os.makedirs(FUNCS, exist_ok=True)
os.makedirs(LOGS, exist_ok=True)


def read_lines(path):
    with open(path, encoding='utf-8') as f:
        return f.read().split('\n')


def write(path, text):
    ap = Path(path).resolve()
    # 路径穿越防御（Mimosa CWE-22）：写入目标必须解析在 file/ 目录内
    file_dir = Path(FILE_DIR).resolve()
    if not ap.is_relative_to(file_dir):
        raise ValueError(f'拒绝写入 file/ 目录之外: {ap}')
    ap.write_text(text, encoding='utf-8', newline='\n')
    print(f'  [写] {os.path.relpath(ap, ROOT)} ({len(text)} 字符)')


def slugify(title):
    """F 小节标题 → 文件名 slug（去编号/后缀/特殊字符）"""
    s = re.sub(r'[（(].*?[)）]', '', title)          # 去括号注
    s = re.sub(r'[—–-].*$', '', s).strip()           # 去 — 后缀
    s = re.sub(r'[^\w\u4e00-\u9fff]+', '_', s).strip('_')
    return s


def first_paras(lines, n=2):
    """提取块内前 n 个非空非标题段（摘要用）"""
    out = []
    for ln in lines:
        t = ln.strip()
        if not t or t.startswith('#'):
            continue
        out.append(t)
        if len(out) >= n:
            break
    return ' / '.join(out)[:120]


# ── 1. 《项目功能.md》 ──────────────────────────────────────────────────────

def split_functions():
    lines = read_lines(FUNC_SRC)
    # 定位标题区（到第一个 ## 前）
    head = []
    idx = 0
    for i, ln in enumerate(lines):
        if ln.startswith('## '):
            idx = i
            break
        head.append(ln)
    # 顶层章节边界
    secs = []  # (line_no, level, title)
    for i, ln in enumerate(lines):
        m = re.match(r'^(#{2,3}) (.+)$', ln)
        if m:
            secs.append((i, len(m.group(1)), m.group(2)))
    secs.append((len(lines), 0, ''))
    # 收集「功能详情」内 F 小节
    func_detail = [s for s in secs if '功能详情' in s[2]]
    f_blocks = []  # (start, end, title)
    if func_detail:
        d_start = func_detail[0][0]
        d_end = next((s[0] for s in secs if s[0] > d_start and s[1] == 2), len(lines))
        sub = [s for s in secs if d_start < s[0] < d_end and s[1] == 3]
        for j, s in enumerate(sub):
            nxt = sub[j + 1][0] if j + 1 < len(sub) else d_end
            f_blocks.append((s[0], nxt, s[2]))

    # 拆分 F 小节
    route = []  # (编号, 标题, 摘要, 相对路径)
    for start, end, title in f_blocks:
        body = '\n'.join(lines[start:end]).strip() + '\n'
        m = re.match(r'^F(\d+) · (.+)$', title)
        if m:
            num = int(m.group(1))
            name = slugify(m.group(2))
            fname = f'F{num:02d}_{name}.md'
            rel = f'file/detail/functions/{fname}'
        else:
            fname = slugify(title) + '.md'
            rel = f'file/detail/functions/{fname}'
        doc = f'# {title}\n\n> 本文件由 `scripts/split_docs.py` 从《项目功能.md》拆分（2026-08-08 路由化定案）；真相源 = 本文档。\n\n{body}'
        write(os.path.join(FUNCS, fname), doc)
        route.append((title, first_paras(lines[start:end]), rel))

    # 拆分顶层章节（三/四/五，跳过一、功能总览与二、功能详情容器）
    for k, (start, level, title) in enumerate(secs):
        if level != 2 or title.startswith('索引') or '功能总览' in title or '功能详情' in title:
            continue
        end = secs[k + 1][0] if k + 1 < len(secs) else len(lines)
        body = '\n'.join(lines[start:end]).strip() + '\n'
        fname = slugify(title) + '.md'
        rel = f'file/detail/functions/{fname}'
        doc = f'# {title}\n\n> 本文件由 `scripts/split_docs.py` 从《项目功能.md》拆分（2026-08-08 路由化定案）。\n\n{body}'
        write(os.path.join(FUNCS, fname), doc)
        route.append((title, first_paras(lines[start:end]), rel))

    # 重建主文档
    route_rows = '\n'.join(
        f'| {t} | {s} | `{r}` |' for t, s, r in route
    )
    main = (
        '# xiaomengresume 项目功能\n\n'
        '> **定位**：做什么——F1–F16 + F18–F21 每个功能的需求、实现框架、用户视角。'
        '技术实现见《技术栈.md》，实现进度见《项目实现情况.md》，界面原型见《导航交互原型.html》。\n'
        '> **定稿日期**：2026-08-05（合并《用户操作视角功能描述.md》）；**2026-08-08 路由化拆分**：功能详情等细节下沉 `file/detail/functions/`，本文保留路由表 + 功能总览（唯一权威）。\n\n'
        '## 索引（路由表）\n\n'
        '| 章节 | 摘要 | 落点 |\n|---|---|---|\n'
        '| 一、功能总览 | F1–F16 + F18–F21 表（功能域 / 里程碑 / 技术栈）——**唯一权威，必读** | 本文 |\n'
        f'{route_rows}\n\n'
        '---\n\n'
    )
    # 追加一、功能总览（L18 到功能详情前）
    ov_start = next(s[0] for s in secs if '功能总览' in s[2])
    ov_end = func_detail[0][0]
    main += '\n'.join(lines[ov_start:ov_end]).strip() + '\n'
    write(FUNC_SRC, main)


# ── 2. 《项目日志.md》 ──────────────────────────────────────────────────────

def split_logs():
    lines = read_lines(LOG_SRC)
    # 元信息区行号
    def find(sub):
        for i, ln in enumerate(lines):
            if ln.startswith('## ') and sub in ln:
                return i
        return None

    i_loc = find('项目定位')          # L9
    i_base = find('基础文档')         # L22
    i_dev = find('开发记录')          # L37
    i_pend = find('当前未决决策')     # L254
    i_rule = find('后续记录规范')     # L265
    assert all(x is not None for x in (i_loc, i_base, i_dev, i_pend, i_rule)), '元信息区段缺失'

    # 注意：L265「后续记录规范」之后仍是开发条目（L271-809），故开发记录 = 两段拼接
    rule_end = next((i for i in range(i_rule, len(lines)) if lines[i].startswith('### 20')), len(lines))
    dev_lines = lines[i_dev:i_pend] + lines[rule_end:]

    # 开发记录 → file/detail/logs/2026-08.md
    fixed = []
    for ln in dev_lines:
        # ## 2026-08-08 大条目在子文件内降级为 ###（与 ## 开发记录 保持层级）
        if re.match(r'^## 2026-08-\d{2} ', ln):
            ln = '#' + ln
        fixed.append(ln)
    dev_doc = (
        '# 2026-08 开发记录（自动拆分）\n\n'
        '> 本文件由 `scripts/split_docs.py` 从《项目日志.md》按月拆分（2026-08-08 路由化定案）。\n'
        '> 月度条目继续追加到本文件；《项目日志.md》月度索引同步更新。\n\n'
        + '\n'.join(fixed).strip() + '\n'
    )
    write(os.path.join(LOGS, '2026-08.md'), dev_doc)

    # 历史附录（当前未决决策）+ 后续记录规范
    pend = '\n'.join(lines[i_pend:i_rule]).strip()
    rule = '\n'.join(lines[i_rule:rule_end]).strip()

    # 重建主文档
    main = (
        '# xiaomengresume 项目日志\n\n'
        '> **定位**：改了什么——全部开发记录的唯一归口（§1.4）。\n'
        '> **2026-08-08 路由化拆分**：开发记录按月归档 `file/detail/logs/YYYY-MM.md`，本文只留月度索引 + 元信息。\n\n'
        '## 索引\n\n'
        '| 章节 | 内容 |\n|---|---|\n'
        '| 月度索引 | 开发记录按月归档入口（先看此表再翻子文件） |\n'
        '| 项目定位 | 项目是什么 / 信任承诺 |\n'
        '| 基础文档 | 6 主文档地图 |\n'
        '| 后续记录规范 | 日志书写规则 |\n'
        '| 历史附录 | 拆分前遗留的「当前未决决策」历史条目（总入口见《项目实现情况.md》§2.2） |\n\n'
        '## 月度索引\n\n'
        '| 月份 | 子文件 | 主题摘要 |\n|---|---|---|\n'
        '| 2026-08 | `file/detail/logs/2026-08.md` | M0 骨架 → 文档体系重组 → 配色定案 → M1 编辑器落码 → P0 三连修复 → UI smoke 闭环 |\n\n'
        '---\n\n'
        + '\n'.join(lines[i_loc:i_base]).strip() + '\n\n'
        '---\n\n'
        + '\n'.join(lines[i_base:i_dev]).strip() + '\n\n'
        '---\n\n'
        + rule + '\n\n'
        '---\n\n'
        '## 历史附录 · 当前未决决策（拆分前遗留）\n\n'
        + pend + '\n'
    )
    write(LOG_SRC, main)


if __name__ == '__main__':
    print('=== 拆分《项目功能.md》 ===')
    split_functions()
    print('=== 拆分《项目日志.md》 ===')
    split_logs()
    print('=== 完成 ===')
