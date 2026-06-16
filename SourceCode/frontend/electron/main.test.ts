import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

const {
  mockLoadURL,
  mockBrowserWindow,
  mockBrowserWindowFromWebContents,
  mockAppOn,
  mockAppIsPackaged,
  mockQuit,
  mockSpawn,
  mockDialogShowOpen,
  mockDialogShowSave,
  mockIpcMainHandle,
  mockIpcMainRemoveHandler,
} = vi.hoisted(() => ({
  mockLoadURL: vi.fn(),
  mockBrowserWindow: vi.fn(() => ({
    loadURL: mockLoadURL,
    once: vi.fn((event, cb) => {
      if (event === 'ready-to-show') cb();
    }),
    show: vi.fn(),
    maximize: vi.fn(),
    isMaximized: vi.fn().mockReturnValue(false),
    isFullScreen: vi.fn().mockReturnValue(false),
    setFullScreen: vi.fn(),
    unmaximize: vi.fn(),
  })),
  mockBrowserWindowFromWebContents: vi.fn(),
  mockAppOn: vi.fn(),
  mockAppIsPackaged: vi.fn().mockReturnValue(false),
  mockQuit: vi.fn(),
  mockSpawn: vi.fn(),
  mockDialogShowOpen: vi.fn(),
  mockDialogShowSave: vi.fn(),
  mockIpcMainHandle: vi.fn(),
  mockIpcMainRemoveHandler: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: mockAppIsPackaged(),
    whenReady: vi.fn(() => Promise.resolve()),
    on: mockAppOn,
    quit: mockQuit,
  },
  BrowserWindow: Object.assign(mockBrowserWindow, {
    fromWebContents: mockBrowserWindowFromWebContents,
  }),
  dialog: {
    showOpenDialog: mockDialogShowOpen,
    showSaveDialog: mockDialogShowSave,
  },
  ipcMain: {
    handle: mockIpcMainHandle,
    removeHandler: mockIpcMainRemoveHandler,
  },
}));

vi.mock('node:child_process', () => {
  const mod = { spawn: mockSpawn };
  return {
    default: mod,
    ...mod,
  };
});

vi.mock('node:fs/promises', () => {
  const readFile = vi.fn();
  const writeFile = vi.fn();
  return {
    readFile,
    writeFile,
    default: { readFile, writeFile },
  };
});

process.env.SLD_ELECTRON_TEST = 'true';

const {
  resolveBackendPath,
  startBackend,
  stopBackend,
  createWindow,
  handleOpenAndRead,
  handleSaveAndWrite,
  handleWindowMinimize,
  handleWindowMaximize,
  handleGetWindowState,
  handleWindowClose,
  registerIpcHandlers,
  unregisterIpcHandlers,
} = await import('./main');

const { readFile, writeFile } = await import('node:fs/promises');

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

  it('creates development window with file URL and preload', () => {
    createWindow(9876);
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1);
    expect(mockBrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        frame: false,
        resizable: true,
        show: false,
        webPreferences: expect.objectContaining({
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          preload: expect.stringMatching(/preload\.cjs$/),
        }),
      }),
    );
    expect(mockBrowserWindow.mock.results[0].value.loadURL).toHaveBeenCalledWith(expect.stringContaining('file://'));
    expect(mockBrowserWindow.mock.results[0].value.loadURL).toHaveBeenCalledWith(expect.stringContaining('?port=9876'));
  });

  it('creates packaged window with file URL and preload', () => {
    const window = createWindow(9876);
    expect(window.loadURL).toHaveBeenCalledWith(expect.stringContaining('file://'));
    expect(window.loadURL).toHaveBeenCalledWith(expect.stringContaining('?port=9876'));
  });

  it('creates frameless resizable window with minimum size', () => {
    createWindow(9876);
    expect(mockBrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        frame: false,
        resizable: true,
        minWidth: 900,
        minHeight: 600,
      }),
    );
  });

  it('maximizes window once ready-to-show', () => {
    const window = createWindow(9876);
    expect(window.maximize).toHaveBeenCalled();
    expect(window.show).toHaveBeenCalled();
  });

  it('registers window control IPC handlers', () => {
    registerIpcHandlers();
    expect(mockIpcMainHandle).toHaveBeenCalledWith('window:minimize', handleWindowMinimize);
    expect(mockIpcMainHandle).toHaveBeenCalledWith('window:maximize', handleWindowMaximize);
    expect(mockIpcMainHandle).toHaveBeenCalledWith('window:getState', handleGetWindowState);
    expect(mockIpcMainHandle).toHaveBeenCalledWith('window:close', handleWindowClose);
  });

  it('unregisters window control IPC handlers', () => {
    unregisterIpcHandlers();
    expect(mockIpcMainRemoveHandler).toHaveBeenCalledWith('window:minimize');
    expect(mockIpcMainRemoveHandler).toHaveBeenCalledWith('window:maximize');
    expect(mockIpcMainRemoveHandler).toHaveBeenCalledWith('window:getState');
    expect(mockIpcMainRemoveHandler).toHaveBeenCalledWith('window:close');
  });

  it('minimizes window via IPC handler', () => {
    const mockWin = { minimize: vi.fn() };
    mockBrowserWindowFromWebContents.mockReturnValue(mockWin);
    const fakeEvent = { sender: {} } as unknown as Electron.IpcMainInvokeEvent;
    handleWindowMinimize(fakeEvent);
    expect(mockBrowserWindowFromWebContents).toHaveBeenCalledWith(fakeEvent.sender);
    expect(mockWin.minimize).toHaveBeenCalled();
  });

  it('maximizes window when not maximized', () => {
    const mockWin = {
      isMaximized: vi.fn().mockReturnValue(false),
      isFullScreen: vi.fn().mockReturnValue(false),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
    };
    mockBrowserWindowFromWebContents.mockReturnValue(mockWin);
    const fakeEvent = { sender: {} } as unknown as Electron.IpcMainInvokeEvent;
    const result = handleWindowMaximize(fakeEvent);
    expect(result).toBe(true);
    expect(mockWin.maximize).toHaveBeenCalled();
    expect(mockWin.unmaximize).not.toHaveBeenCalled();
  });

  it('unmaximizes window when already maximized', () => {
    const mockWin = {
      isMaximized: vi.fn().mockReturnValue(true),
      isFullScreen: vi.fn().mockReturnValue(false),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
    };
    mockBrowserWindowFromWebContents.mockReturnValue(mockWin);
    const fakeEvent = { sender: {} } as unknown as Electron.IpcMainInvokeEvent;
    const result = handleWindowMaximize(fakeEvent);
    expect(result).toBe(false);
    expect(mockWin.unmaximize).toHaveBeenCalled();
    expect(mockWin.maximize).not.toHaveBeenCalled();
  });

  it('returns window state via IPC handler', () => {
    const mockWin = {
      isMaximized: vi.fn().mockReturnValue(true),
      isFullScreen: vi.fn().mockReturnValue(false),
    };
    mockBrowserWindowFromWebContents.mockReturnValue(mockWin);
    const fakeEvent = { sender: {} } as unknown as Electron.IpcMainInvokeEvent;
    const result = handleGetWindowState(fakeEvent);
    expect(result).toEqual({ isMaximized: true, isFullScreen: false });
  });

  it('closes window via IPC handler', () => {
    const mockWin = { close: vi.fn() };
    mockBrowserWindowFromWebContents.mockReturnValue(mockWin);
    const fakeEvent = { sender: {} } as unknown as Electron.IpcMainInvokeEvent;
    handleWindowClose(fakeEvent);
    expect(mockWin.close).toHaveBeenCalled();
  });
});

describe('IPC dialog handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleOpenAndRead returns file content when user selects a file', async () => {
    mockDialogShowOpen.mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/file.geojson'],
    });
    vi.mocked(readFile).mockResolvedValue('{"type":"FeatureCollection"}');

    const result = await handleOpenAndRead({} as Electron.IpcMainInvokeEvent, {
      title: 'Open',
      filters: [{ name: 'GeoJSON', extensions: ['geojson'] }],
    });

    expect(mockDialogShowOpen).toHaveBeenCalledWith({
      title: 'Open',
      filters: [{ name: 'GeoJSON', extensions: ['geojson'] }],
    });
    expect(readFile).toHaveBeenCalledWith('/path/to/file.geojson', 'utf-8');
    expect(result).toEqual({ path: '/path/to/file.geojson', content: '{"type":"FeatureCollection"}' });
  });

  it('handleOpenAndRead returns undefined when user cancels', async () => {
    mockDialogShowOpen.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    const result = await handleOpenAndRead({} as Electron.IpcMainInvokeEvent, {
      title: 'Open',
    });

    expect(result).toBeUndefined();
    expect(readFile).not.toHaveBeenCalled();
  });

  it('handleSaveAndWrite writes content and returns file path when user saves', async () => {
    mockDialogShowSave.mockResolvedValue({
      canceled: false,
      filePath: '/path/to/style.sld',
    });

    const result = await handleSaveAndWrite(
      {} as Electron.IpcMainInvokeEvent,
      { title: 'Save', defaultPath: 'style.sld' },
      '<sld/>',
    );

    expect(mockDialogShowSave).toHaveBeenCalledWith({ title: 'Save', defaultPath: 'style.sld' });
    expect(writeFile).toHaveBeenCalledWith('/path/to/style.sld', '<sld/>', 'utf-8');
    expect(result).toBe('/path/to/style.sld');
  });

  it('handleSaveAndWrite returns undefined when user cancels', async () => {
    mockDialogShowSave.mockResolvedValue({
      canceled: true,
      filePath: undefined,
    });

    const result = await handleSaveAndWrite(
      {} as Electron.IpcMainInvokeEvent,
      { title: 'Save' },
      '<sld/>',
    );

    expect(result).toBeUndefined();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('registerIpcHandlers registers dialog channels', () => {
    registerIpcHandlers();
    expect(mockIpcMainHandle).toHaveBeenCalledWith('dialog:openAndRead', handleOpenAndRead);
    expect(mockIpcMainHandle).toHaveBeenCalledWith('dialog:saveAndWrite', handleSaveAndWrite);
  });

  it('unregisterIpcHandlers removes dialog channels', () => {
    unregisterIpcHandlers();
    expect(mockIpcMainRemoveHandler).toHaveBeenCalledWith('dialog:openAndRead');
    expect(mockIpcMainRemoveHandler).toHaveBeenCalledWith('dialog:saveAndWrite');
  });
});
