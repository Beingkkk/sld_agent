# Proposal 0002：在 Constitution 中增加项目文档语言规范

## 状态

- 提案：2026-06-15
- 范围：`Document/constitution.md`
- 状态：已实施

## 摘要

在 `Document/constitution.md` 中新增红色条款 C-09，明确项目文档使用中文，使协作输出与文档风格保持一致。

## 动机

- 项目核心团队使用中文协作，设计文档、提案与代码注释均以中文为主。
- 现有文档（`constitution.md`、`spec.md`、各 `plan-*.md`）已采用中文编写。
- 将语言规范上升到 Constitution 层面，可避免未来文档语言不一致，并为助手/协作者的输出语言提供依据。

## 变更内容

在 `Document/constitution.md` 的红色条款表中新增：

| 编号 | 约束 |
|---|---|
| C-09 | 项目文档与协作输出使用**中文**；技术术语、代码、文件路径与外部引用保持原样。 |

## 修改文件

- `Document/constitution.md`（编辑）
- `Document/changes/proposal-0002.md`（本文件）

## 验证

- `Document/constitution.md` 结构完整，新增条款编号连续。
- 与现有 C-01 ~ C-08 无冲突。

## 风险

- 无技术风险；本变更仅涉及文档语言规范。
- 未来引入英文外部贡献者时，可通过新提案调整或补充双语说明。
