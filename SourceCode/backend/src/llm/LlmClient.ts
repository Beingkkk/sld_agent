import Anthropic from '@anthropic-ai/sdk';
import type { ILlmClient, LlmClientOptions } from './types.js';

export class LlmClient implements ILlmClient {
  private client: Anthropic;
  private model: string;
  private defaultTimeoutMs: number;
  private maxTimeoutMs: number;

  constructor(options: LlmClientOptions) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
      baseURL: options.baseUrl || undefined,
    });
    this.model = options.model;
    this.defaultTimeoutMs = options.defaultTimeoutMs || 30000;
    this.maxTimeoutMs = options.maxTimeoutMs || 120000;
  }

  async complete(prompt: string, options?: { timeoutMs?: number }): Promise<string> {
    const timeoutMs = Math.min(options?.timeoutMs ?? this.defaultTimeoutMs, this.maxTimeoutMs);
    const response = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: 2048,
        system: 'You are a GIS styling assistant. Output only JSON.',
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: timeoutMs }
    );

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected LLM response type');
    }
    return content.text;
  }
}
