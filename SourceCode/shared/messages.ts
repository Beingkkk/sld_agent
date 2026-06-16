import type {
  ApplyPatchRequest,
  DataSchema,
  DomainsResult,
  ErrorCode,
  ExportRequest,
  ExportResult,
  GenerateRequest,
  GenerationResult,
  ImportStyleRequest,
  ModifyRequest,
  SampleDatasetData,
  SampleDatasetInfo,
  Style,
  ValidationError,
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
  code: ErrorCode;
  message: string;
  details?: ValidationError[];
  style?: Style;
  busy?: boolean;
}

export interface OkPayload {
  ok: true;
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
  list_sample_datasets: Record<string, never>;
  get_sample_dataset: { id: string };
  ping: Record<string, never>;
};

export type ResponsePayloads = {
  generation_result: GenerationResult;
  export_result: ExportResult;
  validation_result: { style: Style; validation: ValidationReport };
  domains_result: DomainsResult;
  sample_datasets_list: { datasets: SampleDatasetInfo[] };
  sample_dataset_data: SampleDatasetData;
  ok: OkPayload;
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
