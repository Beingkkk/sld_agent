/**
 * Electron IPC wrapper
 * Provides typed access to the window.electronAPI exposed by the preload script.
 * Falls back gracefully when running in a browser (dev mode).
 */

export async function openSldFile(): Promise<{ filePath: string; content: string } | null> {
  if (!window.electronAPI?.openSld) {
    console.warn('Electron IPC not available, using browser fallback');
    return null;
  }
  return window.electronAPI.openSld();
}

export async function saveSldFile(content: string): Promise<{ filePath: string | null; success: boolean } | null> {
  if (!window.electronAPI?.saveSld) {
    console.warn('Electron IPC not available, using browser fallback');
    return null;
  }
  return window.electronAPI.saveSld(content);
}

export async function showItemInFolder(filePath: string): Promise<void> {
  if (!window.electronAPI?.showItemInFolder) {
    console.warn('Electron IPC not available, cannot open file location');
    return;
  }
  return window.electronAPI.showItemInFolder(filePath);
}

export function minimizeWindow(): void {
  window.electronAPI?.minimizeWindow?.();
}

export function maximizeWindow(): void {
  window.electronAPI?.maximizeWindow?.();
}

export function closeWindow(): void {
  window.electronAPI?.closeWindow?.();
}

export function isElectron(): boolean {
  return !!window.electronAPI;
}
