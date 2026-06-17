import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface LLMConfig {
  provider: string;
  baseUrl: string;
  model: string;
  apiKeyEnvVar: string;
  maxTokens: number;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface AppConfig {
  llm: LLMConfig;
  server: ServerConfig;
}

const DEFAULT_CONFIG: AppConfig = {
  llm: {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-6',
    apiKeyEnvVar: 'SLDAGENT_LLM_API_KEY',
    maxTokens: 2048,
  },
  server: {
    port: 18765,
    host: '127.0.0.1',
  },
};

function getConfigPath(): string {
  if (process.env.SLDAGENT_CONFIG_PATH) {
    return process.env.SLDAGENT_CONFIG_PATH;
  }

  // Try to find config.json relative to project root
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // When running from dist/, go up to SourceCode/backend then to config/
  const fromDist = resolve(__dirname, '../../config/config.json');
  const fromSrc = resolve(__dirname, '../config/config.json');

  // Try multiple paths
  const candidates = [
    fromDist,
    fromSrc,
    resolve(process.cwd(), 'SourceCode/config/config.json'),
    resolve(process.cwd(), 'config.json'),
  ];

  for (const candidate of candidates) {
    try {
      readFileSync(candidate, 'utf-8');
      return candidate;
    } catch {
      // continue to next candidate
    }
  }

  return fromDist;
}

export function loadConfig(): AppConfig {
  const configPath = getConfigPath();

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;

    const apiKeyEnvVar = parsed.llm?.apiKeyEnvVar ?? DEFAULT_CONFIG.llm.apiKeyEnvVar;

    // 安全检测：apiKeyEnvVar 不应是直接写入的 Key
    if (apiKeyEnvVar?.startsWith('sk-')) {
      console.warn(
        '[Config] 检测到 apiKeyEnvVar 的值疑似为直接写入的 API Key。' +
          '建议将其移出 config.json，通过环境变量注入，以避免意外提交。'
      );
    }

    return {
      llm: {
        provider: parsed.llm?.provider ?? DEFAULT_CONFIG.llm.provider,
        baseUrl: parsed.llm?.baseUrl ?? DEFAULT_CONFIG.llm.baseUrl,
        model: parsed.llm?.model ?? DEFAULT_CONFIG.llm.model,
        apiKeyEnvVar,
        maxTokens: parsed.llm?.maxTokens ?? DEFAULT_CONFIG.llm.maxTokens,
      },
      server: {
        port: parsed.server?.port ?? DEFAULT_CONFIG.server.port,
        host: parsed.server?.host ?? DEFAULT_CONFIG.server.host,
      },
    };
  } catch {
    console.warn(`[Config] Failed to load config from ${configPath}, using defaults`);
    return DEFAULT_CONFIG;
  }
}

/** 读取实际 API Key：优先从环境变量读取；若 apiKeyEnvVar 本身是 Key，则作为降级方案使用 */
export function resolveApiKey(config: AppConfig): string | undefined {
  const apiKeyEnvVar = config.llm.apiKeyEnvVar;

  // 兼容：用户可能把 Key 直接填到 apiKeyEnvVar 字段
  if (apiKeyEnvVar?.startsWith('sk-')) {
    return apiKeyEnvVar;
  }

  const envKey = process.env[apiKeyEnvVar];
  if (envKey && envKey.trim().length > 0) {
    return envKey;
  }

  return undefined;
}
