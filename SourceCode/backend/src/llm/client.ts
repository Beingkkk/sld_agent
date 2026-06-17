export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LLMClient {
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
}
