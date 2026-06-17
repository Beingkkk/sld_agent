/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

declare module '*.geojson?url' {
  const src: string;
  export default src;
}

interface Window {
  electronAPI?: {
    openSld: () => Promise<{ filePath: string; content: string } | null>;
    saveSld: (content: string) => Promise<{ filePath: string | null; success: boolean } | null>;
    showItemInFolder: (filePath: string) => Promise<void>;
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
  };
}
