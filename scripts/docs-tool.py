#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docs-tool · 项目文档运维工具层（零依赖，仅 Python 标准库）。

按《技术栈.md》八 规格实现（2026-08-06 V 阶段定案，本日落地）。

**写权限红线**：只写 `.workbuddy/` 与 `file/draft/`；禁碰 `file/` 正式文档
（与《项目规范.md》G.6 hooks 写权限红线同源——防击穿「单写者铁律」）。

子命令：
  snapshot  生成 file/ 下 *.md 哈希基线 → .workbuddy/docs-hashes.json（只读 file/）
  diff      对比基线列出改动（新增/修改/删除）；无差异输出「0 文件改动」
  matrix    扫 draft/ 草稿「合并归属」→ 需求覆盖矩阵，标「有需求无落点」
  check     体检：引用断裂 + 索引完整性 + 遗留旧词提示（C1/C4/C6）
  state     生成 G.6 状态文件四要素（changedFiles/passedChecks/blockers 自动，
            goal 待 AI 补填；--goal-from-briefs 可从 draft/ 简报自动拼 goal）
            → .workbuddy/memory/MEMORY.md「当前会话状态」小节
  selfcheck G.7 结构化自检半自动化（CH1–CH7，证据输出，警告非硬失败；CH7 实现情况覆盖检查对比 git 最近 commit 改动与《项目实现情况》登记）
  where     查某编号/关键词在 file/ 各文档的引用位置（C5 人工核对加速器）
  brief     生成工作包简报骨架 → file/draft/（只写 draft/）
  clean     删除 file/draft/ 草稿（默认仅列出，--yes 才删；不碰 rubbish/）

用法示例：
  python scripts/docs-tool.py snapshot
  python scripts/docs-tool.py diff
  python scripts/docs-tool.py check
  python scripts/docs-tool.py state --goal-from-briefs
  python scripts/docs-tool.py selfcheck
  python scripts/docs-tool.py where F19
  python scripts/docs-tool.py brief --stage T --id 1 --topic 示例主题
  python scripts/docs-tool.py clean --yes
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, date
from pathlib import Path

# ── 路径约定（脚本位于 <root>/scripts/，root = 上一级）────────────────────
ROOT = Path(__file__).resolve().parent.parent
FILE_DIR = ROOT / "file"
DRAFT_DIR = FILE_DIR / "draft"
RUBBISH_DIR = FILE_DIR / "rubbish"
WB_DIR = ROOT / ".workbuddy"
HASHES_FILE = WB_DIR / "docs-hashes.json"
MEMORY_FILE = WB_DIR / "memory" / "MEMORY.md"

# 引用《xxx.md/.html》与 `file/...` / `.workbuddy/...` 路径
MD_REF_RE = re.compile(r"《([^《》]+?\.(?:md|html))》")
PATH_REF_RE = re.compile(r"`?((?:file|\.workbuddy)/[\w./\-\u4e00-\u9fff]+?\.(?:md|html))`?")

# 必须建索引的 4 份主文档（《项目规范.md》一 1.2）
INDEX_REQUIRED = {"项目介绍.md", "项目规范.md", "技术栈.md", "项目功能.md"}
# 退役资产（2026-08-07 用户拍板删除）：历史引用命中算 ℹ 退役引用，不算断裂
RETIRED_REFS = {"原型线框图.html", "导航交互原型.html", "gen_nav_proto.py"}
# 遗留旧词提示（守 C6 术语统一；(name, regex) 对；「同步目录」用负向断言排除「非同步目录」误报）
TERM_PATTERNS = [
    ("settings.sync", re.escape("settings.sync")),
    ("sync:", re.escape("sync:")),
    ("同步文件夹", "同步文件夹"),
    ("同步目录", r"(?<!非)同步目录"),
]
# 术语上下文豁免：更名溯源说明（原名/更名/废弃/误导…）不算残留
TERM_CONTEXT_EXEMPT = ("更名", "旧词", "原名", "废弃", "误导", "澄清", "改为", "→", "旧称", "废弃名")


def _rel(p: Path) -> str:
    """项目根相对路径（正斜杠），用于输出与基线记录。"""
    return p.resolve().relative_to(ROOT.resolve()).as_posix()


def _hash(p: Path) -> str:
    """SHA-256 文件哈希（分块读，兼容大文件）。"""
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _scan(base: Path) -> dict[str, dict[str, str]]:
    """递归扫描 base 下所有 *.md，返回 {相对路径: {hash, mtime}}。只读。"""
    out: dict[str, dict[str, str]] = {}
    for p in sorted(p for p in base.rglob("*.md") if p.is_file()):
        st = p.stat()
        out[_rel(p)] = {
            "hash": _hash(p),
            "mtime": datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds"),
        }
    return out


def _ensure_wb() -> None:
    WB_DIR.mkdir(parents=True, exist_ok=True)


# ── snapshot ─────────────────────────────────────────────────────────────
def cmd_snapshot(args: argparse.Namespace) -> int:
    """生成 file/ 下 *.md 哈希基线 → .workbuddy/docs-hashes.json（只读 file/）。"""
    _ensure_wb()
    data = _scan(FILE_DIR)
    HASHES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"snapshot: 已生成基线 {_rel(HASHES_FILE)}（{len(data)} 个 .md）")
    return 0


# ── diff ─────────────────────────────────────────────────────────────────
def cmd_diff(args: argparse.Namespace) -> int:
    """对比基线列出改动（M 修改 / A 新增 / D 删除）；无差异输出「0 文件改动」。"""
    if not HASHES_FILE.exists():
        print("diff: 基线不存在，先执行 snapshot", file=sys.stderr)
        return 1
    base = json.loads(HASHES_FILE.read_text(encoding="utf-8"))
    cur = _scan(FILE_DIR)
    modified = sorted(k for k, v in cur.items() if k in base and v["hash"] != base[k]["hash"])
    added = sorted(set(cur) - set(base))
    deleted = sorted(set(base) - set(cur))
    if not (modified or added or deleted):
        print("0 文件改动")
        return 0
    print(f"diff: {len(modified) + len(added) + len(deleted)} 个文件改动")
    for k in modified:
        print(f"  M  {k}")
    for k in added:
        print(f"  A  {k}")
    for k in deleted:
        print(f"  D  {k}")
    return 0


# ── matrix ───────────────────────────────────────────────────────────────
def cmd_matrix(args: argparse.Namespace) -> int:
    """扫 draft/ 草稿「合并归属」→ 需求覆盖矩阵，标「有需求无落点」。"""
    briefs = sorted(DRAFT_DIR.glob("*.md")) if DRAFT_DIR.is_dir() else []
    if not briefs:
        print("matrix: draft/ 为空（合并期外正常），无草稿可扫描")
        return 0
    print("matrix: 需求覆盖矩阵（草稿 → 合并归属落点）")
    issues = 0
    for b in briefs:
        text = b.read_text(encoding="utf-8")
        title = text.splitlines()[0].strip("# ").strip() if text else b.name
        # 摘录「合并归属」段（含 合并归属/合并后归属）
        m = re.search(r"合并(?:后)?归属[^\n]*\n(.*?)(?=\n#|\Z)", text, re.S)
        targets = set()
        if m:
            targets |= set(MD_REF_RE.findall(m.group(1)))
        if not targets:  # 段落内无《…》则回退全文档扫描
            targets = set(MD_REF_RE.findall(text))
        for t in sorted(targets):
            ok = (FILE_DIR / t).exists()
            status = "✅ 已落点" if ok else "❌ 有需求无落点"
            if not ok:
                issues += 1
            print(f"  {b.name}｜{title} → 《{t}》 [{status}]")
    print(f"matrix: 共 {len(briefs)} 份草稿，无落点 {issues} 处")
    return 0


# ── check ────────────────────────────────────────────────────────────────
def _locate(ref: str) -> tuple[str, str]:
    """定位引用：返回 (kind, 说明)。kind ∈ ok / archived / retired / missing。

    - ok：file/ 下或项目根/`.workbuddy/` 存在；
    - archived：目标已归档于 rubbish/（历史溯源引用，非断裂）；
    - retired：目标为退役资产（线框图/导航图/生成脚本，2026-08-07 删除，非断裂）；
    - missing：任何位置都不存在（真断裂）。
    """
    if ref in RETIRED_REFS:
        return "retired", "退役资产（2026-08-07 删除，历史引用保留）"
    if ref.startswith("file/") or ref.startswith(".workbuddy/"):
        return ("ok", "") if (ROOT / ref).exists() else ("missing", "")
    if (FILE_DIR / ref).exists():
        return "ok", ""
    if (RUBBISH_DIR / ref).exists():
        return "archived", "目标已归档于 rubbish/（历史溯源引用）"
    return "missing", ""


def cmd_check(args: argparse.Namespace) -> int:
    """体检：引用断裂（C1）+ 索引完整性（C4）+ 遗留旧词提示（C6）。"""
    # 2026-08-08 路由化：递归扫描 file/（含 detail/ 正式子文档层；自动生成/归档子目录照常校验引用）
    docs = [p for p in sorted(FILE_DIR.rglob("*.md")) if p.name != "项目日志.md"]
    broken: list[str] = []
    archived: list[str] = []
    retired: list[str] = []

    for p in docs:
        text = p.read_text(encoding="utf-8")
        for ref in MD_REF_RE.findall(text):
            kind, note = _locate(ref)
            if kind == "missing":
                broken.append(f"{p.name}: 引用《{ref}》不存在")
            elif kind == "archived":
                archived.append(f"{p.name}: 引用《{ref}》{note}")
            elif kind == "retired":
                retired.append(f"{p.name}: 引用《{ref}》{note}")
        for m in PATH_REF_RE.finditer(text):
            kind, note = _locate(m.group(1))
            if kind == "missing":
                broken.append(f"{p.name}: 引用 `{m.group(1)}` 不存在")
            elif kind == "archived":
                archived.append(f"{p.name}: 引用 `{m.group(1)}`{note}")
            elif kind == "retired":
                retired.append(f"{p.name}: 引用 `{m.group(1)}`{note}")

    no_index = [
        p.name
        for p in docs
        if p.name in INDEX_REQUIRED and "## 索引" not in p.read_text(encoding="utf-8")
    ]

    hints: list[str] = []
    for p in docs:
        for line in p.read_text(encoding="utf-8").splitlines():
            hit = next((name for name, pat in TERM_PATTERNS if re.search(pat, line)), None)
            if hit is None:
                continue
            if any(w in line for w in TERM_CONTEXT_EXEMPT):
                continue  # 更名溯源说明，不算残留
            hints.append(f"{p.name}: 残留旧词「{hit}」")

    print("check: 体检报告")
    print(f"  引用检查（C1）：{'✅ 通过' if not broken else f'❌ 断裂 {len(broken)} 处'}"
          + (f"；归档溯源引用 {len(archived)} 处" if archived else "")
          + (f"；退役引用 {len(retired)} 处" if retired else ""))
    for b in broken:
        print(f"    ❌ {b}")
    for a in archived:
        print(f"    ℹ {a}")
    for r in retired:
        print(f"    ♻ {r}")
    print(f"  索引检查（C4）：{'✅ 通过' if not no_index else '❌ 缺索引: ' + '、'.join(no_index)}")
    for n in no_index:
        print(f"    ❌ {n}")
    print(f"  术语检查（C6 提示）：{'无' if not hints else f'{len(hints)} 条，需人工确认'}")
    for h in hints:
        print(f"    ⚠ {h}")
    return 1 if (broken or no_index) else 0


# ── state ────────────────────────────────────────────────────────────────
def cmd_state(args: argparse.Namespace) -> int:
    """生成 G.6 状态文件四要素 → .workbuddy/memory/MEMORY.md「当前会话状态」小节。

    changedFiles 复用 diff；passedChecks 读 draft/ 自检 + rubbish/ 复核报告；
    blockers 自动提取《项目实现情况.md》待拍板（❓）；
    goal 待 AI 补填，--goal-from-briefs 时从 draft/ 简报自动拼接（draft/ 空则回退待填）。
    """
    base = json.loads(HASHES_FILE.read_text(encoding="utf-8")) if HASHES_FILE.exists() else {}
    cur = _scan(FILE_DIR)
    changed = sorted(k for k, v in cur.items() if k not in base or v["hash"] != base.get(k, {}).get("hash"))

    goal = "_待 AI 补填_"
    if args.goal_from_briefs and DRAFT_DIR.is_dir():
        briefs = sorted(DRAFT_DIR.glob("*.md"))
        if briefs:
            prefix = re.match(r"([A-Z]+)_(\d+)_", briefs[0].name)
            if prefix:
                stage_name, ids = prefix.group(1), []
                for b in briefs:
                    m = re.match(r"([A-Z]+)_(\d+)_", b.name)
                    if m and m.group(1) == stage_name:
                        ids.append(int(m.group(2)))
                if ids:
                    ids = sorted(ids)
                    goal = f"{stage_name} 批 {len(ids)} 个工作包并行（{', '.join(f'WP-{stage_name}{i}' for i in ids)}）"
                else:
                    goal = f"draft/ 存在 {len(briefs)} 份草稿待合并"
            else:
                goal = f"draft/ 存在 {len(briefs)} 份草稿待合并"
        else:
            goal = "_待 AI 补填_（draft/ 为空）"

    passed: list[str] = []
    if DRAFT_DIR.is_dir():
        for p in sorted(DRAFT_DIR.glob("*.md")):
            t = p.read_text(encoding="utf-8")
            done = len(re.findall(r"^\- \[x\]", t, re.M))
            total = done + len(re.findall(r"^\- \[ \]", t, re.M))
            if total:
                passed.append(f"{p.name}: 自检 {done}/{total}")
    if RUBBISH_DIR.is_dir():
        for p in sorted(RUBBISH_DIR.glob("监督复核报告*.md")):
            m = re.search(r"结论[^\n:：]{0,8}[:：]\s*([^\n|]+)", p.read_text(encoding="utf-8"))
            verdict = m.group(1).strip().strip("**").strip() if m else "未知"
            passed.append(f"{p.name}: 复核结论={verdict}")

    blockers: list[str] = []
    fp = FILE_DIR / "项目实现情况.md"
    if fp.exists():
        for line in fp.read_text(encoding="utf-8").splitlines():
            if "❓" in line:
                m = re.match(r"\|\s*(\d+)\s*\|", line)
                if m:
                    blockers.append(f"待拍板 #{m.group(1)}（见《项目实现情况.md》§2.2）")
    if not blockers:
        blockers.append("无待拍板（§2.2 全 ✅）")

    lines = [
        "## 当前会话状态（G.6 状态文件 · docs-tool state 自动生成）",
        f"- goal：{goal}",
        "- changedFiles：",
    ]
    lines += [f"  - {k}" for k in changed] or ["  - （无改动）"]
    lines += ["- passedChecks："]
    lines += [f"  - {s}" for s in passed] or ["  - —"]
    lines += ["- blockers："]
    lines += [f"  - {s}" for s in blockers]

    block = "\n".join(lines) + "\n"
    _ensure_wb()
    (WB_DIR / "memory").mkdir(parents=True, exist_ok=True)
    text = MEMORY_FILE.read_text(encoding="utf-8") if MEMORY_FILE.exists() else ""
    marker = "## 当前会话状态"
    if marker in text:  # 幂等：同小节覆盖，不追加重复
        text = text.split(marker)[0].rstrip() + "\n\n" + block
    else:
        text = text.rstrip() + "\n\n" + block
    MEMORY_FILE.write_text(text, encoding="utf-8")

    print(f"state: 已写入 {_rel(MEMORY_FILE)}「当前会话状态」小节")
    print(f"  goal        = {goal}")
    print(f"  changedFiles= {len(changed)} 项" + (f"（最近：{changed[-1]}）" if changed else "（无改动）"))
    print(f"  passedChecks= {len(passed)} 项")
    for s in passed:
        print(f"    - {s}")
    print(f"  blockers    = {len(blockers)} 项")
    for s in blockers:
        print(f"    - {s}")
    return 0


# ── clean ────────────────────────────────────────────────────────────────
def cmd_clean(args: argparse.Namespace) -> int:
    """删除 file/draft/ 草稿（默认仅列出，--yes 才删；不碰 rubbish/ 与正式文档）。"""
    files = sorted(DRAFT_DIR.glob("*")) if DRAFT_DIR.is_dir() else []
    if not files:
        print("clean: 0 个草稿待删")
        return 0
    print(f"clean: 待删 {len(files)} 个草稿：")
    for f in files:
        print(f"  - {_rel(f)}")
    if not args.yes:
        print("clean: 未指定 --yes，仅列出不删除")
        return 1
    for f in files:
        if f.is_file():
            f.unlink()
    print(f"clean: 已删除 {len(files)} 个草稿")
    return 0


# ── selfcheck（G.7 半自动化 · 2026-08-07 新增）────────────────────────
SRC_DIR = ROOT / "project" / "src"
# i18n 目录/文件 + 测试目录白名单：其内中文是文案内容/测试描述本身，不算硬编码
CN_I18N_EXEMPT = ("zh-CN.json", "en.json", "/i18n/", "/__tests__/")
# 字符串字面量中文字符检测（宽松：引号包裹 + 含中文）
CN_STR_RE = re.compile(r"""["'\`][^"'\`\n]*[\u4e00-\u9fff][^"'\`\n]*["'\`]""")
# JSX 文本节点中文检测（2026-08-07 二次评估采纳 · 加强 CH4）：
# 匹配 `>裸文本<` 之间的中文——如 <div>中文</div>；排除 {} 表达式（t()/变量）、标签名与属性。
# 仅覆盖单行文本节点（跨行 JSX 文本极少且可人工复核）。
CN_JSX_RE = re.compile(r">\s*([^<>{}\n]*[\u4e00-\u9fff][^<>{}\n]*)\s*<")


def _scan_cn_literals() -> list[str]:
    """扫 project/src 下 .ts/.tsx 字符串字面量 + JSX 文本节点中文（排除注释/i18n 文件）。"""
    hits: list[str] = []
    if not SRC_DIR.is_dir():
        return hits
    for p in sorted(SRC_DIR.rglob("*")):
        if not p.is_file() or p.suffix not in (".ts", ".tsx"):
            continue
        if any(ex in p.as_posix() for ex in CN_I18N_EXEMPT):
            continue
        for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            s = line.lstrip()
            if s.startswith(("//", "*", "/*")):
                continue
            if 't("' in line or "t('" in line or "t(`" in line:
                continue
            if CN_STR_RE.search(line):
                hits.append(f"{_rel(p)}:{i}: {line.strip()[:80]}")
                continue
            # JSX 文本节点：>中文<（裸文本，非表达式）
            m = CN_JSX_RE.search(line)
            if m and m.group(1).strip():
                hits.append(f"{_rel(p)}:{i}: [JSX 裸文本] {line.strip()[:80]}")
    return hits


def _index_check() -> list[str]:
    """4 主文档索引完整性：每个 `## ` 章节标题应在「## 索引」表中有对应行（容错匹配）。"""
    issues: list[str] = []
    for name in sorted(INDEX_REQUIRED):
        p = FILE_DIR / name
        if not p.exists():
            issues.append(f"{name}: 缺失")
            continue
        text = p.read_text(encoding="utf-8")
        idx = re.search(r"## 索引(?:（[^）]*）)?\n(.*?)(?=\n## |\Z)", text, re.S)
        if not idx:
            issues.append(f"{name}: 无「## 索引」表")
            continue
        idx_text = "\n".join(ln for ln in idx.group(1).splitlines() if "|" in ln)
        for m in re.finditer(r"^##\s+([^\n]+)", text, re.M):
            title = m.group(1).strip()
            if title.startswith("索引"):
                continue
            core = re.sub(r"^[一二三四五六七八九十]+、", "", title)
            core = re.split(r"[（(]", core)[0].strip()
            # 空格容错：标题与索引行的空格差异不算不一致（如「功能 ↔ 技术栈」vs「功能↔技术栈」）
            if core and core.replace(" ", "") not in idx_text.replace(" ", ""):
                issues.append(f"{name}: 章节「{title}」未见于索引表（若为索引缩写可忽略）")
    return issues


def _schema_keys(code: str, schema_name: str) -> set[str]:
    """提取 zod schema 顶层字段键（`Name = z.object({` 起点 → `\n});` 切片 → `  key:` 行）。
    方案 B（find 切片）规避 re 非贪婪在嵌套对象上的怪癖。"""
    start = code.find(f"{schema_name} = z.object({{")
    if start < 0:
        return set()
    end = code.find("\n});", start)
    body = code[start : end if end >= 0 else len(code)]
    keys: set[str] = set()
    for line in body.splitlines():
        m = re.match(r"^\s{2}([A-Za-z_]\w*)\s*:", line)
        if m:
            keys.add(m.group(1))
    return keys


# 期望键白名单（CH6 防漂移；来源 = settings.ts 实测 / F1 字段表定案 2026-08-07）
SETTINGS_KEYS_EXPECTED = {
    "appearance", "appearanceMode", "language", "temperature", "maxTokens",
    "providers", "aiPrompts", "storage", "uiFont", "resumeFont", "importedFonts",
    # 2026-08-08 归档收口：M2 F5 导出记忆（export.lastFolder，SettingsSchema 已含）白名单同步
    "export",
}
RESUME_KEYS_EXPECTED = {
    "schemaVersion", "basics", "summary", "education", "work", "projects",
    "skills", "certificates", "languages", "targetJobDescription", "layout",
    # 2026-08-07 M1 落码补充（F11 WP-T1 meta / F19 WP-T2 boundJobIds，仅增不改）
    "meta", "boundJobIds",
}


def _schema_sync_check() -> list[str]:
    """代码-文档同步（条件激活）：settings.ts 真核对；resume.ts 未落码则待激活。"""
    out: list[str] = []
    schema_dir = ROOT / "project" / "src" / "shared" / "schema"
    if not schema_dir.is_dir():
        return ["⚠ 条件激活：src/shared/schema/ 不存在，代码-文档同步整体跳过"]
    st = schema_dir / "settings.ts"
    if st.exists():
        code_keys = _schema_keys(st.read_text(encoding="utf-8"), "SettingsSchema")
        if code_keys:
            only_code = sorted(code_keys - SETTINGS_KEYS_EXPECTED)
            only_exp = sorted(SETTINGS_KEYS_EXPECTED - code_keys)
            if only_code or only_exp:
                out.append(f"⚠ settings.ts 键与期望白名单不一致：仅代码={only_code or '无'} / 仅期望={only_exp or '无'}（人工核对后同步白名单或文档）")
            else:
                out.append(f"✅ settings.ts 键空间与期望一致（{len(code_keys)} 键）")
        else:
            out.append("⚠ settings.ts 未解析到 SettingsSchema 块（人工核对）")
    rt = schema_dir / "resume.ts"
    if not rt.exists():
        out.append("♻ 条件激活：resume.ts 未落码（M1），F1 文档↔代码检查待激活")
    else:
        code_keys = _schema_keys(rt.read_text(encoding="utf-8"), "ResumeSchema")
        only_code = sorted(code_keys - RESUME_KEYS_EXPECTED)
        only_exp = sorted(RESUME_KEYS_EXPECTED - code_keys)
        if only_code or only_exp:
            out.append(f"⚠ resume.ts 键与 F1 期望不一致：仅代码={only_code or '无'} / 仅期望={only_exp or '无'}")
        else:
            out.append(f"✅ resume.ts 键空间与 F1 字段表一致（{len(code_keys)} 键）")
    return out


def _coverage_check(today: str) -> list[str]:
    """
    CH7 实现情况覆盖检查（2026-08-07 新增 · 用户要求"文档同步用代码辅助"）：
    对比 git 最近 commit 改动的代码文件 与《项目实现情况.md》当日/近期条目，
    检测"代码改了但《项目实现情况》没有对应登记"的滞后（本次事故根因之一）。
    规则：
      - git 仓库 = project/（file/ 文档不进 git，天然隔离）
      - 只看最近 N 个 commit（默认 8）的 src/ 改动（排除 out/、package 锁等产物）
      - 提取 commit message + 改动文件名片段，在《项目实现情况》最近 30 日内条目中搜
      - 命中任意关键词 → 视为已登记；全不命中 → 提示人工确认（警告非硬失败）
    """
    out: list[str] = []
    git_dir = ROOT / "project"
    if not (git_dir / ".git").is_dir():
        return out  # 非 git 环境（如归档副本）跳过
    try:
        res = subprocess.run(
            ["git", "log", f"-8", "--pretty=%H%x09%s", "--name-only"],
            cwd=git_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
        )
    except Exception:
        return out  # git 不可用（锁/无 git）→ 跳过，不阻塞 selfcheck
    if res.returncode != 0:
        return out

    impl = FILE_DIR / "项目实现情况.md"
    impl_text = impl.read_text(encoding="utf-8") if impl.exists() else ""
    # 《项目实现情况》非按日期分章（§一 持续追加），窗口截取会漏中段条目 → 全文搜索
    window = impl_text

    def _has_hit(keywords: list[str]) -> bool:
        for kw in keywords:
            if kw and kw in window:
                return True
        return False

    cur_hash: str | None = None
    cur_msg = ""
    cur_files: list[str] = []
    for line in res.stdout.splitlines():
        line = line.rstrip()
        if not line:
            continue
        if "\t" in line:
            h, msg = line.split("\t", 1)
            cur_hash = h
            cur_msg = msg
            cur_files = []
            continue
        # 文件行（--name-only 输出）
        cur_files.append(line)
        if not cur_hash:
            continue
        # 只看 src/ 代码改动，忽略产物/锁文件
        if not line.startswith("src/"):
            continue
        # commit message 关键词（主体）+ 文件名特征词
        words = [w for w in cur_msg.replace("-", " ").split() if len(w) >= 2]
        kw = [cur_msg] + words
        # 文件名取有意义的 token（src/renderer/src/components/nav/NavBar.tsx → navbar）
        stem = line.split("/")[-1].replace(".tsx", "").replace(".ts", "").replace(".css", "").replace(".json", "")
        kw.append(stem)
        if not _has_hit(kw):
            out.append(
                f"commit {cur_hash[:8]}「{cur_msg[:40]}」改动 {line} 未见《项目实现情况》对应登记"
            )
    return out


def cmd_selfcheck(args: argparse.Namespace) -> int:
    """G.7 半自动化自检：CH1 引用 / CH2 索引 / CH3 术语 / CH4 中文 / CH5 日志 / CH6 代码-文档。"""
    today = date.today().isoformat()
    issues: list[str] = []
    print("selfcheck: G.7 结构化自检报告")

    broken, retired, hist = [], [], []
    # 历史叙述豁免词：复述"当时修复/已删草稿/改指"等溯源说明不算真断裂
    HIST_WORDS = ("已删草稿", "改指", "修复", "溯源", "历史", "当时", "退役", "已删")
    for p in sorted(FILE_DIR.glob("*.md")):
        text = p.read_text(encoding="utf-8")
        for m in MD_REF_RE.finditer(text):
            ref = m.group(1)
            kind, note = _locate(ref)
            if kind == "missing":
                line_no = text[: m.start()].count("\n") + 1
                ln = text.splitlines()[line_no - 1] if line_no <= len(text.splitlines()) else ""
                if p.name == "项目日志.md" or any(w in ln for w in HIST_WORDS):
                    hist.append(f"{p.name}:{line_no}: 引用《{ref}》历史叙述/已删草稿（豁免）")
                else:
                    broken.append(f"{p.name}:{line_no}: 引用《{ref}》不存在")
            elif kind == "retired":
                retired.append(f"{p.name}: 引用《{ref}》{note}")
    print(f"  CH1 引用断裂：{'✅ 通过' if not broken else f'❌ {len(broken)} 处'}"
          + (f"；退役引用 {len(retired)} 处（♻ 正常）" if retired else "")
          + (f"；历史豁免 {len(hist)} 处（ℹ）" if hist else ""))
    for b in broken:
        print(f"     ❌ {b}")
        issues.append(b)
    for h in hist:
        print(f"     ℹ {h}")

    idx_issues = _index_check()
    print(f"  CH2 索引同步：{'✅ 通过' if not idx_issues else f'⚠ {len(idx_issues)} 条需人工确认'}")
    for i in idx_issues:
        print(f"     ⚠ {i}")
        issues.append(i)

    hints = []
    for p in sorted(FILE_DIR.glob("*.md")):
        for line in p.read_text(encoding="utf-8").splitlines():
            hit = next((n for n, pat in TERM_PATTERNS if re.search(pat, line)), None)
            if hit and not any(w in line for w in TERM_CONTEXT_EXEMPT):
                hints.append(f"{p.name}: 残留旧词「{hit}」")
    print(f"  CH3 术语统一：{'✅ 无残留' if not hints else f'⚠ {len(hints)} 条需人工确认'}")
    for h in hints:
        print(f"     ⚠ {h}")

    cn = _scan_cn_literals()
    print(f"  CH4 硬编码中文：{'✅ 无' if not cn else f'⚠ {len(cn)} 处需人工确认（排除 i18n/注释/t()）'}")
    for c in cn[:20]:
        print(f"     ⚠ {c}")
    if len(cn) > 20:
        print(f"     … 其余 {len(cn) - 20} 处")

    log = FILE_DIR / "项目日志.md"
    # 2026-08-08 路由化：当日条目落 file/detail/logs/YYYY-MM.md，两处任一命中即已登记
    log_sub = FILE_DIR / "detail" / "logs" / f"{today[:7]}.md"
    logged = (log.exists() and f"### {today}" in log.read_text(encoding="utf-8")) or (
        log_sub.exists() and f"### {today}" in log_sub.read_text(encoding="utf-8")
    )
    print(f"  CH5 日志已登记（{today}）：{'✅ 已登记' if logged else '❌ 当日无条目，需补记'}")
    if not logged:
        issues.append(f"《项目日志.md》/ file/detail/logs/{today[:7]}.md 当日（{today}）无条目")

    sync = _schema_sync_check()
    print("  CH6 代码-文档同步（条件激活）：")
    for s in sync:
        print(f"     {s}")
        if s.startswith("⚠"):
            issues.append(s)

    ch7 = _coverage_check(today)
    print(f"  CH7 实现情况覆盖：{'✅ 最近改动均已登记' if not ch7 else f'⚠ {len(ch7)} 项待人工确认（代码改了但《项目实现情况》可能未跟上）'}")
    for c in ch7:
        print(f"     ⚠ {c}")

    print(f"selfcheck: 完成 —— {'✅ 全部通过' if not issues else f'⚠ {len(issues)} 条警告需人工确认（见上）'}")
    return 0


# ── where（C5 人工核对加速器 · 2026-08-07 新增）─────────────────────────
def cmd_where(args: argparse.Namespace) -> int:
    """查关键词在 file/ 各文档的引用位置（文件:行:摘要），C5 跨文档核对加速。"""
    pat = re.compile(re.escape(args.keyword))
    hits = 0
    for p in sorted(FILE_DIR.glob("*.md")):
        for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            if pat.search(line):
                print(f"{p.name}:{i}: {line.strip()[:100]}")
                hits += 1
    print(f"where: 「{args.keyword}」共 {hits} 处引用" if hits else f"where: 「{args.keyword}」无引用")
    return 0


# ── brief（工作包简报骨架生成 · 2026-08-07 新增）────────────────────────
BRIEF_TEMPLATE = """# {stage} 批 WP-{stage}{id} · {topic} 工作包简报

> 生成：docs-tool brief（骨架；管理者按《项目规范.md》§三 4 补全定制内容）
> 模式 / 模型档位：guided / 轻（管理者修订）
> 独占产出：file/draft/{stage}_{id}_{topic}.md（并行期仅写此文件，禁碰正式文档）

## 1. 包 ID 与名称
- 包 ID：{stage}-{id}
- 名称：{topic}

## 2. 输入文档清单（先读文档再动手，见 4.7 G.1）
- [ ] 《项目规范.md》（铁律总集）
- [ ] （管理者补：相关《项目功能.md》F 章节 /《技术栈.md》§x / 待拍板 #xx）

## 3. 独占产出
- file/draft/{stage}_{id}_{topic}.md

## 4. 合并归属（落点表，管理者按 §1.3 填写）
- （管理者补：文档 / 章节 / 段落）

## 5. 写作规范
- （管理者补：禁硬编码中文 / 中英对称 / 仅增不改 / 契约冻结等）

## 6. 自检清单
- [ ] 只写了独占草稿，未碰正式文档
- [ ] （管理者补：本包专属自检项）

## 7. 监督复核要点（管理者补，供监督 §7 清单精准复核）
- （管理者补：本包落地后监督须重点复核的条目，列对应 F/C 编号）
"""


def cmd_brief(args: argparse.Namespace) -> int:
    """生成工作包简报骨架 → file/draft/{stage}_{id}_{topic}.md（只写 draft/）。"""
    DRAFT_DIR.mkdir(parents=True, exist_ok=True)
    out = DRAFT_DIR / f"{args.stage}_{args.id}_{args.topic}.md"
    if out.exists():
        print(f"brief: 已存在，跳过（{_rel(out)}）", file=sys.stderr)
        return 1
    out.write_text(
        BRIEF_TEMPLATE.format(stage=args.stage, id=args.id, topic=args.topic), encoding="utf-8"
    )
    print(f"brief: 已生成骨架 {_rel(out)}")
    print(f"  （{args.stage} 批 WP-{args.stage}{args.id} · {args.topic}；请管理者按 §三 4 补全）")
    return 0


# ── 入口 ─────────────────────────────────────────────────────────────────
def main(argv: list[str] | None = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # Windows 控制台兜底
    except Exception:  # pragma: no cover - 非 TTY 环境可能不支持
        pass
    parser = argparse.ArgumentParser(
        prog="docs-tool",
        description="项目文档运维工具层（零依赖；写权限只到 .workbuddy/ 与 file/draft/，禁碰 file/ 正式文档）",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("snapshot", help="生成 file/ *.md 哈希基线 → .workbuddy/docs-hashes.json")
    p.set_defaults(func=cmd_snapshot)

    p = sub.add_parser("diff", help="对比基线列出改动（新增/修改/删除）")
    p.set_defaults(func=cmd_diff)

    p = sub.add_parser("matrix", help="扫草稿合并归属 → 需求覆盖矩阵")
    p.set_defaults(func=cmd_matrix)

    p = sub.add_parser("check", help="体检：引用断裂 + 索引完整性 + 旧词提示")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("state", help="生成 G.6 状态文件四要素 → .workbuddy/memory/MEMORY.md")
    p.add_argument("--goal-from-briefs", action="store_true", help="从 draft/ 简报自动拼接 goal（draft/ 空则回退待填）")
    p.set_defaults(func=cmd_state)

    p = sub.add_parser("selfcheck", help="G.7 半自动化自检（CH1 引用/CH2 索引/CH3 术语/CH4 中文/CH5 日志/CH6 代码-文档/CH7 实现情况覆盖）")
    p.set_defaults(func=cmd_selfcheck)

    p = sub.add_parser("where", help="查关键词在 file/ 各文档的引用位置（C5 核对加速）")
    p.add_argument("keyword", help="要查询的关键词或编号，如 F19 / layout")
    p.set_defaults(func=cmd_where)

    p = sub.add_parser("brief", help="生成工作包简报骨架 → file/draft/（只写 draft/）")
    p.add_argument("--stage", required=True, help="阶段名，如 P / R / T")
    p.add_argument("--id", required=True, help="包序号，如 1 / 2")
    p.add_argument("--topic", required=True, help="包主题（将出现在文件名）")
    p.set_defaults(func=cmd_brief)

    p = sub.add_parser("clean", help="删除 file/draft/ 草稿（--yes 才删）")
    p.add_argument("--yes", action="store_true", help="确认删除（默认仅列出）")
    p.set_defaults(func=cmd_clean)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
