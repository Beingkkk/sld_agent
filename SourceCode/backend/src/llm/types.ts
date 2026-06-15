export interface LlmClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  defaultTimeoutMs?: number;
  maxTimeoutMs?: number;
}

export interface ILlmClient {
  complete(prompt: string, options?: { timeoutMs?: number }): Promise<string>;
}
