export interface ElectronAPI {
  openAndRead(options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<{ path: string; content: string } | undefined>;
  saveAndWrite(
    options: {
      title?: string;
      defaultPath?: string;
      filters?: { name: string; extensions: string[] }[];
    },
    content: string,
  ): Promise<string | undefined>;
  minimizeWindow(): Promise<void>;
  toggleMaximize(): Promise<boolean>;
  getWindowState(): Promise<{ isMaximized: boolean; isFullScreen: boolean }>;
  closeWindow(): Promise<void>;
  isElectron: true;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
