import { app, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let backend: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

function resolveBackendPath(): string {
  if (app.isPackaged) {
    return resolve(process.resourcesPath, 'backend', 'dist', 'index.js');
  }
  return resolve(__dirname, '../../backend/dist/index.js');
}

async function startBackend(): Promise<number> {
  const backendPath = resolveBackendPath();
  backend = spawn(process.execPath, [backendPath], {
    env: { ...process.env, SLD_PORT: '0' },
  });

  return new Promise((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    backend!.on('error', onError);

    const onData = (data: Buffer) => {
      const line = data.toString();
      const match = line.match(/READY ws:\/\/localhost:(\d+)/);
      if (match) {
        backend!.stdout?.off('data', onData);
        backend!.off('error', onError);
        resolve(parseInt(match[1], 10));
      }
    };

    backend!.stdout?.on('data', onData);

    setTimeout(() => {
      backend!.stdout?.off('data', onData);
      reject(new Error('Backend start timeout'));
    }, 10000);
  });
}

function stopBackend(): void {
  if (backend && !backend.killed) {
    backend.kill('SIGTERM');
    backend = null;
  }
}

function createWindow(port: number): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const rendererUrl = app.isPackaged
    ? `file://${resolve(__dirname, '../dist/index.html')}?port=${port}`
    : `http://localhost:5173/?port=${port}`;

  mainWindow.loadURL(rendererUrl);
}

app.whenReady().then(async () => {
  const port = await startBackend();
  createWindow(port);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port);
    }
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});
