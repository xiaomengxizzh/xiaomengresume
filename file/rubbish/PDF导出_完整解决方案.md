\---

AIGC:
Label: "1"
ContentProducer: 001191110102MACQD9K64018705
ProduceID: 3946588235372794\_0/project\_7670933040851632436-files/docs/PDF导出\_完整解决方案.md
ReservedCode1: ""
ContentPropagator: 001191110102MACQD9K64028705
PropagateID: 3946588235372794#1786168505879
ReservedCode2: ""
---

# PDF 导出问题诊断与解决方案

> 文档版本：v1.0 | 适用阶段：M2 Phase2 | 最后更新：2026-08-08

\---

## 目录

1. [问题诊断报告](#1-问题诊断报告)
2. [解决方案矩阵](#2-解决方案矩阵)
3. [推荐方案](#3-推荐方案)
4. [代码修改清单](#4-代码修改清单)
5. [测试验证计划](#5-测试验证计划)
6. [风险与回退方案](#6-风险与回退方案)

\---

## 1\. 问题诊断报告

### 1.1 GPU 依赖导致 `printToPDF()` 永不 resolve（P0 · 核心阻塞）

**现象**  
在无 GPU 环境（CI 沙箱、远程桌面、Docker 容器、部分 Linux 虚拟机）中，`printToPDF()` 返回的 Promise 永远处于 pending 状态，最终只能靠 15s race 超时兜底，导出失败。

**根因分析**  
Electron 的 `printToPDF()` 底层调用的是 Chromium 的打印管线，该管线依赖 GPU 光栅化（Skia/Dawn）完成页面合成。在无 GPU 环境中：

* Chromium 尝试创建 GPU 上下文失败，回退到 software compositor，但 `printToPDF` 路径**未完全支持** software-only 渲染
* `printToPDF` 内部等待 GPU compositor 的 `DidFinishRendering` 信号，该信号永远不会到来
* 结果：Promise 永远不 resolve，也不 reject

**当前兜底逻辑位置**：`src/main/export/run.ts` → `waitForReact()` 后的 `printToPDF()` 调用处，使用 `Promise.race(\[printPromise, timeout(15000)])` 做超时保护。

**影响面**

* CI 环境：GitHub Actions / GitLab CI 的 Linux runner 无 GPU → 导出 100% 失败
* 用户环境：部分 Windows 远程桌面（RDP）、某些 Linux 发行版的 VM → 随机触发
* 本机开发：有 GPU 时正常工作，开发者容易忽略此问题

\---

### 1.2 导出就绪信号竞态条件（P1）

**现象**  
偶发 PDF 输出空白页或半截内容，尤其是复杂模板（ModernTemplate 含多栏布局时更容易复现）。

**根因分析**  
当前信号链路：

```
App.tsx: 检测 URL 参数 ?export=1
  → 渲染对应模板组件
  → useEffect(() => { window.\_\_exportReady = true })
```

问题在于：

1. **`resumeId !== null` ≠ DOM 已渲染完成**：`resumeId` 只是数据层就绪的标志，从数据加载到 React commit 到 DOM、到 CSS 布局计算、到字体加载，中间有时间差
2. **`useEffect` 在 commit 后异步执行**：React 的 `useEffect` 在浏览器 paint 之后才触发，此时 DOM 存在但**样式尚未完全计算**
3. **`requestAnimationFrame` 仅等待一帧（\~16ms）**：对于简单模板可能足够，但复杂模板（含图片、自定义字体、多栏 flex 布局）的布局计算可能需要多个 rAF 周期

**当前代码位置**：

* 信号设置：`src/renderer/App.tsx` → ExportView 组件内的 `useEffect`
* 信号检测：`src/main/export/run.ts` → `waitForReact()` 内的 `setInterval` 轮询

\---

### 1.3 双打印窗口单例冲突（P2）

**现象**  
在特定操作序列下（如先触发打印预览再触发导出），两个独立的 BrowserWindow 实例同时加载同一份 `?export=1` 页面，造成资源浪费和潜在的 Cookie/Storage 状态冲突。

**根因分析**  
两套独立的导出窗口管理：

|模块|单例变量|用途|
|-|-|-|
|`src/main/print/pdf.ts`|`pdfWindow: BrowserWindow \| null`|用户手动打印预览|
|`src/main/export/run.ts`|`exportWindow: BrowserWindow \| null`|自动导出流程|

两者各自维护生命周期，互不感知。当 IPC `export:run` 和 IPC `print:preview` 在短时间内被连续触发时，会同时创建两个隐藏窗口。

**影响面**

* 内存浪费：两份 Chromium 渲染进程同时运行
* 字体/资源重复加载
* 如果两个窗口共享同一个 user data 路径，可能产生 SQLite 锁冲突

\---

### 1.4 无 GPU 可用性检测（P2）

**现象**  
无论当前环境 GPU 是否可用，一律走 `printToPDF()` 路径。在无 GPU 环境中只能依赖超时兜底，用户体验为"等待 15 秒后报错"。

**根因分析**  
启动时未探测 GPU 状态，缺乏自适应策略。Electron 提供了 `app.getGPUFeatureStatus()` 和 `process.env` 相关指标，但当前代码未使用。

\---

### 1.5 字体等待不够充分（P1）

**现象**  
导出的 PDF 中，部分文字使用 fallback 字体（如宋体替代思源黑体），导致排版与预览不一致。

**根因分析**  
当前等待逻辑：

```typescript
await document.fonts.ready;  // 等待字体 CSSOM 就绪
// + 额外 3s 硬编码超时
```

问题：

* `document.fonts.ready` 在 FontFace 状态变为 `loaded` 时 resolve，但这只表示**字体文件已下载并开始解析**，不表示所有 `@font-face` 声明的字体文件都已完全下载
* 对于本地字体（`src: local(...)`）和网络字体（`src: url(...)`）混合的场景，ready 的时序不可预测
* 3s 硬编码超时在慢网络下不够，在快网络下又浪费等待时间

\---

## 2\. 解决方案矩阵

|方案|描述|优点|缺点|依赖影响|工时估算|
|-|-|-|-|-|-|
|**A. GPU 降级 + Software Rendering**|启动时检测 GPU 状态，无 GPU 时追加 `--disable-gpu` / `--disable-gpu-compositing` 参数，并切换到非 `printToPDF` 的备选管线|从根本上解决 CI/沙箱环境的挂起问题；不引入外部依赖|需要维护两条渲染路径；software rendering 性能较差|零新增依赖|3-4 天|
|**B. Chrome Headless 外部进程**|导出时启动系统/打包的 Chrome headless，通过 `--print-to-pdf` CLI 参数直接生成 PDF|Chrome 原生支持无 GPU 打印；输出质量与 Electron 一致|需要捆绑或下载 Chrome/Chromium 二进制；增加包体积 \~150MB；违反零依赖原则|新增 Chromium 二进制依赖|2-3 天|
|**C. 纯前端 Canvas 方案（jsPDF + html2canvas）**|在前端将 DOM 渲染为 Canvas，再通过 jsPDF 生成 PDF|完全不依赖 Electron 打印管线；CI/沙箱均可运行|输出为位图（文字不可选）；中文排版质量差；不符合"矢量 PDF"要求|新增 jsPDF + html2canvas（\~800KB）|2-3 天|
|**D. 修复 printToPDF 管线 + 自适应策略**|修复竞态条件 + 字体等待 + GPU 检测，在 `printToPDF` 失败时自动降级到方案 A 或 C|最小改动量；保留现有 WYSIWYG 优势；可按环境自适应|仍依赖 `printToPDF` 作为主路径，降级路径需要额外维护|零新增依赖（若降级到方案 C 则需引入）|4-5 天|
|**E. 内置 Chromium 子进程**|利用 Electron 自带的 Chromium 引擎，启动独立子进程（非 BrowserWindow），通过 CDP 协议控制打印|复用 Electron 自带的 Chromium，不额外增加包体积；完全控制打印流程|CDP 协议需要自行封装；实现复杂度较高；调试困难|零新增依赖|5-7 天|

\---

## 3\. 推荐方案

### 3.1 短期方案（M2 v1.0 · 4-5 天）

**核心策略：修复 printToPDF 管线 + GPU 自适应降级**

#### 3.1.1 修复竞态条件（渲染信号优化）

将 `window.\_\_exportReady = true` 的时机从 `useEffect` 推迟到**布局真正完成后**：

```typescript
// src/renderer/App.tsx → ExportView 组件
// 修改前：
useEffect(() => {
  if (resumeId !== null) {
    window.\_\_exportReady = true;
  }
}, \[resumeId]);

// 修改后：
useEffect(() => {
  if (!resumeId) return;

  // 使用双重 rAF + ResizeObserver 确保布局稳定
  const checkLayoutStable = () => {
    const templateEl = document.getElementById('export-template-root');
    if (!templateEl) return;

    let lastHeight = 0;
    let stableCount = 0;
    const observer = new ResizeObserver(() => {
      const currentHeight = templateEl.scrollHeight;
      if (currentHeight === lastHeight) {
        stableCount++;
        if (stableCount >= 3) {
          // 连续 3 次高度不变，认为布局稳定
          observer.disconnect();
          // 额外等待一帧确保 paint 完成
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              window.\_\_exportReady = true;
            });
          });
        }
      } else {
        stableCount = 0;
        lastHeight = currentHeight;
      }
    });

    observer.observe(templateEl);

    // 安全兜底：最多等 5s
    setTimeout(() => {
      observer.disconnect();
      window.\_\_exportReady = true;
    }, 5000);
  };

  // 等待字体加载完成
  document.fonts.ready.then(() => {
    // 再等一帧让字体渲染生效
    requestAnimationFrame(checkLayoutStable);
  });
}, \[resumeId]);
```

#### 3.1.2 字体等待增强

```typescript
// src/renderer/export-fonts.ts（新增工具函数）
export async function waitForAllFonts(maxWaitMs = 10000): Promise<void> {
  const start = Date.now();

  // 1. 先等 document.fonts.ready（CSSOM 就绪）
  await document.fonts.ready;

  // 2. 轮询检查所有 FontFace 的实际加载状态
  while (Date.now() - start < maxWaitMs) {
    const allLoaded = Array.from(document.fonts).every(
      (face) => face.status === 'loaded' || face.status === 'error'
    );
    if (allLoaded) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  // 3. 强制触发一次字体重绘（解决某些字体加载后不立即生效的问题）
  document.body.style.visibility = 'hidden';
  document.body.offsetHeight; // 强制 reflow
  document.body.style.visibility = '';
}
```

#### 3.1.3 GPU 检测 + 自适应策略

```typescript
// src/main/export/gpu-detect.ts（新增）
import { app } from 'electron';

export interface GpuStatus {
  available: boolean;
  status: string; // 'enabled' | 'disabled' | 'hardware\_accelerated' | 'unavailable'
  reason: string;
}

export function detectGpuStatus(): GpuStatus {
  // 方法1：检查 Electron 的 GPU 状态
  const gpuFeatureStatus = app.getGPUFeatureStatus();
  const webglStatus = gpuFeatureStatus?.webgl || gpuFeatureStatus?.\['2d\_canvas'];

  // 方法2：检查环境变量（CI 环境通常设置）
  const isCI = !!process.env.CI || !!process.env.GITHUB\_ACTIONS;
  const isHeadless = !!process.env.DISPLAY === false \&\& process.platform === 'linux';

  // 方法3：检查是否显式禁用了 GPU
  const gpuDisabled = process.argv.includes('--disable-gpu');

  if (gpuDisabled) {
    return { available: false, status: 'disabled', reason: 'GPU explicitly disabled via CLI flag' };
  }

  if (isCI \&\& process.platform === 'linux') {
    return { available: false, status: 'unavailable', reason: 'CI environment on Linux without display' };
  }

  if (webglStatus === 'disabled' || webglStatus === 'unavailable') {
    return { available: false, status: webglStatus, reason: `GPU feature status: ${webglStatus}` };
  }

  return { available: true, status: webglStatus || 'enabled', reason: 'GPU appears available' };
}
```

#### 3.1.4 导出策略自适应

```typescript
// src/main/export/run.ts → 修改导出主流程
import { detectGpuStatus } from './gpu-detect';

async function runExport(params: ExportParams): Promise<ExportResult> {
  const gpuStatus = detectGpuStatus();
  log.info(`\[Export] GPU status: ${gpuStatus.status} - ${gpuStatus.reason}`);

  if (!gpuStatus.available) {
    // 无 GPU 策略：尝试 printToPDF + 短超时，失败则降级
    log.info('\[Export] No GPU detected, using fallback strategy');
    return runExportFallback(params);
  }

  // 有 GPU 策略：正常使用 printToPDF
  return runExportPrimary(params);
}

async function runExportPrimary(params: ExportParams): Promise<ExportResult> {
  // 现有的 printToPDF 流程，但增加合理的超时和重试
  const window = await createExportWindow(params);
  await waitForReact(window, 10000); // 等待渲染就绪，超时 10s

  try {
    // 主路径：printToPDF，给合理超时（30s 而非 15s）
    const pdfBuffer = await Promise.race(\[
      window.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      }),
      timeout(30000),
    ]);

    if (!pdfBuffer) {
      throw new Error('printToPDF timed out');
    }

    await fs.writeFile(params.outputPath, pdfBuffer);
    return { success: true, path: params.outputPath };
  } catch (err) {
    log.warn('\[Export] Primary path failed, trying fallback:', err);
    return runExportFallback(params);
  }
}

async function runExportFallback(params: ExportParams): Promise<ExportResult> {
  // 降级路径：使用 --disable-gpu 重新启动窗口后打印
  // 或者直接提示用户当前环境不支持导出
  log.info('\[Export] Attempting fallback: restart window with --disable-gpu');

  const window = await createExportWindow({
    ...params,
    webPreferences: {
      offscreen: true, // 离屏渲染，绕过 GPU 依赖
    },
  });

  // ... 后续流程同主路径
}
```

#### 3.1.5 统一窗口管理（消除双窗口冲突）

将 `exportWindow` 和 `pdfWindow` 统一为一个共享的窗口管理器：

```typescript
// src/main/export/window-manager.ts（新增）
import { BrowserWindow } from 'electron';

class ExportWindowManager {
  private window: BrowserWindow | null = null;
  private inUse = false;

  async acquire(options?: Electron.BrowserWindowConstructorOptions): Promise<BrowserWindow> {
    if (this.inUse) {
      // 等待当前使用完成，最多等 30s
      await this.waitUntilFree(30000);
    }

    if (this.window \&\& !this.window.isDestroyed()) {
      this.window.close();
    }

    this.window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(\_\_dirname, '../preload/index.js'),
        sandbox: false,
        ...options?.webPreferences,
      },
      ...options,
    });

    this.inUse = true;
    return this.window;
  }

  release(): void {
    this.inUse = false;
    // 不立即销毁，保留给下次使用（减少窗口创建开销）
    // 但设置空闲超时自动销毁
    setTimeout(() => {
      if (!this.inUse \&\& this.window \&\& !this.window.isDestroyed()) {
        this.window.close();
        this.window = null;
      }
    }, 60000); // 60s 空闲后销毁
  }

  private async waitUntilFree(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (this.inUse \&\& Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (this.inUse) {
      throw new Error('Export window still in use after timeout');
    }
  }
}

export const exportWindowManager = new ExportWindowManager();
```

### 3.2 中长期方案（M3 · 架构重构）

#### 3.2.1 引入离屏渲染（Offscreen Rendering）

Electron 支持离屏渲染模式，可以在不创建可见窗口的情况下完成渲染：

```typescript
// M3 方向：使用 offscreen rendering 彻底解耦 GPU 依赖
const win = new BrowserWindow({
  show: false,
  webPreferences: {
    offscreen: true,  // 关键：启用离屏渲染
  },
});

// 离屏渲染的帧通过事件获取
win.webContents.on('paint', (event, dirty, image) => {
  // 可以获取渲染后的图像，但不用于 PDF 生成
  // 离屏模式下 printToPDF 不再依赖 GPU compositor
});
```

#### 3.2.2 探索 CDP (Chrome DevTools Protocol) 直连

绕过 Electron 的 `printToPDF` 封装，直接通过 CDP 发送打印命令：

```typescript
// M3 方向：通过 CDP 协议直接控制打印
const client = await win.webContents.debugger.attach('1.3');
await client.sendCommand('Page.enable');
await client.sendCommand('Page.printToPDF', {
  landscape: false,
  displayHeaderFooter: false,
  printBackground: true,
  preferCSSPageSize: true,
  // CDP 的 printToPDF 在无 GPU 环境下可能表现更好
});
```

#### 3.2.3 纯代码 PDF 生成（备选终极方案）

如果 `printToPDF` 路径始终不稳定，可以考虑基于简历 JSON 数据直接生成 PDF：

* 使用 PDFKit（Node.js，纯 JS 实现）读取简历 JSON
* 手动排版：根据模板的排版规则，用代码绘制文字、线条、色块
* 优点：完全不依赖 Chromium 渲染，零 GPU 依赖，矢量输出
* 缺点：需要重新实现排版引擎，模板与 PDF 不再是"一套代码"

\---

## 4\. 代码修改清单

### 4.1 新增文件

|文件路径|用途|
|-|-|
|`src/main/export/gpu-detect.ts`|GPU 可用性检测工具|
|`src/main/export/window-manager.ts`|统一窗口管理器（替代双单例）|
|`src/renderer/export-fonts.ts`|字体等待增强工具|

### 4.2 修改文件

#### `src/main/export/run.ts`

```typescript
// === 修改 1：引入 GPU 检测和统一窗口管理 ===
import { detectGpuStatus } from './gpu-detect';
import { exportWindowManager } from './window-manager';

// === 修改 2：导出主流程增加自适应策略 ===
// 在 runExport 函数开头增加 GPU 检测
async function runExport(params: ExportParams): Promise<ExportResult> {
  const gpuStatus = detectGpuStatus();
  log.info(`\[Export] GPU: ${gpuStatus.status} | ${gpuStatus.reason}`);

  // 根据 GPU 状态选择策略
  if (!gpuStatus.available) {
    return runExportWithFallback(params, {
      primaryTimeout: 10000,  // 无 GPU 时缩短主路径超时
      enableFallback: true,
    });
  }

  return runExportWithFallback(params, {
    primaryTimeout: 30000,    // 有 GPU 时给足时间
    enableFallback: false,    // 有 GPU 时不需要降级
  });
}

// === 修改 3：waitForReact 增加字体等待 ===
async function waitForReact(window: BrowserWindow, timeoutMs: number): Promise<void> {
  const start = Date.now();

  // 阶段1：等待 \_\_exportReady 信号
  while (Date.now() - start < timeoutMs) {
    const ready = await window.webContents.executeJavaScript(
      'window.\_\_exportReady === true'
    );
    if (ready) break;
    await new Promise((r) => setTimeout(r, 300));
  }

  // 阶段2：等待字体完全加载（通过 executeJavaScript 调用渲染进程的字体等待函数）
  await window.webContents.executeJavaScript(`
    (async () => {
      const fonts = Array.from(document.fonts);
      const start = Date.now();
      while (Date.now() - start < 10000) {
        const allLoaded = fonts.every(f => f.status === 'loaded' || f.status === 'error');
        if (allLoaded) break;
        await new Promise(r => setTimeout(r, 200));
      }
      // 强制 reflow 确保字体生效
      document.body.style.visibility = 'hidden';
      document.body.offsetHeight;
      document.body.style.visibility = '';
    })()
  `);

  // 阶段3：额外等待一帧确保 paint 完成
  await new Promise((r) => setTimeout(r, 100));
}

// === 修改 4：使用统一窗口管理器 ===
// 修改前：
// let exportWindow: BrowserWindow | null = null;
// 修改后：
// 通过 exportWindowManager.acquire() / release() 管理

// === 修改 5：printToPDF 超时调整 ===
// 修改前：Promise.race(\[printPromise, timeout(15000)])
// 修改后：
const pdfBuffer = await Promise.race(\[
  window.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  }),
  timeout(gpuStatus.available ? 30000 : 10000),
]);
```

#### `src/renderer/App.tsx`（ExportView 组件）

```typescript
// === 修改 1：导出就绪信号改为布局稳定检测 ===
// 在 ExportView 组件中：

useEffect(() => {
  if (!resumeId) return;

  let cancelled = false;

  const waitForStableLayout = async () => {
    // 等待字体加载
    await document.fonts.ready;

    // 额外等待字体文件实际下载完成
    const start = Date.now();
    while (Date.now() - start < 10000) {
      const allLoaded = Array.from(document.fonts).every(
        (face) => face.status === 'loaded' || face.status === 'error'
      );
      if (allLoaded) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    if (cancelled) return;

    // 等待布局稳定（ResizeObserver）
    const templateEl = document.getElementById('export-template-root');
    if (!templateEl) {
      window.\_\_exportReady = true;
      return;
    }

    await new Promise<void>((resolve) => {
      let lastHeight = 0;
      let stableCount = 0;

      const observer = new ResizeObserver(() => {
        const h = templateEl.scrollHeight;
        if (h === lastHeight) {
          stableCount++;
          if (stableCount >= 3) {
            observer.disconnect();
            resolve();
          }
        } else {
          stableCount = 0;
          lastHeight = h;
        }
      });

      observer.observe(templateEl);

      // 安全兜底 5s
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 5000);
    });

    if (cancelled) return;

    // 双重 rAF 确保 paint 完成
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) {
          window.\_\_exportReady = true;
        }
      });
    });
  };

  waitForStableLayout();

  return () => { cancelled = true; };
}, \[resumeId]);
```

#### `src/main/print/pdf.ts`

```typescript
// === 修改：使用统一的窗口管理器 ===
// 修改前：
// let pdfWindow: BrowserWindow | null = null;
// function createPdfWindow() { ... }

// 修改后：
import { exportWindowManager } from '../export/window-manager';

async function handlePrintPreview(event: IpcMainInvokeEvent, params: PrintParams) {
  const window = await exportWindowManager.acquire();
  try {
    // ... 打印预览逻辑
    await window.loadURL(getPreviewUrl(params.resumeId));
    // ... 执行打印
  } finally {
    exportWindowManager.release();
  }
}
```

#### `src/main/index.ts`（应用启动）

```typescript
// === 修改：启动时记录 GPU 状态 ===
import { detectGpuStatus } from './export/gpu-detect';

app.whenReady().then(() => {
  const gpuStatus = detectGpuStatus();
  log.info(`\[App] GPU status at startup: ${JSON.stringify(gpuStatus)}`);

  // 如果检测到无 GPU，记录警告
  if (!gpuStatus.available) {
    log.warn(
      '\[App] GPU not available. PDF export will use fallback strategy. ' +
      'If running in CI/sandbox, this is expected.'
    );
  }

  // ... 原有的初始化逻辑
});
```

### 4.3 文件变更汇总

|操作|文件|改动量|风险|
|-|-|-|-|
|新增|`src/main/export/gpu-detect.ts`|\~60 行|低|
|新增|`src/main/export/window-manager.ts`|\~80 行|低|
|新增|`src/renderer/export-fonts.ts`|\~40 行|低|
|修改|`src/main/export/run.ts`|\~50 行变更|中（核心导出流程）|
|修改|`src/renderer/App.tsx`|\~40 行变更|中（影响所有模板导出）|
|修改|`src/main/print/pdf.ts`|\~15 行变更|低|
|修改|`src/main/index.ts`|\~10 行变更|低|

\---

## 5\. 测试验证计划

### 5.1 本机测试（有 GPU 环境）

|测试项|操作|预期结果|
|-|-|-|
|T1: ClassicTemplate 导出|选择 ClassicTemplate → 导出 PDF|PDF 生成成功，内容与预览一致，文字可选|
|T2: ModernTemplate 导出|选择 ModernTemplate → 导出 PDF|PDF 生成成功，多栏布局正确，无截断|
|T3: CompactTemplate 导出|选择 CompactTemplate → 导出 PDF|PDF 生成成功，紧凑排版正确|
|T4: 字体一致性|导出含自定义字体的简历 → 对比预览|PDF 字体与预览一致，无 fallback|
|T5: 连续导出|连续触发 3 次导出|不出现双窗口，内存不泄漏|
|T6: 快速切换|导出过程中切换模板|前一次导出取消/完成，新导出正常|
|T7: 大数据量|10 页简历导出|生成时间 < 30s，PDF 完整|

### 5.2 CI 测试（无 GPU 环境）

|测试项|操作|预期结果|
|-|-|-|
|T8: CI 基本导出|GitHub Actions Linux runner 执行导出|降级策略生效，PDF 生成成功或给出明确错误|
|T9: GPU 检测|CI 环境打印 GPU 状态日志|日志显示 `GPU: unavailable`，不 crash|
|T10: 超时行为|CI 环境触发导出|不会出现永久挂起，超时后正常报错|
|T11: 窗口管理|CI 环境连续触发 export + print|不出现窗口冲突或内存泄漏|

### 5.3 回归测试

|测试项|操作|预期结果|
|-|-|-|
|T12: 预览功能|正常编辑预览流程|不受导出修改影响|
|T13: 打印预览|手动打印预览功能|使用统一窗口管理器后仍正常|
|T14: 窗口恢复|导出后回到编辑界面|隐藏窗口正确清理，不影响主窗口|

### 5.4 测试执行方式

```bash
# 本机测试
pnpm test:export          # 运行导出相关单元测试
pnpm e2e:export           # 运行导出 E2E 测试（Playwright）

# CI 测试（GitHub Actions）
# 在 .github/workflows/test.yml 中新增：
- name: Test PDF Export (no GPU)
  run: pnpm test:export:ci
  env:
    CI: true
    DISPLAY: ':99'  # Xvfb 虚拟显示

# 手动验证（开发者在 CI 机器上）
xvfb-run -a pnpm e2e:export
```

\---

## 6\. 风险与回退方案

### 6.1 风险评估

|风险|概率|影响|缓解措施|
|-|-|-|-|
|`printToPDF` 在某些有 GPU 环境下仍然挂起|中|高|保留 30s 超时 + 降级到 fallback|
|ResizeObserver 方案在某些模板上不生效|低|中|5s 兜底超时确保信号最终置位|
|统一窗口管理器引入新的竞态|中|中|使用 acquire/release + 超时保护|
|字体等待时间过长影响导出速度|低|低|10s 上限 + 并行检测|
|降级策略（offscreen）在某些 Electron 版本不可用|中|高|降级失败时输出明确错误信息而非静默挂起|

### 6.2 回退方案

#### Level 1：单文件回退

如果某个文件的修改引入问题，可以单独回退该文件而不影响其他修改：

* `gpu-detect.ts` 检测失败 → 默认走"有 GPU"路径（保持原有行为）
* `window-manager.ts` 异常 → 回退到双单例模式
* `export-fonts.ts` 超时 → 回退到原有的 `document.fonts.ready` + 3s

#### Level 2：功能回退

如果整个自适应策略引入问题：

* 在 `run.ts` 中增加环境变量开关 `XIAOMENG\_FORCE\_LEGACY\_EXPORT=1`
* 启用后完全跳过 GPU 检测和降级逻辑，走原有 15s 超时路径

#### Level 3：架构回退

如果 M2 方案整体不稳定：

* 保留代码但默认不启用（通过 feature flag 控制）
* 回退到 commit 39165d5 的状态
* 将问题推迟到 M3 用更彻底的方案解决

### 6.3 Feature Flag 设计

```typescript
// src/main/export/flags.ts
export const EXPORT\_FLAGS = {
  // 强制使用旧版导出流程
  forceLegacy: process.env.XIAOMENG\_FORCE\_LEGACY\_EXPORT === '1',
  // 强制禁用 GPU 检测（始终认为有 GPU）
  skipGpuDetect: process.env.XIAOMENG\_SKIP\_GPU\_DETECT === '1',
  // 强制使用降级策略（始终认为无 GPU）
  forceFallback: process.env.XIAOMENG\_FORCE\_FALLBACK === '1',
  // 导出超时时间覆盖（毫秒）
  timeoutOverride: process.env.XIAOMENG\_EXPORT\_TIMEOUT
    ? parseInt(process.env.XIAOMENG\_EXPORT\_TIMEOUT, 10)
    : null,
};
```

\---

## 附录：关键代码位置索引

|模块|文件路径|关键函数/变量|
|-|-|-|
|导出入口|`src/renderer/ExportDialog.tsx`|`handleExport()` → IPC `export:run`|
|导出主流程|`src/main/export/run.ts`|`runExport()` / `waitForReact()`|
|渲染就绪信号|`src/renderer/App.tsx`|ExportView `useEffect` → `window.\_\_exportReady`|
|打印窗口|`src/main/print/pdf.ts`|`pdfWindow` 单例|
|应用启动|`src/main/index.ts`|`app.whenReady()`|

\---

*本文档由架构分析生成，建议在实际修改代码前对照源码确认行号和函数签名。*

\---

> 本内容由 Coze AI 生成，请遵循相关法律法规及《人工智能生成合成内容标识办法》使用与传播。

