# Web 端 E2E 测试手册（面向低能力模型的机械化测试流程）

> **用法**：把本文件整体作为任务书交给执行测试的模型（浏览器自动化代理，能打开网页、点击、输入、执行控制台脚本即可）。
> **设计原则**：所有断言 = `粘贴一段脚本 → 输出的某项为 true/false`。你（执行模型）不需要理解被测应用，只需**逐字执行、逐字比对、记录结果**。
> **站点地址**：`http://10.17.217.221:4173/web.html`（下文记作 `<站点>`，如端口/主机不同请全局替换）。

---

## 第 0 章 执行规则（必须先读）

1. 严格按编号顺序执行 T0 → T11。每一步若与预期不符：**记 FAIL，继续下一步**，不要停下来调查，不要重试超过 2 次。
2. 你只能做三种操作：①导航/刷新页面 ②点击/输入（按**可见文本**或占位符定位元素）③在页面控制台执行**手册给出的完整脚本**。禁止自行改写脚本、禁止猜测选择器。
3. 断言的判定方式：脚本执行后，控制台会打印 `PASS ✅ <用例名>` 或 `FAIL ❌ <用例名>`。以它为准，把你看到的每一条输出记录进结果表。
4. 不要报告"已知非缺陷清单"（第 9 章）里的现象为 bug。
5. 手册中所有脚本的条目 id 均为合法 UUID——**不要改动 id 格式**（schema 校验会拒绝非 UUID id，导致加载崩溃）。
6. 全部用例执行完后：执行 T11 的回传脚本，把输出原样复制交回。

## 第 1 章 脚手架与数据准备

### T0 环境自检

1. 打开 `<站点>`，等待页面加载完成（2 秒）。
2. 断言 A：页面应可见文本 `欢迎回来`。
3. 把下面**整段**粘贴进控制台执行（本报告所有用例都依赖它，必须执行一次）：

```js
window.__qa = [];
window.__qaCheck = (name, pass, detail = "") => {
  window.__qa.push({ name, pass: !!pass, detail: String(detail).slice(0, 120) });
  console.log((pass ? "PASS ✅ " : "FAIL ❌ ") + name, detail);
};
window.__qaReport = () => JSON.stringify(window.__qa, null, 1);
__qaCheck("T0 页面加载", document.body.innerText.includes("欢迎回来"), document.title);
```

### T1 测试数据种子（写入一份固定简历）

1. 执行下面整段脚本（会清空本浏览器内已有简历数据——这是预期的）：

```js
localStorage.clear();
const doc = (t) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });
const resume = {
  schemaVersion: 1,
  title: "QA测试简历",
  basics: { name: "测试员", headline: "测试工程师", email: "qa@test.dev", phone: "10987654321", location: "北京市" },
  summary: { content: doc("这是一段自我评价。") },
  education: [{ id: "10000000-0000-4000-8000-000000000001", school: "测试大学", degree: "本科", major: "软件工程", startDate: "2020-09", endDate: "2024-06", visible: true }],
  work: [{ id: "10000000-0000-4000-8000-000000000002", title: "测试岗位", company: "测试公司", startDate: "2021-07", endDate: "2024-12", summary: doc("负责测试用例。"), visible: true }],
  projects: [], skills: [{ id: "10000000-0000-4000-8000-000000000003", name: "测试技能", visible: true }], certificates: [], languages: [], boundJobIds: [],
  layout: { templateId: "classic" }
};
localStorage.setItem("xmweb.v1.resume.qa0001", JSON.stringify({ resume, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
location.reload();
```

2. 等待 2 秒，进入 `欢迎回来` 页面。
3. 断言：点击 `打开简历` → 页面出现卡片文本 `QA测试简历` → 点击该卡片。
4. 断言：出现文本 `测试员`（预览区）与输入框中的 `测试岗位`、`测试公司`。记入结果。

## 第 2 章 排版功能用例

> 本章通用入口：编辑器顶部找到按钮 `▸ 排版`（或 `排版`），点击展开**排版条**；以下脚本在排版条展开后的页面执行。

### T2 副标题位置——inline-start（紧随主标题）

1. 在排版条中找到标题含 `副标题位置` 的下拉框（title 属性含"副标题"），选择 `紧随主标题`。
2. 执行断言脚本：

```js
const el = [...document.querySelectorAll(".preview-paper *")].find(n => n.children.length === 0 && n.textContent === "测试公司");
const st = el ? (el.getAttribute("style") || "") : "";
__qaCheck("T2 inline-start", st.includes("margin-right: auto") && (el.parentElement.getAttribute("style") || "").includes("space-between"), st.slice(0, 60));
```

### T3 副标题位置——inline-center

1. 同一下拉框选择 `居中于日期前`。
2. 断言脚本：

```js
const el = [...document.querySelectorAll(".preview-paper *")].find(n => n.children.length === 0 && n.textContent === "测试公司");
const st = el ? (el.getAttribute("style") || "") : "";
__qaCheck("T3 inline-center", st.includes("text-align: center"), st.slice(0, 60));
```

### T4 副标题位置——below（默认行）

1. 同一下拉框选择 `主标题下方`。
2. 断言脚本（期望 `pass: true`）：

```js
const el = [...document.querySelectorAll(".preview-paper *")].find(n => n.children.length === 0 && n.textContent === "测试公司");
const st = el ? (el.getAttribute("style") || "") : "";
__qaCheck("T4 below", st.includes("opacity: 0.8") && !st.includes("margin-right") && !st.includes("text-align"), st.slice(0, 60));
```

### T5 副标题独立字号（subheaderSize）

1. 执行脚本设置字号并刷新（模拟滑杆拖动的确定版）：

```js
const k = "xmweb.v1.resume.qa0001"; const rec = JSON.parse(localStorage.getItem(k));
rec.resume.layout.subheaderSize = 12; localStorage.setItem(k, JSON.stringify(rec)); location.reload();
```

2. 等 2 秒；若回到 `欢迎回来`，重新点 `打开简历` → `QA测试简历` 卡片进入编辑器。
3. 断言脚本：

```js
const el = [...document.querySelectorAll(".preview-paper *")].find(n => n.children.length === 0 && n.textContent === "测试公司");
const st = el ? (el.getAttribute("style") || "") : "";
__qaCheck("T5 subheaderSize", st.includes("font-size: 12px"), st.slice(0, 60));
```

### T6 图标显隐（useIconMode）

1. 执行脚本（关闭图标 + 刷新）：

```js
const k = "xmweb.v1.resume.qa0001"; const rec = JSON.parse(localStorage.getItem(k));
rec.resume.layout.useIconMode = false; localStorage.setItem(k, JSON.stringify(rec)); location.reload();
```

2. 等 2 秒重新进入编辑器（同 T5 第 2 步）。
3. 断言脚本（联系方式"邮箱行"里不应再有图标 svg）：

```js
const leaf = [...document.querySelectorAll(".preview-paper *")].find(n => n.children.length === 0 && n.textContent === "qa@test.dev");
const row = leaf ? leaf.closest("div") : null;
__qaCheck("T6 useIconMode", !!row && row.querySelectorAll("svg").length === 0, row ? row.innerHTML.length : "row missing");
```

### T7 页边距水平拆分（pageMarginX）

1. 执行脚本：

```js
const k = "xmweb.v1.resume.qa0001"; const rec = JSON.parse(localStorage.getItem(k));
rec.resume.layout.pageMarginX = 56; localStorage.setItem(k, JSON.stringify(rec)); location.reload();
```

2. 重新进入编辑器后断言：

```js
const paper = document.querySelector(".preview-paper");
let n = paper, pad = "";
while (n) { const s = n.getAttribute("style") || ""; const m = s.match(/padding: [^;]+/); if (m) { pad = m[0]; break; } n = n.parentElement; }
__qaCheck("T7 pageMarginX", pad.includes("56px"), pad);
```

### T8 节排版——改名/两栏/不跨页

1. 点击排版条中的按钮 `节排版`（出现浮动面板）。
2. 面板中下拉框选择 `教育经历`；在占位符/值为 `教育经历` 的文本输入框中输入 `我的求学路`。
3. 勾选面板中的 `两栏排版`（此项作用于下拉框当前选中的节；**先把下拉框切到 `专业技能` 再勾选两栏**，教育节不勾两栏）。
4. 下拉框选回 `教育经历`，勾选 `整节不跨页`。
5. 断言脚本：

```js
const paper = document.querySelector(".preview-paper");
const edu = paper.querySelector('section[data-rm-path="education"]');
const text = paper.innerText;
__qaCheck("T8a 节改名", text.includes("我的求学路") && !text.includes("教育经历"), "");
__qaCheck("T8b keepTogether", (edu.getAttribute("style") || "").includes("break-inside"), edu.getAttribute("style") || "");
const cols = [...paper.querySelectorAll('div[style*="column-count: 2"]')].length;
__qaCheck("T8c 两栏", cols > 0, String(cols));
```

### T9 持久化（刷新后设置仍生效）

1. 刷新页面（F5），重新进入 `QA测试简历` 编辑器。
2. 断言脚本（三项都应为 true）：

```js
const rec = JSON.parse(localStorage.getItem("xmweb.v1.resume.qa0001")).resume.layout;
__qaCheck("T9a 排版字段持久", rec.subheaderSize === 12 && rec.useIconMode === false && rec.pageMarginX === 56, JSON.stringify(rec).slice(0, 80));
const paper = document.querySelector(".preview-paper");
__qaCheck("T9b 节改名持久", (paper.innerText || "").includes("我的求学路"), "");
__qaCheck("T9c 编辑器完好", !!paper && paper.innerText.includes("测试员"), "");
```

### T10 导出冒烟（半自动，观察即可）

1. 点击顶栏按钮 `导出` → 弹出对话框。
2. 选择 JSON 格式项（文本含 `JSON`），点击对话框中的确认/导出按钮。
3. 断言（人工级）：浏览器出现文件下载（或对话框正常关闭且**没有**出现"失败/错误"字样）。记录 `PASS`（下载出现或无报错）/ `FAIL`（有报错文字）。
4. 再点 `导出` → 选择 `PDF` 类格式项 → 确认：应弹出一个新窗口/标签，其地址含 `export=1`，且窗口内可见 `测试员`。此窗口**不要关闭**（它可能被浏��器打印对话框占用，属预期，见第 9 章第 4 条）。

### T11 回传结果

```js
__qaReport()
```

把输出的 JSON 原样交回。另附：最终页面 URL、是否每一步都进入了编辑器。

## 第 9 章 已知非缺陷清单（禁止报为 bug）

1. 左侧导航与部分按钮对**自动化点击**偶发不响应：改用"控制台 `document.querySelector(...).click()`"方式重试一次即可；仍失败记 `BLOCKED`（不是 FAIL）。
2. `AI 设置 / 语法纠正 / 简历润色 / 匹配打分 / 自我介绍` 在 web 端提示未配置/不可用 = **设计如此**（桌面端功能）。
3. 导出 PDF 打开的是**浏览器打印窗口**（弹打印对话框或需手动 Ctrl+P），不会直接下载 .pdf = 设计如此。
4. 存储位置/字体导入/备份导出等按钮在 web 端为占位或只读 = 设计如此。
5. 页面右上角托盘工具显示 4173 为"未知服务" = 正常（它不认识开发服务器进程）。
6. 若 `打开简历` 列表没有卡片：先执行 T1 种子脚本再试。

## 第 10 章 失败时收集清单（FAIL 才做，一次性）

```js
JSON.stringify({
  url: location.href,
  hasPaper: !!document.querySelector(".preview-paper"),
  storageKeys: Object.keys(localStorage).filter(k => k.startsWith("xmweb")),
  layout: (JSON.parse(localStorage.getItem("xmweb.v1.resume.qa0001") || "{}").resume || {}).layout,
  qa: window.__qa
})
```

把输出、用例编号、页面上可见的错误文字（若有）一起交回。
