# Proposal: AI 解释面板支持 Markdown 与三栏 2:3:3 布局

> **类型**：Type-C（UI/交互优化）
> **编号**：0006
> **状态**：IMPLEMENTED
> **提出日期**：2026-06-17
> **实现日期**：2026-06-17
> **依赖**：proposal-0005（LLM 最小可行补丁）

---

## 1. 问题描述

1. **AI 解释文本以纯文本展示**：当前 [CodePanel.vue](SourceCode/frontend/src/components/code/CodePanel.vue) 的 AI Tab 直接把 LLM 返回的字符串放进 `div`，不支持 Markdown 格式（如列表、代码块、加粗等），阅读体验较差。
2. **右侧 AI 面板空间不足**：当前布局为左侧树 `flex-1`、中间 `flex-[2]`、右侧 `flex-1`，比例约为 1:2:1。由于 AI 解释、校验、代码都堆叠在右侧面板，右侧空间相对紧张；而左侧树通常不需要过宽。

## 2. 变更目标

- 在 AI 解释 Tab 内使用 Markdown 渲染 LLM 返回的文本，保留对代码块、列表、段落等基本 Markdown 语义的样式支持。
- 将主界面三栏比例从 1:2:1 调整为 2:3:3，让右侧代码/AI 面板与中间属性/预览区域获得同等宽度。

## 3. 变更范围

### [MODIFIED] 前端

- `SourceCode/frontend/package.json`
  - 新增依赖 `markdown-it` 与 `@types/markdown-it`（devDependencies）。

- `SourceCode/frontend/src/App.vue`
  - 三栏布局从 `flex-1 : flex-[2] : flex-1` 改为 `flex-[2] : flex-[3] : flex-[3]`。
  - 同步调整各栏最小/最大宽度约束，使三栏比例自然。

- `SourceCode/frontend/src/components/code/CodePanel.vue`
  - AI Tab 内对 `aiExplanation`、`aiIssueExplanation`、`aiWarnings` 使用 `markdown-it` 渲染为 HTML。
  - 增加 scoped CSS，对渲染后的 `pre > code`、列表、段落、加粗、链接等做暗色主题适配。
  - 保留 XSS 安全：`markdown-it` 默认不启用 HTML 标签输入，LLM 返回的原始 HTML 不会被直接渲染。

## 4. 与 Plan 的对应关系

| Plan | 对应章节 |
| :--- | :--- |
| `plan-frontend.md` | §3 布局规范、§5 AI 面板 |
| `Document/UX/design.md` | 暗色主题、间距系统 |

## 5. 验收标准

- [ ] LLM 返回的 Markdown 文本（如 `# 标题`、`- 列表`、`` `代码` ``、```代码块```）在 AI Tab 中正确渲染。
- [ ] 代码块在暗色主题下可读，有背景色和等宽字体。
- [ ] 主界面三栏视觉比例接近 2:3:3，窗口缩放时不会出现过度挤压。
- [ ] `npm run typecheck` 通过。
- [ ] `npm test` 通过。

## 6. 风险与回退

- **Markdown 渲染差异**：`markdown-it` 是标准实现，基本语法支持良好；若后续需要 GFM 表格/任务列表，可再启用 `markdown-it-github-alerts` 等插件。
- **XSS**：`markdown-it` 默认 `html: false`，且内容由 LLM 产生，风险可控。若未来需要允许 HTML，需额外审查。
- **布局回退**：将 `App.vue` 改回 `flex-1 : flex-[2] : flex-1` 即可恢复。

## 7. 实现备注

- 使用 `markdown-it` 同步渲染：
  ```ts
  import MarkdownIt from 'markdown-it';
  const md = new MarkdownIt();
  const rendered = md.render(text);
  ```
- 渲染结果通过 `v-html` 展示，scoped 样式需要 `:deep()` 才能穿透到动态生成的 HTML。
