let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let messageHandlers: Map<string, ((data: unknown) => void)[]> = new Map();
let pendingResponses = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (reason?: Error) => void; timer: ReturnType<typeof setTimeout> }
>();
let messageIdCounter = 0;

const WS_URL = 'ws://127.0.0.1:18765';
const RECONNECT_DELAY = 3000;
const DEFAULT_REQUEST_TIMEOUT = 30000;

export interface WSMessage {
  type: string;
  id?: string;
  payload: unknown;
}

export interface SendResult {
  success: boolean;
  id?: string;
}

export function connectWebSocket(
  onStatusChange?: (connected: boolean) => void
): WebSocket | null {
  if (ws?.readyState === WebSocket.OPEN) return ws;
  if (ws?.readyState === WebSocket.CONNECTING) return ws;

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[WebSocket] connected');
      onStatusChange?.(true);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        // Resolve pending request if matched by type + id
        if (msg.id) {
          const key = `${msg.type}:${msg.id}`;
          const pending = pendingResponses.get(key);
          if (pending) {
            clearTimeout(pending.timer);
            pendingResponses.delete(key);
            pending.resolve(msg.payload);
          }
        }
        // Also notify general subscribers
        const handlers = messageHandlers.get(msg.type) || [];
        handlers.forEach((h) => h(msg.payload));
      } catch (e) {
        console.error('[WebSocket] message parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] disconnected');
      onStatusChange?.(false);
      ws = null;
      // Auto reconnect
      reconnectTimer = setTimeout(() => {
        connectWebSocket(onStatusChange);
      }, RECONNECT_DELAY);
    };

    ws.onerror = (err) => {
      console.error('[WebSocket] error:', err);
      onStatusChange?.(false);
    };

    return ws;
  } catch (e) {
    console.error('[WebSocket] connection failed:', e);
    onStatusChange?.(false);
    return null;
  }
}

export function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}

function generateMessageId(): string {
  return `${Date.now().toString(36)}-${++messageIdCounter}`;
}

export function sendMessage(type: string, payload: unknown): SendResult {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('[WebSocket] not connected, message not sent');
    return { success: false };
  }

  const id = generateMessageId();
  try {
    ws.send(JSON.stringify({ type, id, payload }));
    return { success: true, id };
  } catch (e) {
    console.error('[WebSocket] send error:', e);
    return { success: false };
  }
}

export function request(type: string, payload: unknown, timeout = DEFAULT_REQUEST_TIMEOUT): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const result = sendMessage(type, payload);
    if (!result.success || !result.id) {
      reject(new Error('WebSocket not connected or failed to send'));
      return;
    }

    const key = `${getResponseType(type)}:${result.id}`;
    const timer = setTimeout(() => {
      pendingResponses.delete(key);
      reject(new Error(`Request ${type} timed out after ${timeout}ms`));
    }, timeout);

    pendingResponses.set(key, { resolve, reject, timer });
  });
}

/**
 * Map request type to expected response type.
 */
function getResponseType(type: string): string {
  switch (type) {
    case 'explain_rule':
      return 'rule_explanation';
    case 'explain_property':
      return 'property_explanation';
    case 'explain_validation':
      return 'validation_explanation';
    case 'generate_rules':
      return 'generated_rules';
    default:
      return type;
  }
}

export function onMessage(type: string, handler: (data: unknown) => void): () => void {
  const handlers = messageHandlers.get(type) || [];
  handlers.push(handler);
  messageHandlers.set(type, handlers);

  // Return unsubscribe function
  return () => {
    const current = messageHandlers.get(type) || [];
    messageHandlers.set(
      type,
      current.filter((h) => h !== handler)
    );
  };
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

// Convenience methods for specific message types
export async function explainRule(treeSnapshot: unknown, path: number[]): Promise<unknown> {
  return request('explain_rule', { treeSnapshot, path });
}

export async function explainProperty(
  nodeType: string,
  fieldName: string,
  value: unknown
): Promise<unknown> {
  return request('explain_property', { nodeType, fieldName, value });
}

export async function explainValidation(
  code: string,
  path: number[],
  message: string,
  treeSnapshot: unknown
): Promise<unknown> {
  return request('explain_validation', { code, path, message, treeSnapshot });
}
