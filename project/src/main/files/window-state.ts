/**
 * files/window-state.ts —— 窗口状态记忆（M5 D4 自写，不引停滞库 electron-window-state）
 * 独立 `userData/window-state.json`（窗口位置/尺寸/最大化是运行态偏好，非"设置"，不碰 SettingsSchema 契约）。
 * 要点：多屏可见性校验（窗口不在任何显示器内 → 回默认）+ 防抖保存 + 原子写；
 *       最大化状态用 getNormalBounds()（库坑：maximize 时 getBounds 返回的是最大化尺寸）。
 */
import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized?: boolean
}

const FILE = 'window-state.json'
const SAVE_DEBOUNCE_MS = 500

function stateFile(): string {
  return join(app.getPath('userData'), FILE)
}

/** 解析并校验持久化状态（损坏/缺字段 → 回落默认） */
export function parseWindowState(raw: string): WindowState | null {
  try {
    const o = JSON.parse(raw) as Partial<WindowState>
    if (typeof o.width !== 'number' || typeof o.height !== 'number') return null
    if (o.width < 400 || o.height < 300) return null // 防极端脏值
    return {
      x: typeof o.x === 'number' ? o.x : undefined,
      y: typeof o.y === 'number' ? o.y : undefined,
      width: o.width,
      height: o.height,
      isMaximized: o.isMaximized === true
    }
  } catch {
    return null
  }
}

/** 多屏可见性校验：状态窗口必须与任一显示器工作区相交，否则回落默认（外接屏拔出兜底） */
export function ensureVisible(state: WindowState, displays: readonly Rectangle[]): WindowState {
  if (state.x === undefined || state.y === undefined) return state
  const rect = { x: state.x, y: state.y, width: state.width, height: state.height }
  const visible = displays.some((d) => {
    const overlapX = Math.min(rect.x + rect.width, d.x + d.width) - Math.max(rect.x, d.x)
    const overlapY = Math.min(rect.y + rect.height, d.y + d.height) - Math.max(rect.y, d.y)
    return overlapX > 40 && overlapY > 40 // 至少 40px 可见
  })
  return visible ? state : { width: state.width, height: state.height }
}

/** 读取持久化窗口状态（损坏/多屏不可见 → 回落默认） */
export async function getWindowState(defaults: { width: number; height: number }): Promise<WindowState> {
  try {
    const raw = await fs.readFile(stateFile(), 'utf-8')
    const parsed = parseWindowState(raw)
    if (!parsed) return { ...defaults }
    return ensureVisible(parsed, screen.getAllDisplays().map((d) => d.workArea))
  } catch {
    return { ...defaults }
  }
}

/** 防抖收集窗口状态并原子写盘（resize/move 触发；close 前 flush） */
export function trackWindowState(win: BrowserWindow): void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const collect = (): WindowState => {
    const b = win.isMaximized() ? win.getNormalBounds() : win.getBounds()
    return { x: b.x, y: b.y, width: b.width, height: b.height, isMaximized: win.isMaximized() }
  }
  const write = async (): Promise<void> => {
    const state = collect()
    const tmp = `${stateFile()}.tmp`
    try {
      await fs.writeFile(tmp, JSON.stringify(state), 'utf-8')
      await fs.rename(tmp, stateFile())
    } catch {
      // 状态记忆失败不阻塞主流程（非关键路径）
    }
  }
  const schedule = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void write(), SAVE_DEBOUNCE_MS)
  }
  win.on('resize', schedule)
  win.on('move', schedule)
  win.on('close', () => {
    if (timer) clearTimeout(timer)
    void write() // close 前 flush（含托盘 hide 前）
  })
  win.on('closed', () => {
    if (timer) clearTimeout(timer)
  })
}

/** 恢复最大化（先 maximize 后 show 防闪跳——库坑：直接 new 最大化尺寸窗口会闪） */
export function applyMaximized(win: BrowserWindow, isMaximized: boolean): void {
  if (!isMaximized) return
  win.once('ready-to-show', () => win.maximize())
}
