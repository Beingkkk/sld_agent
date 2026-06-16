import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function resolveBackendPath(isPackaged: boolean): string {
  if (isPackaged) {
    return resolve(process.resourcesPath, 'backend', 'dist', 'index.js');
  }
  return resolve(__dirname, '../../backend/dist/index.js');
}

export async function startBackend(backendPath: string): Promise<{ port: number; process: ChildProcess }> {
  const nodePath = process.execPath.endsWith('node') || process.execPath.endsWith('node.exe')
    ? process.execPath
    : 'node';
  const backend = spawn(nodePath, [backendPath], {
    env: { ...process.env, SLD_PORT: '0' },
  });

  return new Promise((resolvePromise, reject) => {
    const onError = (err: Error) => reject(err);
    backend.on('error', onError);

    const onData = (data: Buffer) => {
      const line = data.toString();
      const match = line.match(/READY ws:\/\/localhost:(\d+)/);
      if (match) {
        backend.stdout?.off('data', onData);
        backend.off('error', onError);
        resolvePromise({ port: parseInt(match[1], 10), process: backend });
      }
    };

    backend.stdout?.on('data', onData);

    setTimeout(() => {
      backend.stdout?.off('data', onData);
      reject(new Error('Backend start timeout'));
    }, 10000);
  });
}

export function stopBackend(backend: ChildProcess): void {
  if (backend && !backend.killed) {
    backend.kill('SIGTERM');
  }
}

export function createWindow(port: number): BrowserWindow {
  const window = new BrowserWindow({
    minWidth: 900,
    minHeight: 600,
    frame: false,
    resizable: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: resolve(__dirname, 'preload.cjs'),
    },
  });

  window.once('ready-to-show', () => {
    window.maximize();
    window.show();
  });

  const rendererUrl = `file://${resolve(__dirname, '../dist/index.html')}?port=${port}`;

  window.loadURL(rendererUrl);
  return window;
}

export async function handleOpenAndRead(
  _event: Electron.IpcMainInvokeEvent,
  options: Electron.OpenDialogOptions,
): Promise<{ path: string; content: string } | undefined> {
  const result = await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) {
    return undefined;
  }
  const path = result.filePaths[0];
  const content = await readFile(path, 'utf-8');
  return { path, content };
}

export async function handleSaveAndWrite(
  _event: Electron.IpcMainInvokeEvent,
  options: Electron.SaveDialogOptions,
  content: string,
): Promise<string | undefined> {
  const result = await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) {
    return undefined;
  }
  await writeFile(result.filePath, content, 'utf-8');
  return result.filePath;
}

export function handleWindowMinimize(
  event: Electron.IpcMainInvokeEvent,
): void {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.minimize();
}

export function handleWindowMaximize(
  event: Electron.IpcMainInvokeEvent,
): boolean {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  if (win.isMaximized()) {
    win.unmaximize();
    return false;
  }
  win.maximize();
  return true;
}

export function handleGetWindowState(
  event: Electron.IpcMainInvokeEvent,
): { isMaximized: boolean; isFullScreen: boolean } {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { isMaximized: false, isFullScreen: false };
  return { isMaximized: win.isMaximized(), isFullScreen: win.isFullScreen() };
}

export function handleWindowClose(
  event: Electron.IpcMainInvokeEvent,
): void {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.close();
}

export function registerIpcHandlers(): void {
  ipcMain.handle('dialog:openAndRead', handleOpenAndRead);
  ipcMain.handle('dialog:saveAndWrite', handleSaveAndWrite);
  ipcMain.handle('window:minimize', handleWindowMinimize);
  ipcMain.handle('window:maximize', handleWindowMaximize);
  ipcMain.handle('window:getState', handleGetWindowState);
  ipcMain.handle('window:close', handleWindowClose);
}

export function unregisterIpcHandlers(): void {
  ipcMain.removeHandler('dialog:openAndRead');
  ipcMain.removeHandler('dialog:saveAndWrite');
  ipcMain.removeHandler('window:minimize');
  ipcMain.removeHandler('window:maximize');
  ipcMain.removeHandler('window:getState');
  ipcMain.removeHandler('window:close');
}

// Production entry point. Tests set SLD_ELECTRON_TEST=true to skip this block.
if (process.env.SLD_ELECTRON_TEST !== 'true') {
  let backendProcess: ChildProcess | null = null;
  let mainWindow: BrowserWindow | null = null;

  app.whenReady().then(async () => {
    registerIpcHandlers();
    const result = await startBackend(resolveBackendPath(app.isPackaged));
    backendProcess = result.process;
    mainWindow = createWindow(result.port);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow(result.port);
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    if (backendProcess && !backendProcess.killed) {
      stopBackend(backendProcess);
      backendProcess = null;
    }
  });
}
