import type { KnowledgeBase } from './knowledge/types.js';

export interface WsServerOptions {
  port: number | 0;
  knowledgeDir: string;
  configPath?: string;
  xsdPath?: string;
  xmllintPath?: string;
  skipXsd?: boolean;
  wasmSchemaBundleDir?: string;
  staticSchemaDir?: string;
  useWasm?: boolean;
  llmClient?: { complete(prompt: string): Promise<string> };
  knowledgeBase?: KnowledgeBase;
}

export interface AppConfig {
  llm: {
    base_url: string;
    auth_key: string;
    model_name: string;
  };
  workspace: {
    default_path: string;
    allow_parent_access: boolean;
  };
  api: {
    host: string;
    port: number;
  };
}
