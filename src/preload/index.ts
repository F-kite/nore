import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { VaultFile } from '../types/vault'


// Vault API — мост между renderer и main
const vaultAPI = {
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('vault:select'),

  getSavedPath: (): Promise<string | null> =>
    ipcRenderer.invoke('vault:getSavedPath'),

  loadFiles: (vaultPath: string): Promise<VaultFile[]> =>
    ipcRenderer.invoke('vault:loadFiles', vaultPath)
}

contextBridge.exposeInMainWorld('indexing', {
  start: (vaultPath: string, files: unknown[]) =>
    ipcRenderer.invoke('indexing:start', vaultPath, files),
  getProgress: () =>
    ipcRenderer.invoke('indexing:getProgress'),
  onProgress: (callback: (progress: unknown) => void) =>
    ipcRenderer.on('indexing:progress', (_, progress) => callback(progress))
})

contextBridge.exposeInMainWorld('search', {
  query: (query: string) =>
    ipcRenderer.invoke('search:query', query)
})

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('vault', vaultAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.vault = vaultAPI
}
