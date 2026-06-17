import { KnowledgeBase } from './knowledge-base.js';
import type {
  TreeStateSnapshot,
  RuleNode,
  SymbolizerNode,
  NodeType,
} from '@sldagent/core';

export interface RuleContext {
  treeSnapshot: TreeStateSnapshot;
  path: number[];
  ruleNode: RuleNode;
}

export class PromptBuilder {
  static explainRule(context: RuleContext, kb: KnowledgeBase): string {
    const rule = context.ruleNode;
    const lines: string[] = [
      '你是一位 SLD（Styled Layer Descriptor）样式专家。请解释以下 Rule 的含义和作用。',
      '',
      '# 当前 Rule 信息',
      `- 名称: ${rule.data.name}`,
      `- 标题: ${rule.data.title || '(未设置)'}`,
      `- 描述: ${rule.data.abstract || '(未设置)'}`,
      `- 兜底规则(elseFilter): ${rule.data.elseFilter ? '是' : '否'}`,
    ];

    if (rule.data.scaleDenominator.min !== null || rule.data.scaleDenominator.max !== null) {
      lines.push(
        `- 比例尺范围: ${rule.data.scaleDenominator.min ?? '无最小值'} ~ ${rule.data.scaleDenominator.max ?? '无最大值'}`
      );
    }

    if (rule.data.filter) {
      lines.push(`- Filter: ${JSON.stringify(rule.data.filter)}`);
    }

    lines.push('');
    lines.push('# Symbolizers');
    for (const sym of rule.children) {
      const s = sym as SymbolizerNode;
      lines.push(`- ${s.kind}: ${JSON.stringify(s.data)}`);
    }

    lines.push('');
    lines.push(kb.buildFieldDictionaryPrompt());
    lines.push('');
    lines.push(kb.buildSLDReferencePrompt());
    lines.push('');
    lines.push('请用简洁的中文解释这条 Rule 的作用，以及它的 Symbolizer 配置会产生怎样的视觉效果。');

    return lines.join('\n');
  }

  static warnRule(context: RuleContext, kb: KnowledgeBase): string {
    const rule = context.ruleNode;
    const lines: string[] = [
      '你是一位 SLD 样式专家。请检查以下 Rule 是否存在潜在问题或可以优化的地方。',
      '',
      '# 当前 Rule 信息',
      `- 名称: ${rule.data.name}`,
      `- 标题: ${rule.data.title || '(未设置)'}`,
      `- 兜底规则: ${rule.data.elseFilter ? '是' : '否'}`,
      `- Symbolizer 数量: ${rule.children.length}`,
    ];

    if (rule.data.scaleDenominator.min !== null && rule.data.scaleDenominator.max !== null) {
      if (rule.data.scaleDenominator.min >= rule.data.scaleDenominator.max) {
        lines.push('- ⚠️ 比例尺范围无效：最小值 >= 最大值');
      }
    }

    if (rule.children.length === 0) {
      lines.push('- ⚠️ Rule 未包含任何 Symbolizer');
    }

    lines.push('');
    lines.push(kb.buildConstraintsPrompt());
    lines.push('');
    lines.push('请列出可能的问题和改进建议（如有），用中文返回。如果没有问题，请回复"当前规则配置看起来合理"。');

    return lines.join('\n');
  }

  static explainProperty(
    nodeType: NodeType,
    fieldName: string,
    value: unknown,
    kb: KnowledgeBase
  ): string {
    const field = kb.getField(fieldName);
    const lines: string[] = [
      '你是一位 SLD 样式专家。请解释以下属性字段的含义和当前取值的影响。',
      '',
      '# 字段信息',
      `- 节点类型: ${nodeType}`,
      `- 字段 ID: ${fieldName}`,
      `- 当前值: ${JSON.stringify(value)}`,
    ];

    if (field) {
      lines.push(`- 字段标签: ${field.label}`);
      lines.push(`- 字段描述: ${field.description}`);
      lines.push(`- 编辑器类型: ${field.editor}`);
      if (field.options) {
        lines.push(`- 可选值: ${JSON.stringify(field.options)}`);
      }
    }

    lines.push('');
    lines.push('请用中文简要解释该字段的作用，以及当前取值会对样式产生什么影响。');

    return lines.join('\n');
  }

  static explainValidation(
    issue: { code: string; path: number[]; message: string },
    treeSnapshot: TreeStateSnapshot,
    kb: KnowledgeBase
  ): string {
    const lines: string[] = [
      '你是一位 SLD（Styled Layer Descriptor）样式专家。请解释以下校验错误的含义、产生原因以及修复建议。',
      '',
      '# 校验问题信息',
      `- 错误码: ${issue.code}`,
      `- 错误描述: ${issue.message}`,
      `- 节点路径: ${JSON.stringify(issue.path)}`,
      '',
      '# 当前 SLD 树快照',
      JSON.stringify(treeSnapshot.root, null, 2),
      '',
      kb.buildConstraintsPrompt(),
      '',
      '请用中文返回：1) 这个错误是什么意思；2) 为什么会触发；3) 如何修复。保持简洁。',
    ];

    return lines.join('\n');
  }

  static generateStyle(userPrompt: string, dataSchema: Record<string, unknown>, kb: KnowledgeBase): string {
    const lines: string[] = [
      '你是一位 SLD 样式专家。请根据用户的自然语言描述，生成对应的 GeoStyler Style 配置。',
      '',
      '# 用户需求',
      userPrompt,
      '',
      '# 数据模式',
      JSON.stringify(dataSchema, null, 2),
      '',
    ];

    lines.push(kb.buildFieldDictionaryPrompt());
    lines.push('');
    lines.push(kb.buildExamplesPrompt());
    lines.push('');
    lines.push(kb.buildConstraintsPrompt());
    lines.push('');
    lines.push(
      '请生成符合 GeoStyler Style 格式的 JSON 配置。只返回 JSON，不要添加额外解释。'
    );

    return lines.join('\n');
  }
}
