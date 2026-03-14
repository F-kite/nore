import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { VaultFile } from '../types/vault'

// Vault API
const vaultAPI = {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('vault:select'),
  getSavedPath: (): Promise<string | null> => ipcRenderer.invoke('vault:getSavedPath'),
  loadFiles: (vaultPath: string): Promise<VaultFile[]> =>
    ipcRenderer.invoke('vault:loadFiles', vaultPath)
}

// Indexing API
const indexingAPI = {
  start: (vaultPath: string, files: unknown[]) =>
    ipcRenderer.invoke('indexing:start', vaultPath, files),
  getProgress: () => ipcRenderer.invoke('indexing:getProgress'),
  onProgress: (callback: (progress: unknown) => void) =>
    ipcRenderer.on('indexing:progress', (_, progress) => callback(progress))
}

// Search API
const searchAPI = {
  query: (query: string) => ipcRenderer.invoke('search:query', query)
}

// Settings API
const settingsAPI = {
  get: () => ipcRenderer.invoke('settings:get'),
  update: (updates: Record<string, unknown>) => ipcRenderer.invoke('settings:update', updates),
  getDefaultShortcuts: () => ipcRenderer.invoke('settings:getDefaultShortcuts')
}

// API Keys API (encrypted storage)
const apiKeysAPI = {
  save: (keyName: string, value: string) => ipcRenderer.invoke('apiKeys:save', keyName, value),
  getMasked: (keyName: string) => ipcRenderer.invoke('apiKeys:getMasked', keyName),
  has: (keyName: string) => ipcRenderer.invoke('apiKeys:has', keyName),
  remove: (keyName: string) => ipcRenderer.invoke('apiKeys:save', keyName, '')
}

// Platform info
const platformAPI = {
  isMac: process.platform === 'darwin'
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('vault', vaultAPI)
    contextBridge.exposeInMainWorld('indexing', indexingAPI)
    contextBridge.exposeInMainWorld('search', searchAPI)
    contextBridge.exposeInMainWorld('settings', settingsAPI)
    contextBridge.exposeInMainWorld('apiKeys', apiKeysAPI)
    contextBridge.exposeInMainWorld('platform', platformAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.vault = vaultAPI
  // @ts-ignore
  window.indexing = indexingAPI
  // @ts-ignore
  window.search = searchAPI
  // @ts-ignore
  window.settings = settingsAPI
  // @ts-ignore
  window.apiKeys = apiKeysAPI
  // @ts-ignore
  window.platform = platformAPI
}
