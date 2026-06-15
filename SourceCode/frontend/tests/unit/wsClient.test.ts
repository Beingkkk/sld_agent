import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWsClient, type WsClientError } from '../../src/services/wsClient';

describe('WsClient', () => {
  let wsMock: WebSocket;

  beforeEach(() => {
    wsMock = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: WebSocket.OPEN,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    } as unknown as WebSocket;
    const MockWebSocket = vi.fn(() => wsMock) as unknown as typeof WebSocket;
    MockWebSocket.OPEN = 1;
    MockWebSocket.CONNECTING = 0;
    MockWebSocket.CLOSING = 2;
    MockWebSocket.CLOSED = 3;
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.stubGlobal('crypto', { randomUUID: () => 'req-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connects successfully', async () => {
    const client = createWsClient({ url: 'ws://localhost:8000' });
    const promise = client.connect();
    wsMock.onopen?.({} as Event);
    await expect(promise).resolves.toBeUndefined();
  });

  it('sends a message and resolves response', async () => {
    const client = createWsClient({ url: 'ws://localhost:8000' });
    const connectPromise = client.connect();
    wsMock.onopen?.({} as Event);
    await connectPromise;

    const promise = client.generate({ instruction: 'red point', geometryType: 'point' });
    wsMock.onmessage?.({ data: JSON.stringify({ type: 'generation_result', requestId: 'req-1', payload: { style: {} } }) } as MessageEvent);
    await expect(promise).resolves.toEqual({ style: {} });
  });

  it('rejects on error response with code and details', async () => {
    const client = createWsClient({ url: 'ws://localhost:8000' });
    const connectPromise = client.connect();
    wsMock.onopen?.({} as Event);
    await connectPromise;

    const promise = client.generate({ instruction: 'x', geometryType: 'point' });
    wsMock.onmessage?.({
      data: JSON.stringify({
        type: 'error',
        requestId: 'req-1',
        payload: { requestId: 'req-1', code: 'INVALID_REQUEST', message: 'bad', busy: true },
      }),
    } as MessageEvent);

    await expect(promise).rejects.toThrow('bad');
    try {
      await promise;
    } catch (err) {
      const e = err as WsClientError;
      expect(e.code).toBe('INVALID_REQUEST');
      expect(e.busy).toBe(true);
    }
  });
});
