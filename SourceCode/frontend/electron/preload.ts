import { contextBridge, ipcRenderer } from 'electron';

export interface OpenAndReadOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface SaveAndWriteOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface FileReadResult {
  path: string;
  content: string;
}

export interface ElectronAPI {
  openAndRead(options: OpenAndReadOptions): Promise<FileReadResult | undefined>;
  saveAndWrite(options: SaveAndWriteOptions, content: string): Promise<string | undefined>;
}

const electronAPI: ElectronAPI = {
  async openAndRead(options) {
    return ipcRenderer.invoke('dialog:openAndRead', options);
  },
  async saveAndWrite(options, content) {
    return ipcRenderer.invoke('dialog:saveAndWrite', options, content);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
