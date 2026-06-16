import { app, BrowserWindow } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
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
  const backend = spawn(process.execPath, [backendPath], {
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

export function createWindow(port: number, isPackaged: boolean): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const rendererUrl = isPackaged
    ? `file://${resolve(__dirname, '../dist/index.html')}?port=${port}`
    : `http://localhost:5173/?port=${port}`;

  window.loadURL(rendererUrl);
  return window;
}

// Production entry point. Tests set SLD_ELECTRON_TEST=true to skip this block.
if (process.env.SLD_ELECTRON_TEST !== 'true') {
  let backendProcess: ChildProcess | null = null;
  let mainWindow: BrowserWindow | null = null;

  app.whenReady().then(async () => {
    const result = await startBackend(resolveBackendPath(app.isPackaged));
    backendProcess = result.process;
    mainWindow = createWindow(result.port, app.isPackaged);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow(result.port, app.isPackaged);
      }
    });
  });

  app.on('window-all-closed', () => {
    if (backendProcess) {
      stopBackend(backendProcess);
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    if (backendProcess) {
      stopBackend(backendProcess);
    }
  });
}
