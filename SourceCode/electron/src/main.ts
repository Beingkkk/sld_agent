import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { fork } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

/**
 * SLDAgent Electron Main Process
 *
 * Responsibilities:
 * - Create frameless BrowserWindow with custom title bar support.
 * - Load frontend: dev -> http://localhost:5173, prod -> file://.../frontend/dist/index.html
 * - Register IPC handlers for file dialogs and window controls.
 * - Fork backend child process in production.
 * - Gracefully terminate backend on quit.
 */

class SLDAgentApp {
  private mainWindow: BrowserWindow | null = null;
  private backendProcess: ReturnType<typeof fork> | null = null;

  async start(): Promise<void> {
    await app.whenReady();
    this.createWindow();
    this.registerIpcHandlers();

    if (!this.isDev()) {
      this.startBackend();
    }

    app.on('window-all-closed', () => {
      this.stopBackend();
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on('before-quit', () => {
      this.stopBackend();
    });
  }

  private isDev(): boolean {
    return !app.isPackaged;
  }

  private createWindow(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 800,
      frame: false,
      titleBarStyle: 'hidden',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (this.isDev()) {
      this.mainWindow.loadURL('http://localhost:5173');
    } else {
      const indexPath = path.join(app.getAppPath(), 'SourceCode', 'frontend', 'dist', 'index.html');
      this.mainWindow.loadFile(indexPath);
    }

    // Notify renderer when maximized state changes
    this.mainWindow.on('maximize', () => {
      this.mainWindow?.webContents.send('window:maximized-change', true);
    });

    this.mainWindow.on('unmaximize', () => {
      this.mainWindow?.webContents.send('window:maximized-change', false);
    });

    return this.mainWindow;
  }

  private startBackend(): void {
    // Resolve backend entry path in production
    // electron-builder places extra files relative to app.getAppPath()
    const appPath = app.getAppPath();
    const possiblePaths = [
      path.join(appPath, 'SourceCode', 'backend', 'dist', 'index.js'),
      path.join(appPath, '..', 'SourceCode', 'backend', 'dist', 'index.js'),
      path.join(__dirname, '..', '..', 'backend', 'dist', 'index.js'),
      path.join(process.resourcesPath, 'app', 'SourceCode', 'backend', 'dist', 'index.js'),
    ];

    let backendPath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        backendPath = p;
        break;
      }
    }

    if (!backendPath) {
      console.error('[SLDAgent] Backend entry not found. Tried paths:', possiblePaths);
      return;
    }

    console.log('[SLDAgent] Starting backend:', backendPath);
    this.backendProcess = fork(backendPath, [], {
      cwd: path.dirname(backendPath),
      env: {
        ...process.env,
        SLDAGENT_CONFIG_PATH: this.resolveConfigPath(),
      },
    });

    this.backendProcess.on('error', (err) => {
      console.error('[SLDAgent] Backend process error:', err);
    });

    this.backendProcess.on('exit', (code, signal) => {
      console.log(`[SLDAgent] Backend exited (code=${code}, signal=${signal})`);
    });
  }

  private stopBackend(): void {
    if (this.backendProcess) {
      console.log('[SLDAgent] Stopping backend process...');
      this.backendProcess.kill('SIGTERM');
      // Force kill after 5s if still alive
      const timer = setTimeout(() => {
        if (this.backendProcess && !this.backendProcess.killed) {
          console.warn('[SLDAgent] Backend did not exit gracefully, sending SIGKILL');
          this.backendProcess.kill('SIGKILL');
        }
      }, 5000);
      this.backendProcess.on('exit', () => clearTimeout(timer));
      this.backendProcess = null;
    }
  }

  private resolveConfigPath(): string {
    const userDataPath = app.getPath('userData');
    const userConfig = path.join(userDataPath, 'config.json');
    if (fs.existsSync(userConfig)) {
      return userConfig;
    }
    // Fallback to built-in template (no real keys)
    const appPath = app.getAppPath();
    return path.join(appPath, 'SourceCode', 'config', 'config.json.template');
  }

  private registerIpcHandlers(): void {
    // Window controls
    ipcMain.on('window:minimize', () => {
      this.mainWindow?.minimize();
    });

    ipcMain.on('window:maximize', () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });

    ipcMain.on('window:close', () => {
      this.stopBackend();
      this.mainWindow?.close();
    });

    // File dialogs
    ipcMain.handle('dialog:openSld', async () => {
      if (!this.mainWindow) return { filePath: null, content: null };
      const result = await dialog.showOpenDialog(this.mainWindow, {
        title: 'Open SLD File',
        filters: [
          { name: 'SLD Files', extensions: ['sld', 'xml'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { filePath: null, content: null };
      }

      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, 'utf-8');
      return { filePath, content };
    });

    ipcMain.handle('dialog:saveSld', async (_, content: string) => {
      if (!this.mainWindow) return { filePath: null, success: false };
      const result = await dialog.showSaveDialog(this.mainWindow, {
        title: 'Save SLD File',
        filters: [
          { name: 'SLD Files', extensions: ['sld'] },
          { name: 'XML Files', extensions: ['xml'] },
        ],
        defaultPath: 'style.sld',
      });

      if (result.canceled || !result.filePath) {
        return { filePath: null, success: false };
      }

      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { filePath: result.filePath, success: true };
    });

    // Open file explorer / Finder to the saved file
    ipcMain.handle('shell:showItemInFolder', (_, filePath: string) => {
      shell.showItemInFolder(filePath);
    });
  }
}

// Bootstrap
const sldAgent = new SLDAgentApp();
sldAgent.start().catch((err) => {
  console.error('[SLDAgent] Failed to start:', err);
  process.exit(1);
});
