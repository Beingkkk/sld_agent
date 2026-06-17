import { contextBridge, ipcRenderer } from 'electron';

/**
 * SLDAgent Preload Script
 *
 * Exposes a minimal, typed API to the renderer process via contextBridge.
 * All Electron-native capabilities (file dialogs, window controls) are
 * proxied through IPC so the renderer never has direct access to Node/Electron APIs.
 */

export interface ElectronAPI {
  /** Open a native file dialog to select an SLD file. Returns file path and content. */
  openSld: () => Promise<{ filePath: string | null; content: string | null }>;
  /** Open a native save dialog to write SLD content to a file. */
  saveSld: (content: string) => Promise<{ filePath: string | null; success: boolean }>;
  /** Open the file manager and highlight the given file path. */
  showItemInFolder: (filePath: string) => Promise<void>;
  /** Minimize the application window. */
  minimizeWindow: () => void;
  /** Toggle maximize/restore the application window. */
  maximizeWindow: () => void;
  /** Close the application window. */
  closeWindow: () => void;
  /** Subscribe to window maximized state changes. */
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => void;
}

const electronAPI: ElectronAPI = {
  openSld: () => ipcRenderer.invoke('dialog:openSld'),
  saveSld: (content: string) => ipcRenderer.invoke('dialog:saveSld', content),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => {
      callback(isMaximized);
    };
    ipcRenderer.on('window:maximized-change', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
