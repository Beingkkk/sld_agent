import type {
  ApplyPatchRequest,
  DataSchema,
  DomainsResult,
  ExportRequest,
  ExportResult,
  GenerateRequest,
  GenerationResult,
  ImportStyleRequest,
  ModifyRequest,
  Style,
  ValidationReport,
} from './types.js';

export interface WsMessage {
  type: string;
  requestId: string;
  payload: unknown;
  timestamp?: number;
}

export interface ErrorPayload {
  requestId: string;
  code: string;
  message: string;
  details?: unknown;
  style?: Style;
  busy?: boolean;
}

export type RequestPayloads = {
  generate: GenerateRequest;
  modify: ModifyRequest;
  apply_patch: ApplyPatchRequest;
  import_style: ImportStyleRequest;
  export: ExportRequest;
  validate: { style?: Style };
  get_domains: Record<string, never>;
  set_domain: { domain: string };
  set_data_schema: { dataSchema: DataSchema };
  ping: Record<string, never>;
};

export type ResponsePayloads = {
  generation_result: GenerationResult;
  export_result: ExportResult;
  validation_result: { style: Style; validation: ValidationReport };
  domains_result: DomainsResult;
  error: ErrorPayload;
  pong: { timestamp: number };
};

export function isWsMessage(value: unknown): value is WsMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as WsMessage).type === 'string' &&
    'requestId' in value &&
    typeof (value as WsMessage).requestId === 'string' &&
    'payload' in value
  );
}
