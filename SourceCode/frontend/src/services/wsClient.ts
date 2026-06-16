import type { WsMessage, ErrorPayload } from '@shared/messages';

export interface WsClientOptions {
  url: string;
  onMessage?: (msg: WsMessage) => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
}

export interface WsClientError extends Error {
  code: string;
  details?: unknown;
  style?: unknown;
  busy?: boolean;
}

export interface WsClient {
  connect(): Promise<void>;
  disconnect(): void;
  send<T = unknown>(type: string, payload: unknown, timeoutMs?: number): Promise<T>;
  // Typed convenience helpers
  generate(payload: { instruction: string; geometryType: string; domain?: string; dataSchema?: unknown }): Promise<unknown>;
  modify(payload: { instruction: string; preserve?: string[] }): Promise<unknown>;
  applyPatch(payload: { patches: unknown[] }): Promise<unknown>;
  importStyle(payload: { style: unknown; sourceName?: string }): Promise<unknown>;
  exportStyle(payload?: { style?: unknown; options?: unknown }): Promise<unknown>;
  validate(payload?: { style?: unknown }): Promise<unknown>;
  getDomains(): Promise<unknown>;
  setDomain(domain: string): Promise<unknown>;
  setDataSchema(dataSchema: unknown): Promise<unknown>;
  listSampleDatasets(): Promise<unknown>;
  getSampleDataset(id: string): Promise<unknown>;
  ping(): Promise<unknown>;
}

export function createWsClient(options: WsClientOptions): WsClient {
  let ws: WebSocket | null = null;
  const pending = new Map<string, { resolve: (value: unknown) => void; reject: (err: Error) => void; timer: number }>();

  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(options.url);
      const timer = window.setTimeout(() => reject(new Error('WebSocket connect timeout')), 5000);

      ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };

      ws.onerror = (err) => {
        clearTimeout(timer);
        reject(new Error(`WebSocket error: ${err.type}`));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as WsMessage;
        const id = msg.requestId;
        const req = pending.get(id);
        if (req) {
          window.clearTimeout(req.timer);
          pending.delete(id);
          if (msg.type === 'error') {
            const payload = msg.payload as ErrorPayload;
            const error = new Error(payload.message) as WsClientError;
            error.code = payload.code;
            error.details = payload.details;
            error.style = payload.style;
            error.busy = payload.busy;
            req.reject(error);
          } else {
            req.resolve(msg.payload);
          }
        }
        options.onMessage?.(msg);
      };

      ws.onclose = () => {
        options.onClose?.();
      };
    });
  }

  function disconnect(): void {
    ws?.close();
    ws = null;
  }

  function send<T = unknown>(type: string, payload: unknown, timeoutMs = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      const id = crypto.randomUUID();
      const timer = window.setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Request ${type} timeout`));
      }, timeoutMs);
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      ws.send(JSON.stringify({ type, requestId: id, payload }));
    });
  }

  function generate(payload: Parameters<WsClient['generate']>[0]) {
    return send('generate', payload);
  }
  function modify(payload: Parameters<WsClient['modify']>[0]) {
    return send('modify', payload);
  }
  function applyPatch(payload: Parameters<WsClient['applyPatch']>[0]) {
    return send('apply_patch', payload);
  }
  function importStyle(payload: Parameters<WsClient['importStyle']>[0]) {
    return send('import_style', payload);
  }
  function exportStyle(payload?: Parameters<WsClient['exportStyle']>[0]) {
    return send('export', payload ?? {});
  }
  function validate(payload?: Parameters<WsClient['validate']>[0]) {
    return send('validate', payload ?? {});
  }
  function getDomains() {
    return send('get_domains', {});
  }
  function setDomain(domain: string) {
    return send('set_domain', { domain });
  }
  function setDataSchema(dataSchema: unknown) {
    return send('set_data_schema', { dataSchema });
  }
  function listSampleDatasets() {
    return send('list_sample_datasets', {});
  }
  function getSampleDataset(id: string) {
    return send('get_sample_dataset', { id });
  }
  function ping() {
    return send('ping', {});
  }

  return {
    connect,
    disconnect,
    send,
    generate,
    modify,
    applyPatch,
    importStyle,
    exportStyle,
    validate,
    getDomains,
    setDomain,
    setDataSchema,
    listSampleDatasets,
    getSampleDataset,
    ping,
  };
}
