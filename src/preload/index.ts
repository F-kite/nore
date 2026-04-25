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

// LLM API (streaming via ipcRenderer events)
let onLLMTokenCallback: ((data: { chatId: string; token: string }) => void) | null = null
ipcRenderer.on('llm:token', (_, data) => onLLMTokenCallback?.(data))

const llmAPI = {
  chat: (params: {
    chatId: string
    messages: { role: string; content: string }[]
    contextNotes: string
    model?: string
    attachments?: { name: string; type: 'text' | 'image'; content: string; mimeType?: string }[]
  }) => ipcRenderer.invoke('llm:chat', params),
  onToken: (callback: (data: { chatId: string; token: string }) => void) => {
    onLLMTokenCallback = callback
  },
  fetchModels: (): Promise<string[]> => ipcRenderer.invoke('llm:fetchModels'),
  checkConnection: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('llm:checkConnection'),
  getConnections: () => ipcRenderer.invoke('llm:getConnections'),
  addConnection: (conn: { displayName: string; provider: string; model: string; baseUrl: string }, apiKey: string) =>
    ipcRenderer.invoke('llm:addConnection', conn, apiKey),
  deleteConnection: (id: string) => ipcRenderer.invoke('llm:deleteConnection', id),
  setActiveConnection: (id: string) => ipcRenderer.invoke('llm:setActiveConnection', id),
  getMaskedConnectionKey: (id: string) => ipcRenderer.invoke('llm:getMaskedConnectionKey', id)
}

// Window controls (frameless window)
const windowControlsAPI = {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
  close: () => ipcRenderer.send('window:close')
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
    contextBridge.exposeInMainWorld('llm', llmAPI)
    contextBridge.exposeInMainWorld('windowControls', windowControlsAPI)
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
  window.llm = llmAPI
  // @ts-ignore
  window.windowControls = windowControlsAPI
  // @ts-ignore
  window.platform = platformAPI
}
