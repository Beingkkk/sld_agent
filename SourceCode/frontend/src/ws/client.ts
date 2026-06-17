let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let messageHandlers: Map<string, ((data: unknown) => void)[]> = new Map();

const WS_URL = 'ws://127.0.0.1:18765';
const RECONNECT_DELAY = 3000;

export interface WSMessage {
  type: string;
  payload: unknown;
}

export function connectWebSocket(
  onStatusChange?: (connected: boolean) => void
): WebSocket | null {
  if (ws?.readyState === WebSocket.OPEN) return ws;
  if (ws?.readyState === WebSocket.CONNECTING) return ws;

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      onStatusChange?.(true);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        const handlers = messageHandlers.get(msg.type) || [];
        handlers.forEach((h) => h(msg.payload));
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      onStatusChange?.(false);
      ws = null;
      // Auto reconnect
      reconnectTimer = setTimeout(() => {
        connectWebSocket(onStatusChange);
      }, RECONNECT_DELAY);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      onStatusChange?.(false);
    };

    return ws;
  } catch (e) {
    console.error('WebSocket connection failed:', e);
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

export function sendMessage(type: string, payload: unknown): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('WebSocket not connected, message not sent');
    return false;
  }

  try {
    ws.send(JSON.stringify({ type, payload }));
    return true;
  } catch (e) {
    console.error('WebSocket send error:', e);
    return false;
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
export function explainRule(treeSnapshot: unknown, path: number[]): boolean {
  return sendMessage('explain_rule', { treeSnapshot, path });
}

export function explainProperty(
  nodeType: string,
  fieldName: string,
  value: unknown
): boolean {
  return sendMessage('explain_property', { nodeType, fieldName, value });
}
