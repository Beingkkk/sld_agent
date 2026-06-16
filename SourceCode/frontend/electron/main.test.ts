import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

const {
  mockLoadURL,
  mockBrowserWindow,
  mockAppOn,
  mockAppIsPackaged,
  mockQuit,
  mockSpawn,
} = vi.hoisted(() => ({
  mockLoadURL: vi.fn(),
  mockBrowserWindow: vi.fn(() => ({
    loadURL: vi.fn(),
  })),
  mockAppOn: vi.fn(),
  mockAppIsPackaged: vi.fn().mockReturnValue(false),
  mockQuit: vi.fn(),
  mockSpawn: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: mockAppIsPackaged(),
    whenReady: vi.fn(() => Promise.resolve()),
    on: mockAppOn,
    quit: mockQuit,
  },
  BrowserWindow: mockBrowserWindow,
}));

vi.mock('node:child_process', () => {
  const mod = { spawn: mockSpawn };
  return {
    default: mod,
    ...mod,
  };
});

process.env.SLD_ELECTRON_TEST = 'true';

const {
  resolveBackendPath,
  startBackend,
  stopBackend,
  createWindow,
} = await import('./main');

function createMockChildProcess(): ChildProcess {
  const stdout = new EventEmitter();
  const process = {
    stdout,
    stderr: null,
    stdin: null,
    on: vi.fn(),
    off: vi.fn(),
    killed: false,
    kill: vi.fn(),
  } as unknown as ChildProcess;
  return process;
}

describe('Electron main process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('resolves backend path for development mode', () => {
    const path = resolveBackendPath(false);
    expect(path).toMatch(/backend[\\/]dist[\\/]index\.js/);
  });

  it('resolves backend path for packaged mode', () => {
    vi.stubGlobal('process', { ...process, resourcesPath: '/mock/resources' });
    const path = resolveBackendPath(true);
    expect(path).toMatch(/mock[\\/]resources[\\/]backend[\\/]dist[\\/]index\.js/);
    vi.unstubAllGlobals();
  });

  it('starts backend and resolves port from READY line', async () => {
    const backend = createMockChildProcess();
    mockSpawn.mockReturnValue(backend);

    const promise = startBackend('/backend/dist/index.js');
    (backend.stdout as EventEmitter).emit('data', Buffer.from('READY ws://localhost:9876\n'));

    const result = await promise;
    expect(result.port).toBe(9876);
    expect(result.process).toBe(backend);
  });

  it('rejects when backend does not emit READY within timeout', async () => {
    vi.useFakeTimers();
    const backend = createMockChildProcess();
    mockSpawn.mockReturnValue(backend);

    const promise = startBackend('/backend/dist/index.js');

    vi.advanceTimersByTime(10001);

    await expect(promise).rejects.toThrow('Backend start timeout');
  });

  it('stops backend with SIGTERM', () => {
    const backend = createMockChildProcess();
    stopBackend(backend);
    expect(backend.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('does not kill already killed backend', () => {
    const backend = createMockChildProcess();
    Object.defineProperty(backend, 'killed', { value: true });
    stopBackend(backend);
    expect(backend.kill).not.toHaveBeenCalled();
  });

  it('creates development window with localhost URL', () => {
    createWindow(9876, false);
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1);
    expect(mockBrowserWindow.mock.results[0].value.loadURL).toHaveBeenCalledWith('http://localhost:5173/?port=9876');
  });

  it('creates packaged window with file URL', () => {
    const window = createWindow(9876, true);
    expect(window.loadURL).toHaveBeenCalledWith(expect.stringContaining('file://'));
    expect(window.loadURL).toHaveBeenCalledWith(expect.stringContaining('?port=9876'));
  });
});
