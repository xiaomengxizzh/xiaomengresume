# F6 · PDF 导入 + AI 映射（三步核对）— M4

> 本文件由 `scripts/split_docs.py` 从《项目功能.md》拆分（2026-08-08 路由化定案）；真相源 = 本文档。

### F6 · PDF 导入 + AI 映射（三步核对）— M4
- **需求**：导入已有 PDF 简历映射成本地模型，**不准许"盲信 AI"**。
- **实现框架**：`ipcRenderer.invoke('pdf:import', { filePath })` → 主进程 `unpdf.extractText(buffer)` 抽文本 → `generateObject({ schema: ResumeSchema })` 首轮映射 → 渲染进程**三步向导**。双栏/表格/不规则排版时 AI 不可 100% 依赖，向导不可跳过。
- **用户视角**：「文件 → 导入 PDF」→ ① 看 AI 映射预览 → ② 逐段核对/手改（左右对照，**不可跳过**）→ ③ 确认写入，预览刷新。
- **技术细节**：文本型/扫描件分流、B 档纯本地规则、PDF 空阈值见《技术栈.md》三。
