import type { LLMClient, CompletionOptions } from './client.js';

export interface AnthropicClientConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens: number;
}

export class AnthropicClient implements LLMClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: AnthropicClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.anthropic.com/v1';
    this.model = config.model;
    this.maxTokens = config.maxTokens;
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    // 兼容 Anthropic 原生（baseUrl 已含 /v1）与 MiniMax 兼容端点（baseUrl 不含 /v1）
    const normalizedBaseUrl = this.baseUrl.endsWith('/v1')
      ? this.baseUrl
      : `${this.baseUrl}/v1`;
    const url = `${normalizedBaseUrl}/messages`;
    const maxTokens = options?.maxTokens ?? this.maxTokens;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const text = data.content?.[0]?.text ?? '';
    return text;
  }
}
