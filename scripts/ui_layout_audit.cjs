/**
 * ui_layout_audit.cjs —— 列表卡片位置审计（AI 开发期工具，2026-08-11 收编）
 * 对比「简历管理 / 岗位管理」第一张卡片的实际渲染位置（rect）与上方文本元素，
 * 验证 ui-config 尺寸配置的「应然 → 实然」推导（卡片实际宽 = listMaxWidth - 2×listPaddingX）。
 * mock IPC handler 提供数据（独立脚本无主进程 handler；渲染层正常走 ipcRenderer.invoke）。
 * 用法：cd project && node_modules\electron\dist\electron.exe ..\scripts\ui_layout_audit.cjs
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')

const REPO = path.resolve(__dirname, '..')
app.setPath('userData', path.join(app.getPath('temp'), `xm-audit-${Date.now()}`))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let win

// ── mock IPC（数据形态对齐 shared/ipc-channels 契约）──
const RESUME_SUMMARY = [
  { id: 'r1', name: '王晨-销售专员', updatedAt: '2026-08-10T12:02:22.000Z', boundJobIds: [] },
  { id: 'r2', name: '李娜-运营助理', updatedAt: '2026-08-10T20:15:38.000Z', boundJobIds: [] }
]
const JOB_SUMMARY = [
  { id: 'j1', name: '前端工程师（SaaS 方向）', appliedAt: '2026-07', status: 'applying' },
  { id: 'j2', name: '产品运营', appliedAt: '2026-06', status: 'passed' }
]
for (const [ch, data] of Object.entries({
  'resume:list': RESUME_SUMMARY, 'resumes:list': RESUME_SUMMARY, 'resumes:recent': RESUME_SUMMARY, 'jobs:list': JOB_SUMMARY
})) ipcMain.handle(ch, () => data)
ipcMain.handle('jobs:get', (_e, id) => ({ ...JOB_SUMMARY.find((j) => j.id === id), requirements: '', createdAt: '', updatedAt: '' }))
ipcMain.handle('resume:open', () => ({ id: 'r1', title: 'x', schemaVersion: 1, basics: { name: 'x', customFields: [] }, layout: {}, sections: [] }))
ipcMain.handle('resumes:open', () => ({ id: 'r1', title: 'x', schemaVersion: 1, basics: { name: 'x', customFields: [] }, layout: {}, sections: [] }))
ipcMain.handle('resumes:save', () => undefined)
ipcMain.handle('resume:save', () => undefined)

const CLICK = (txt) => `(() => { const n=(s)=>(s||'').replace(/\\s+/g,'').trim(); const t=[...document.querySelectorAll('button,a,[role=button]')]; const h=t.find(e=>n(e.textContent)===${JSON.stringify(txt)})||t.find(e=>n(e.textContent).includes(${JSON.stringify(txt)})); if(h){h.click();return true} return false })()`

async function info() {
  return await win.webContents.executeJavaScript(`(() => {
    const card = document.querySelector('.resume-list-item');
    const r = card ? card.getBoundingClientRect() : null;
    const above = [];
    if (r) {
      for (const el of document.querySelectorAll('h1,h2,p,a,button')) {
        if (card.contains(el)) continue;
        const cls = (el.className || '').toString();
        if (cls.includes('nav-')) continue;
        const er = el.getBoundingClientRect();
        if (er.bottom <= r.top + 1 && er.width > 0 && er.height > 0) {
          const txt = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60);
          if (txt) above.push({ tag: el.tagName, txt, href: el.getAttribute('href') || '', cls: cls.slice(0, 30) });
        }
      }
    }
    return { card: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null, above };
  })()`, true)
}

app.whenReady().then(async () => {
  win = new BrowserWindow({ width: 1280, height: 900, show: true, webPreferences: { preload: path.join(REPO, 'project', 'out', 'preload', 'index.mjs'), contextIsolation: true, sandbox: false } })
  await win.loadFile(path.join(REPO, 'project', 'out', 'renderer', 'index.html'))
  await sleep(3000)
  try {
    await win.webContents.executeJavaScript(CLICK('简历'), true); await sleep(900)
    await win.webContents.executeJavaScript(CLICK('简历管理'), true); await sleep(1800)
    console.log('RESUME ' + JSON.stringify(await info()))
    await win.webContents.executeJavaScript(CLICK('岗位管理'), true); await sleep(1800)
    console.log('JOB ' + JSON.stringify(await info()))
    // 2026-08-11：SettingsAi home-view 化后，记录 AI 字母标题（home-title）位置数据（供微调对齐参考）
    // 路径：设置主项文字（→ settings-home 宫格）→ AI 设置卡（→ settings-ai）
    await win.webContents.executeJavaScript(`(() => {
      const rows = [...document.querySelectorAll('.nav-main-row')];
      const row = rows.find(r => (r.textContent || '').includes('设置'));
      if (!row) return false;
      const txt = row.querySelector('.nav-main-text');
      if (txt) { txt.click(); return true; }
      return false;
    })()`, true)
    await sleep(1500)
    const cardHit = await win.webContents.executeJavaScript(`(() => {
      const cards = [...document.querySelectorAll('.home-card')];
      const c = cards.find(c => (c.textContent || '').includes('AI 设置'));
      if (c) { c.click(); return true; }
      return cards.length;
    })()`, true)
    await sleep(2000)
    const ai = await win.webContents.executeJavaScript(`(() => {
      const t = document.querySelector('.home-title');
      const all = [...document.querySelectorAll('h1,h2,h3')].map(h => (h.textContent || '').trim()).filter(Boolean);
      return { homeTitle: t ? (() => { const r = t.getBoundingClientRect(); return { txt: (t.textContent || '').trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null, headings: all.slice(0, 6) };
    })()`, true)
    console.log('SETTINGS_AI_TITLE ' + JSON.stringify({ cardHit, ...ai }))
  } catch (e) { console.log('AUDIT_ERR ' + e) }
  app.exit(0)
})
