# -*- coding: utf-8 -*-
"""
gen_nav_proto.py
================
from《原型线框图.html》(线框图【源文件】) 提取 13 张界面线框图 + 图例，
生成《导航交互原型.html》——一个【模拟用户操作流程】的交互原型。

2026-08-05 第 5 轮布局调整（依据用户反馈）：
  - 启动即显示【主界面(⑩)】作为应用主壳（左侧栏导航 + 右侧分区面板）。
  - 右侧面板【默认显示欢迎】（仅图标 + 欢迎语），不再是独立全屏欢迎界面。
  - 点击左侧栏「简历 / AI / 设置」切换右侧分区；再点分区条目进入对应功能屏。
  - 单一真相源：线框改动只改《原型线框图.html》，重跑本脚本即可同步两份。

2026-08-05 R 批（WP-R5 合并阶段执行）：
  - ③ 改 AI 四分区、⑤ 设置屏增「AI 提示词」区、⑥ 简历管理屏增岗位名列。
  - 新增 ⑭ 岗位目录管理屏 card → 新增站点 s-jobs（岗位目录）。
  - ⑩「AI」分区选单改 5 条目（语法纠正/自我介绍/简历润色/匹配打分/岗位目录）。
  - parsed 索引：0..10=①..⑪，11=⑬，12=⑭，13=图例。

2026-08-06 S 批（WP-S1/S2/S3 合并阶段执行）：
  - ⑤ 设置区改三独立功能屏（外观 F18 / AI 设置 F12 / 简历存储位置 F21），右面板展示 AI 设置屏（四服务商 tab + 全局参数）。
  - ⑩「设置」分区选单改 3 条目（外观 / AI 设置 / 简历存储位置）。

2026-08-06 布局定案（用户反馈）：
  - 主壳改【悬浮面板/模态窗形态】：2:8 纵向分割（左 20% / 右 80%）无缝贴合无外黑边；高度动态自适应（5 固定卡片撑开，底部留白约 80px，overflow hidden 无滚动）；顶部无全局大标题。
  - ⑩ 主界面重绘：viewBox 680×600（窗口 664×584）；左导航品牌文字下移 y=54、菜单 y=100/170/240（项间 26px）、选中灰块 rx=10；
    右内容 5 固定卡片（x=193 w=426 h=68 间距 16 rx=14 文字左距 24，y=100..436，第一卡上缘与「简历」选中块上缘【顶部拉齐】）；
    X 常态极浅灰 #CCCCCC → Hover 深灰/黑（8px 细线，44×44 热区）。
  - 热区重算：简历 x=20(2.94%) y=100(16.67%) / AI y=170(28.33%) / 设置 y=240(40.00%)，w=112(16.47%) h=44(7.33%)。
  - 交互面板（main-overlay）：top 1.33% / h 97.33% / padding 0；分区选单去 .ov-head，卡片 .ov-item 68px/16px/14px/24px；
    顶部新增 .ov-x（常态极浅灰 → Hover 深灰/黑）；「简历」分区选单收敛为 5 固定卡片（导出/模板入口在编辑器顶栏）。

2026-08-06 四次定案（以真实读到的豆包 AI 参考图参数为准，覆盖 2026-08-06 布局定案）：
  - 两栏均纯白 #FFFFFF（无分隔线无外黑边）；窗口圆角 16px；品牌小留白 ~24px；菜单间距紧凑 ~14px、选中=文字略加粗（无灰块）、设置=经典齿轮。
  - ⑩ 主界面重绘：viewBox 680×480（窗口 664×464）；拉齐线 y=64；5 卡片（x=180 w=420 h=56 rx=16 间距 12，y=64..336；白底+1px #E5E5E7 描边，首卡浅灰 #F3F4F6 去描边；纯文字无图标）；底部留白 80px。
  - 窗口控制三按钮（最小化 / 全屏 / 关闭，24×24 圆角 6，常态 #666 → Hover #1A1A1A 加浅灰底，距顶 / 右 ~12px；替换原 CloseX 44×44 约定）。
  - 热区重算：简历 x=20(2.94%) y=64(13.33%) / AI y=102(21.25%) / 设置 y=140(29.17%)，w=112(16.47%) h=24(5.00%)。
  - 交互面板（main-overlay）：top 1.67% / h 96.67% / padding 0；.ov-item 去图标、1px #E5E5E7 描边、圆角 16、高 56、max-width 440；.ov-item.active 浅灰底去描边（首卡）；.ov-x 16px #666 → Hover #111；.ov-list padding 56px 0 80px（顶部拉齐 + 底部留白 80）。
  - 2026-08-06 五次定案同步（本次）：⑨ 欢迎面板 / ⑩ 主界面 应用「侧栏独立悬浮卡 + 右内容主题主背景(#F5F5F5) + 无描边仅投影卡 + 窗口控制三按钮」；左导航品牌居中、菜单项 icon24+字17 间距28；配色不进线框（HOT 热区改 22.5/37.5/52.5%、main-overlay 左 30.88%/宽 67.94%/背景 #F5F5F5、.ov-item 无描边圆角12字17、.ov-x → 窗口控制三按钮、.ov-list padding 100px 0 80px 0）。

2026-08-05 视觉定案（线框风）：
  - 线框图全量由深色改【线框风】：无阴影/渐变/圆角/彩色点缀；
    左导航 #F3F4F6(18~20%) + 右内容 #FDFAF4(80~82%) + 选中 #B0B3B8 + 文字描边 #111。
  - ⑩ 主界面重绘：左导航 132px(19.4%)、菜单项 44px 高（简历/AI/设置），
    热区坐标同步重算：x=20(2.94%) / y=58,106,154(12.61%,23.04%,33.48%) / w=112(16.47%) / h=44(9.57%)。
  - main-overlay 定位随新右面板(x=140..672, y=8..452)更新，overlay 视觉改柔顺卡片风（圆角 + 轻投影；dark 文字 #E8E6E0 → #D9D9DE 略柔和）。
  - 规范见《技术栈.md》3.15.1 /《项目功能.md》四。

用法：python gen_nav_proto.py
"""
import re
import os
import json

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "file", "原型线框图.html")
OUT = os.path.join(BASE, "file", "导航交互原型.html")

html = open(SRC, encoding="utf-8").read()

# ---- 1. 切分 <div class="card"> 块 ----
starts = [m.start() for m in re.finditer(r'<div class="card">', html)]
cards = []
for i, s in enumerate(starts):
    e = starts[i + 1] if i + 1 < len(starts) else len(html)
    cards.append(html[s:e])


def extract(chunk):
    h2 = re.search(r'<h2>(.*?)</h2>', chunk, re.S)
    svg = re.search(r'(<svg[\s\S]*?</svg>)', chunk)        # 仅取第一张(主视图)
    p = re.search(r'<p>([\s\S]*?)</p>', chunk)
    return (h2.group(1).strip() if h2 else "",
            svg.group(1) if svg else "",
            p.group(1).strip() if p else "")


parsed = [extract(c) for c in cards]
# parsed 索引: 0..10 = ①..⑪ ; 11 = ⑬ ; 12 = ⑭（岗位目录，R 批新增）; 13 = 图例（⑫ ATS 屏已移除）

# 图例 grid
_leg = re.search(r'<div class="grid">([\s\S]*?)</div>', cards[13])
LEGEND_GRID = _leg.group(0).replace('class="grid"', 'class="legend-tags"') if _leg else ""

# ---- 2. 屏映射（注意：欢迎界面⑨不再是独立屏，已内嵌为主界面右侧默认面板）----
SCREEN_SVG = {
    's-edit': 0, 's-import-wizard': 1, 's-ai': 2, 's-template': 3, 's-settings': 4,
    's-manage': 5, 's-export': 6, 's-import-source': 7, 's-main': 9,
    's-privacy': 10, 's-template-edit': 11, 's-jobs': 12,
}

ROLE = {
    's-main': '应用主壳 · 悬浮面板(侧栏独立悬浮卡 + 右内容主题主背景 #F5F5F5，选中=文字略加粗无灰块)；启动即显示，右侧默认欢迎(图标卡+超大标题「欢迎回来」)，点左侧栏切换分区',
    's-edit': '编辑器 · 左表单右实时预览，顶栏可进入 隐私/设置/主题/导出',
    's-import-source': '导入第一步 · 选来源，视觉模型守卫(非视觉模型置灰)',
    's-import-wizard': '导入三步核对 · 防盲信 AI，向导不可跳过',
    's-ai': 'AI 四分区 · 顶栏「当前简历」选择器 +「岗位」选择器（四分区共享）；语法纠正 / 自我介绍 / 简历润色 / 匹配打分(辅助非替代)；未选简历/未绑岗位时润色与打分禁用',
    's-jobs': '岗位目录管理 · 列表/新建/编辑/删除(名称/投递时间/岗位要求)，与简历绑定',
    's-template': '模板画廊 + 主题色板',
    's-template-edit': '模板编辑与主题定制 · L1 换皮 / L2 重组',
    's-settings': '设置区三功能屏 · 外观(F18: 4色主题+深色跟随系统+语言二选一+界面字体下拉/导入字体) / AI 设置(F12) / 简历存储位置(F21)；F11 其余(模板/更新/备份/关于) M5',
    's-manage': '多份简历清单 · 双视图(最近默认/管理)；最近视图按活动时间倒序(名称+最后编辑时间，可选副列最后打开)，每行 打开/复制/重命名/删除；管理视图全量维护；空态引导新建',
    's-export': '导出对话框 · 4 格式卡片(文字版PDF v1.0 / 图片版PDF v1.1 置灰 / 图片格式 v1.1 置灰 / JSON v1.0) + 目标位置 + 进度条',
    's-privacy': '隐私打码态 · 预览/导出脱敏，编辑表单不受影响',
    's-legend': '线框图图例',
}

LABEL = {
    's-main': '主界面', 's-edit': '编辑器',
    's-import-source': '导入来源', 's-import-wizard': '导入向导', 's-ai': 'AI 辅助',
    's-jobs': '岗位目录', 's-template': '模板与主题', 's-template-edit': '模板编辑',
    's-settings': '设置', 's-manage': '简历管理', 's-export': '导出',
    's-privacy': '隐私打码', 's-legend': '图例',
}

STATIONS = ['s-main', 's-edit', 's-import-source', 's-import-wizard',
            's-ai', 's-jobs', 's-template', 's-template-edit', 's-settings',
            's-manage', 's-export', 's-privacy', 's-legend']


def hot(l, t, w, h, go, title=''):
    return (f'<div class="hot" style="left:{l:.2f}%;top:{t:.2f}%;width:{w:.2f}%;'
            f'height:{h:.2f}%" data-go="{go}" title="{title}"></div>')


def hot_sub(l, t, w, h, sub, title=''):
    return (f'<div class="hot" style="left:{l:.2f}%;top:{t:.2f}%;width:{w:.2f}%;'
            f'height:{h:.2f}%" data-sub="{sub}" title="{title}"></div>')


# 主界面(⑩) 左侧栏三个模块热点（点击切换右侧分区面板）——坐标对齐 2026-08-06 四次定案后的左导航
# 菜单项：x=20(2.94%) / y=64,102,140(13.33%,21.25%,29.17%) / w=112(16.47%) / h=24(5.00%)（项间距紧凑 14px）
HOT = {
    's-main': [
        hot_sub(3.53, 22.50, 22.06, 9.17, 'resume', '左侧栏 · 简历'),
        hot_sub(3.53, 37.50, 22.06, 9.17, 'ai', '左侧栏 · AI'),
        hot_sub(3.53, 52.50, 22.06, 9.17, 'settings', '左侧栏 · 设置'),
    ],
    's-edit': [
        hot(74.12, 3.13, 5.88, 5.00, 's-privacy', '隐私开关'),
        hot(80.59, 3.13, 5.88, 5.00, 's-settings', '设置'),
        hot(87.06, 3.13, 5.59, 5.00, 's-template', '主题'),
        hot(93.24, 3.13, 5.59, 5.00, 's-export', '导出'),
    ],
}

CHIPS = {
    's-main': [('← 返回欢迎', '@welcome')],
    's-edit': [('← 返回主界面', 's-main'), ('隐私打码 ▸', 's-privacy'),
               ('设置 / API Key ▸', 's-settings'), ('模板与主题 ▸', 's-template'),
               ('导出 ▸', 's-export')],
    's-import-source': [('下一步 ▸ 导入向导', 's-import-wizard'), ('← 返回主界面', 's-main')],
    's-import-wizard': [('← 返回来源', 's-import-source'), ('确认写入 ▸ 编辑器', 's-edit')],
    's-ai': [('去润色 ▸ 编辑器', 's-edit'), ('← 返回主界面', 's-main')],
    's-jobs': [('新建岗位 ▸ 编辑器', 's-edit'), ('← 返回主界面', 's-main')],
    's-template': [('应用 ▸ 编辑器', 's-edit'), ('自定义编辑 ▸ 模板编辑', 's-template-edit'),
                   ('← 返回主界面', 's-main')],
    's-template-edit': [('← 返回模板', 's-template'), ('← 返回主界面', 's-main')],
    's-settings': [('← 返回', 's-main')],
    's-manage': [('打开 ▸ 编辑器', 's-edit'), ('新建 ▸ 编辑器', 's-edit'),
                 ('← 返回主界面', 's-main')],
    's-export': [('导出（完成）', '__done__'),
                 ('← 返回主界面', 's-main')],
    's-privacy': [('← 返回编辑器', 's-edit')],
    's-legend': [],
}


def chip(l, g):
    if g.startswith('@'):
        return f'<div class="chip" data-sub="{g[1:]}">{l}</div>'
    return f'<div class="chip" data-go="{g}">{l}</div>'


S_MAIN_DESC = ('启动即进入<b>主界面</b>（应用主壳 · 悬浮面板/模态窗形态 · 柔顺卡片风）：内部 <b>2:8 纵向分割</b>（左导航 ≈20% / 右内容 ≈80%）；'
               '<b>侧栏 = 独立悬浮卡片</b>（仅左圆角 16px + 向右投影，不再与内容同白无缝），<b>右内容区背景 = 主题主背景色</b>（light `#F5F5F5`，不再两栏纯白）；窗口圆角 16px + 外阴影 `0 20px 50px`；'
               '<b>高度动态自适应</b>（5 张固定卡片 + 上下留白撑开，底部留白约 80px，外层 overflow hidden 无滚动）；<b>顶部无全局大标题</b>。'
               '左侧导航 = <b>品牌水平居中</b>（16px/600）+ 菜单项（icon 24px + 文字 17px/500、项间距 ~28px），「简历」选中 = 文字略加粗（无灰块）、「设置」= 经典齿轮；'
               '右侧<b>默认显示欢迎</b>（右上角窗口控制三按钮 + 居中图标卡 + 超大标题「欢迎回来」+ 副语，充足留白）；'
               '点击左侧栏切换右侧为<b>固定卡片分区选单</b>（第一张卡片与左导航「简历」菜单项<b>顶部拉齐</b>；宽≈右侧 90% 右缩 / 高 56 / 间距 14 / 圆角 12 / 字号 17 / 文字左距 24 / 纯文字无图标；'
               '卡片默认 = 无描边 + 投影 `0 6px 24px`，hover 上浮变暗 / active 下沉），'
               '再点条目进入对应功能屏（编辑器 / 导入 / AI 四分区 / 岗位目录 / 模板 / 设置 / 管理 / 导出）；「打开或最近」进入最近简历列表屏（即 ⑥「最近」视图，按活动时间倒序）。'
               '「简历」分区选单 = <b>5 固定卡片</b>：新建空白简历 / 打开或最近 / 导入 / 管理多份简历 / 岗位目录（导出与模板入口在编辑器顶栏）。'
               '「AI」分区选单 5 条目：语法纠正 / 自我介绍 / 简历润色 / 匹配打分 + 岗位目录（F19）。'
               '「设置」分区选单 3 条目：外观（F18）/ AI 设置（F12）/ 简历存储位置（F21，S 批）。')


def screen_html(sid):
    role = ROLE[sid]
    if sid == 's-legend':
        inner = (f'<div class="wf">{LEGEND_GRID}</div>'
                 f'<div class="chips"></div>'
                 f'<p class="desc">{parsed[12][2]}</p>')
        return (f'<div class="screen" id="{sid}"><h2>图例</h2>'
                f'<p class="role">{role}</p>{inner}</div>')
    idx = SCREEN_SVG[sid]
    title = parsed[idx][0]
    svg_html = parsed[idx][1]
    hotspots = ''.join(HOT.get(sid, []))
    chips = ''.join(chip(l, g) for l, g in CHIPS.get(sid, []))
    if sid == 's-main':
        # 主界面：线框图 + 覆盖在右侧区域的交互面板
        # .canvas 是定位容器（无 padding）：SVG 与 .hot/.main-overlay 共享同一参照系，
        # 百分比坐标才与 SVG viewBox 精确对齐（修复 2026-08-05 错位：wf 的 padding 曾使两者参照系不一致）
        inner = (f'<div class="wf"><div class="canvas">{svg_html}{hotspots}'
                 f'<div class="main-overlay" id="mainOverlay"></div></div></div>'
                 f'<div class="chips">{chips}</div>'
                 f'<p class="desc">{S_MAIN_DESC}</p>')
    else:
        desc = parsed[idx][2]
        inner = (f'<div class="wf"><div class="canvas">{svg_html}{hotspots}</div></div>'
                 f'<div class="chips">{chips}</div>'
                 f'<p class="desc">{desc}</p>')
    return (f'<div class="screen" id="{sid}"><h2>{title}</h2>'
            f'<p class="role">{role}</p>{inner}</div>')


SCREENS = ''.join(screen_html(s) for s in STATIONS)

# ---- 3. 页面模板 ----
PAGE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>xiaomengresume 导航交互原型 · 模拟用户操作流程</title>
<style>
  :root{--bg:#0d0d0d;--surface:#161616;--surface2:#262626;--border:#5F5E5A;--text:#D3D1C7;--muted:#9a978d;--accent:#378ADD;--accentT:#cfe6fb;--warn:#EF9F27;}
  *{box-sizing:border-box;}
  html,body{margin:0;height:100%;}
  body{background:var(--bg);color:var(--text);font-family:sans-serif;display:flex;overflow:hidden;}
  /* 左侧 流程地图 */
  #rail{width:212px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;}
  #rail .rail-head{padding:18px 16px 12px;border-bottom:1px solid var(--border);}
  #rail .rail-head .t{font-size:15px;font-weight:500;}
  #rail .rail-head .s{font-size:11.5px;color:var(--muted);margin-top:5px;line-height:1.5;}
  .stations{list-style:none;margin:0;padding:10px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;flex:1;}
  .station{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:9px;cursor:pointer;font-size:13.5px;color:var(--text);transition:background .16s;}
  .station:hover{background:var(--surface2);}
  .station.active{background:var(--accent);color:var(--accentT);}
  .station .dot{width:8px;height:8px;border-radius:50%;background:var(--muted);flex-shrink:0;transition:background .16s;}
  .station.active .dot{background:var(--accentT);}
  /* 主区域 */
  #main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
  #topbar{height:54px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px;padding:0 20px;flex-shrink:0;background:var(--surface);}
  #back{width:34px;height:34px;border-radius:9px;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text);font-size:17px;transition:background .16s;}
  #back:hover{background:var(--accent);color:var(--accentT);}
  #back.disabled{opacity:.32;pointer-events:none;}
  #crumb{font-size:13px;color:var(--muted);}
  #crumb b{color:var(--text);font-weight:500;}
  #topright{margin-left:auto;font-size:11.5px;color:var(--muted);}
  #stage{flex:1;overflow-y:auto;padding:26px 28px 44px;}
  .screen{display:none;}
  .screen.show{display:block;animation:fade .26s ease;}
  @keyframes fade{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
  .screen h2{font-size:16px;font-weight:500;margin:0 0 4px;}
  .screen .role{color:var(--accentT);font-size:12px;margin:0 0 14px;font-weight:500;}
  .screen .desc{color:var(--muted);font-size:12.5px;line-height:1.7;margin:14px 0 0;}
  .screen .desc b{color:var(--text);font-weight:500;}
  /* 线框展台：浅色线框风（2026-08-05 视觉定案，规范见《技术栈.md》3.15.1） */
  .wf{background:#F3F4F6;border:1px solid #44403c;border-radius:0;padding:18px;}
  .canvas{position:relative;}
  .canvas svg{width:100%;height:auto;display:block;}
  .hot{position:absolute;cursor:pointer;border-radius:0;transition:background .14s,box-shadow .14s;}
  .hot:hover{background:rgba(17,17,17,.14);box-shadow:0 0 0 1.5px #111 inset;}
  .hot.active{background:rgba(176,179,184,.55);box-shadow:0 0 0 1.5px #111 inset;}
  /* 主界面右侧交互面板（覆盖线框图右侧分区区域 · 白底柔顺卡片风：2026-08-06 四次定案，顶部拉齐/底部留白 80/无滚动） */
  .main-overlay{position:absolute;left:30.88%;top:1.67%;width:67.94%;height:96.67%;background:#F5F5F5;border:none;border-radius:0;padding:0;overflow:hidden;}
  .ov-ctrls{position:absolute;top:12px;right:12px;display:flex;gap:8px;z-index:5;}
  .ov-ctrl{width:24px;height:24px;border-radius:6px;border:1px solid #666666;color:#666666;display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;background:transparent;transition:background .14s,border-color .14s,color .14s;}
  .ov-ctrl:hover{border-color:#1A1A1A;color:#1A1A1A;background:#ECECEC;}
  .ov-list{padding:100px 0 80px 0;}
  .ov-welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;gap:10px;}
  .ov-logo{width:64px;height:64px;border:1px solid #E5E5E7;border-radius:16px;background:#FFF;color:#111;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,0.06);}
  .ov-title{font-size:34px;font-weight:700;color:#111;}
  .ov-sub{font-size:12.5px;color:#111;opacity:.6;line-height:1.6;}
  .ov-hint{font-size:12px;color:#111;margin-top:6px;}
  .ov-item{display:flex;align-items:center;background:#FFF;border:none;border-radius:12px;color:#111;font-size:17px;height:56px;padding:0 24px;margin-bottom:14px;cursor:pointer;transition:transform .14s,box-shadow .14s,background .14s;text-decoration:none;box-shadow:0 6px 24px rgba(0,0,0,0.05);max-width:430px;}
  .ov-item:hover{transform:translateY(-3px);background:#F7F7F7;box-shadow:0 12px 30px rgba(0,0,0,0.09);}
  .ov-item:active{transform:translateY(1px);box-shadow:0 2px 10px rgba(0,0,0,0.10);}
  .ov-item.active{background:#FFF;box-shadow:0 6px 24px rgba(0,0,0,0.08);font-weight:600;}
  .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;}
  .chip{background:var(--surface2);border:1px solid var(--border);color:var(--text);font-size:12.5px;padding:8px 13px;border-radius:9px;cursor:pointer;transition:background .14s,border-color .14s;}
  .chip:hover{background:var(--accent);border-color:var(--accent);color:var(--accentT);}
  .legend-tags{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:6px;}
  .tag{background:#FDFAF4;border:1px solid #555;color:#111;font-size:12px;padding:6px 10px;display:block;}
  .footnote{margin-top:18px;color:var(--muted);font-size:11.5px;line-height:1.6;}
</style>
</head>
<body>
<!--
  本文件由《原型线框图.html》+ gen_nav_proto.py 自动生成，请勿手改。
  《原型线框图.html》为线框图【唯一源文件】；改线框请改源文件后重跑脚本，保证两份一致。
  交互范式（2026-08-05 第 5 轮）：启动即显示主界面(⑩)；右侧默认欢迎(图标+超大标题「欢迎回来」)；
  点左侧栏(简历/AI/设置)切换右侧分区，再点分区条目进入功能屏。
  布局（2026-08-06 五次定案，对齐《UI示例_参考图.html》）：主壳 = 悬浮面板/模态窗形态，2:8 分割（侧栏独立悬浮卡 + 右内容主题主背景 #F5F5F5，不再两栏纯白无缝），
  高度动态自适应（5 固定卡片撑开，overflow hidden 无滚动）；顶部无全局大标题；左导航品牌水平居中、菜单 icon24+字17 间距 ~28px、
  选中=文字略加粗（无灰块）、设置=齿轮；右内容 5 无描边卡片（圆角 12、高 56、间距 14、纯文字无图标、仅投影 0 6px 24px），
  首卡与「简历」菜单项顶部拉齐；窗口控制三按钮（最小化/全屏/关闭，24×24 圆角 6，#666→Hover #1A1A1A，距顶/右 12）。
-->
<aside id="rail">
  <div class="rail-head">
    <div class="t">流程地图</div>
    <div class="s">启动即主界面。点站点跳转，点左侧栏切换分区，点分区条目进入功能屏。</div>
  </div>
  <ul class="stations" id="stations"></ul>
</aside>
<div id="main">
  <div id="topbar">
    <div id="back" title="返回上一步">&#8249;</div>
    <div id="crumb"></div>
    <div id="topright">单一真相源 · 改线框请改《原型线框图.html》后重跑 gen_nav_proto.py</div>
  </div>
  <div id="stage">@@SCREENS@@</div>
</div>
<script>
  const HISTORY = ['s-main'];
  const labels = @@LABELS@@;
  const stations = @@STATIONS@@;
  let mainPanel = 'welcome';   // 主界面右侧面板状态：welcome / resume / ai / settings
  const CTRLS = '<div class="ov-ctrls">'
               + '<div class="ov-ctrl" title="最小化">–</div>'
               + '<div class="ov-ctrl" title="全屏">▢</div>'
               + '<div class="ov-ctrl" title="关闭">✕</div>'
               + '</div>';
  const OVERLAY = {
    welcome: CTRLS
            + '<div class="ov-welcome"><div class="ov-logo">xr</div>'
            + '<div class="ov-title">欢迎回来</div>'
            + '<div class="ov-sub">开源免费 · 隐私优先 · 防盲信 AI</div>'
            + '<div class="ov-hint">从左侧选择「简历 / AI / 设置」开始</div></div>',
    resume: CTRLS
            + '<div class="ov-list">'
            + '<a class="ov-item active" data-go="s-edit">新建空白简历</a>'
            + '<a class="ov-item" data-go="s-edit">打开或最近</a>'
            + '<a class="ov-item" data-go="s-import-source">导入（PDF / 图片）</a>'
            + '<a class="ov-item" data-go="s-manage">管理多份简历</a>'
            + '<a class="ov-item" data-go="s-jobs">岗位目录</a>'
            + '</div>',
    ai: CTRLS
        + '<div class="ov-list">'
        + '<a class="ov-item active" data-go="s-ai">语法纠正（F8）</a>'
        + '<a class="ov-item" data-go="s-ai">自我介绍（F20）</a>'
        + '<a class="ov-item" data-go="s-ai">简历润色（F7）</a>'
        + '<a class="ov-item" data-go="s-ai">匹配打分（F9）</a>'
        + '<a class="ov-item" data-go="s-jobs">岗位目录（F19）</a>'
        + '</div>',
    settings: CTRLS
             + '<div class="ov-list">'
             + '<a class="ov-item active" data-go="s-settings">外观（F18）</a>'
             + '<a class="ov-item" data-go="s-settings">AI 设置（F12）</a>'
             + '<a class="ov-item" data-go="s-settings">简历存储位置（F21）</a>'
             + '</div>'
  };
  function renderOverlay(){
    const ov = document.getElementById('mainOverlay');
    if(ov) ov.innerHTML = OVERLAY[mainPanel] || OVERLAY.welcome;
    document.querySelectorAll('.hot[data-sub]').forEach(h=>h.classList.toggle('active', h.dataset.sub===mainPanel));
  }
  function setMainPanel(sub){ mainPanel = sub; renderOverlay(); }
  function render(){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('show'));
    const cur = HISTORY[HISTORY.length-1];
    const el = document.getElementById(cur);
    if(el) el.classList.add('show');
    document.querySelectorAll('.station').forEach(st=>st.classList.toggle('active', st.dataset.go===cur));
    document.getElementById('crumb').innerHTML =
      HISTORY.map((id,i)=> (i===HISTORY.length-1 ? '<b>'+labels[id]+'</b>' : labels[id]))
             .join(' <span style="opacity:.5">&#8250;</span> ');
    document.getElementById('back').classList.toggle('disabled', HISTORY.length<=1);
    renderOverlay();
  }
  function go(id){
    if(!id) return;
    if(id==='__done__'){ alert('PDF 已导出（模拟）· 与预览完全一致，矢量且文字可选'); return; }
    HISTORY.push(id); render();
    document.getElementById('stage').scrollTop = 0;
  }
  function back(){ if(HISTORY.length>1){ HISTORY.pop(); render(); document.getElementById('stage').scrollTop = 0; } }
  document.getElementById('back').addEventListener('click', back);
  document.addEventListener('click', e=>{
    const sub = e.target.closest('[data-sub]');
    if(sub){ setMainPanel(sub.dataset.sub); return; }
    const t = e.target.closest('[data-go]');
    if(t) go(t.dataset.go);
  });
  const ul = document.getElementById('stations');
  stations.forEach(id=>{
    const li = document.createElement('li');
    li.className = 'station'; li.dataset.go = id;
    li.innerHTML = '<span class="dot"></span>' + labels[id];
    li.addEventListener('click', ()=>{ HISTORY.length = 0; HISTORY.push(id); render(); document.getElementById('stage').scrollTop = 0; });
    ul.appendChild(li);
  });
  render();
</script>
</body>
</html>
"""

PAGE = PAGE.replace("@@SCREENS@@", SCREENS)
PAGE = PAGE.replace("@@LABELS@@", json.dumps(LABEL, ensure_ascii=False))
PAGE = PAGE.replace("@@STATIONS@@", json.dumps(STATIONS, ensure_ascii=False))

from pathlib import Path

# 路径穿越防御（Mimosa CWE-22）：写入目标必须解析在 file/ 目录内
_OUT_FILE = (Path(BASE) / "file" / "导航交互原型.html").resolve()
if not _OUT_FILE.is_relative_to((Path(BASE) / "file").resolve()):
    raise SystemExit(f"拒绝写入 file/ 目录之外: {_OUT_FILE}")
_OUT_FILE.write_text(PAGE, encoding="utf-8")

print("OK ->", OUT)
print("screens:", len(STATIONS), "| embedded svgs:", len(SCREEN_SVG))
