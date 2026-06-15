export interface FileService {
  openGeoJson(): Promise<{ path: string; content: string } | undefined>;
  openSld(): Promise<{ path: string; content: string } | undefined>;
  saveSld(defaultName: string, xml: string): Promise<string | undefined>;
  getRecentFiles(): string[];
}

const RECENT_KEY = 'sld-agent:recent-files';

export function createFileService(): FileService {
  return {
    async openGeoJson() {
      return openTextFile('.geojson,.json');
    },
    async openSld() {
      return openTextFile('.sld,.xml');
    },
    async saveSld(defaultName, xml) {
      const blob = new Blob([xml], { type: 'application/vnd.ogc.sld+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      a.click();
      URL.revokeObjectURL(url);
      addRecentFile(defaultName);
      return defaultName;
    },
    getRecentFiles() {
      try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[];
      } catch {
        return [];
      }
    },
  };
}

function openTextFile(accept: string): Promise<{ path: string; content: string } | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(undefined);
        return;
      }
      const content = await file.text();
      addRecentFile(file.name);
      resolve({ path: file.name, content });
    };
    input.oncancel = () => resolve(undefined);
    input.click();
  });
}

function addRecentFile(path: string): void {
  try {
    const existing = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[];
    const updated = [path, ...existing.filter((p) => p !== path)].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}
