import type {
  ApplyPatchRequest,
  ChatMessage,
  DataSchema,
  DomainsResult,
  ExportRequest,
  ExportResult,
  GenerateRequest,
  GenerationResult,
  ImportStyleRequest,
  ModifyRequest,
  Style,
  StyleParams,
  ValidationReport,
} from '../shared/types.js';
import type { PromptBuilder } from '../knowledge/PromptBuilder.js';

export interface SessionState {
  id: string;
  activeDomain: string;
  dataSchema?: DataSchema;
  currentStyle?: Style;
  lastValidStyle?: Style;
  lastValidSldXml?: string;
  chatHistory: ChatMessage[];
  params?: StyleParams;
}

export interface AgentSessionOptions {
  id: string;
  knowledgeBase: unknown;
  promptBuilder: PromptBuilder;
  sldService: unknown;
  llmClient: unknown;
}

export interface IAgentSession {
  generate(request: GenerateRequest): Promise<GenerationResult>;
  modify(request: ModifyRequest): Promise<GenerationResult>;
  applyPatch(request: ApplyPatchRequest): Promise<GenerationResult>;
  importStyle(request: ImportStyleRequest): Promise<GenerationResult>;
  export(request: ExportRequest): Promise<ExportResult>;
  validate(style?: Style): Promise<ValidationReport>;
  getDomains(): DomainsResult;
  setDomain(domain: string): Promise<void>;
  setDataSchema(schema: DataSchema): void;
  getState(): SessionState;
}
