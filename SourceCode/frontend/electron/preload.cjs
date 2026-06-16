const { contextBridge, ipcRenderer } = require('electron');

/** @typedef {{ path: string; content: string }} FileReadResult */
/** @typedef {{ title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }} DialogOptions */

/**
 * @typedef {Object} ElectronAPI
 * @property {(options: DialogOptions) => Promise<FileReadResult | undefined>} openAndRead
 * @property {(options: DialogOptions, content: string) => Promise<string | undefined>} saveAndWrite
 * @property {() => Promise<void>} minimizeWindow
 * @property {() => Promise<boolean>} toggleMaximize
 * @property {() => Promise<{ isMaximized: boolean; isFullScreen: boolean }>} getWindowState
 * @property {() => Promise<void>} closeWindow
 * @property {true} isElectron
 */

/** @type {ElectronAPI} */
const electronAPI = {
  async openAndRead(options) {
    return ipcRenderer.invoke('dialog:openAndRead', options);
  },
  async saveAndWrite(options, content) {
    return ipcRenderer.invoke('dialog:saveAndWrite', options, content);
  },
  async minimizeWindow() {
    return ipcRenderer.invoke('window:minimize');
  },
  async toggleMaximize() {
    return ipcRenderer.invoke('window:maximize');
  },
  async getWindowState() {
    return ipcRenderer.invoke('window:getState');
  },
  async closeWindow() {
    return ipcRenderer.invoke('window:close');
  },
  isElectron: true,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
