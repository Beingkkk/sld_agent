import type { LLMClient, CompletionOptions } from './client.js';

export class MockLLMClient implements LLMClient {
  async complete(prompt: string, _options?: CompletionOptions): Promise<string> {
    // Simple heuristic to generate contextual mock responses
    const lower = prompt.toLowerCase();

    if (lower.includes('rule') && lower.includes('explain')) {
      return '这是一条 SLD 规则（Rule），它定义了在特定条件下如何渲染地理要素。当前规则包含 Symbolizer 配置，用于控制点、线或面的视觉样式。';
    }

    if (lower.includes('property') || lower.includes('field')) {
      return '该属性字段用于控制样式的具体视觉参数。修改此值将直接影响地图渲染效果。';
    }

    if (lower.includes('generate') || lower.includes('style')) {
      return '基于提供的数据模式和属性信息，可以生成相应的分类或分级样式规则。';
    }

    if (lower.includes('warn') || lower.includes('warning')) {
      return '当前规则配置存在潜在问题：建议检查比例尺范围是否合理，以及是否包含至少一个 Symbolizer。';
    }

    return 'SLDAgent 后端已收到请求。当前运行在未配置 LLM API Key 的降级模式（MockLLMClient），返回模拟响应。请配置环境变量以启用真实 LLM 调用。';
  }
}
