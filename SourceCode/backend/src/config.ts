import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_CONFIG: AppConfig = {
  llm: {
    base_url: '',
    auth_key: '',
    model_name: '',
  },
  workspace: {
    default_path: '.',
    allow_parent_access: false,
  },
  api: {
    host: '0.0.0.0',
    port: 8000,
  },
};

export function loadConfig(configPath?: string): AppConfig {
  const path = configPath || resolve(__dirname, '..', '..', 'config', 'config.json');
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return mergeConfig(DEFAULT_CONFIG, parsed);
  } catch {
    return DEFAULT_CONFIG;
  }
}

function mergeConfig(base: AppConfig, override: Partial<AppConfig>): AppConfig {
  return {
    llm: { ...base.llm, ...override.llm },
    workspace: { ...base.workspace, ...override.workspace },
    api: { ...base.api, ...override.api },
  };
}
