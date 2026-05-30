import dotenv from 'dotenv'
dotenv.config()
import { join } from 'path'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  selectVaultFolder,
  selectDbFolder,
  getSavedVaultPath,
  getDefaultDbPath,
  setDbPath,
  loadVaultFiles,
  openInObsidian
} from './vault'
import icon from '../../resources/icon.png?asset'
import {
  getSettings, updateSettings, getDefaultShortcuts,
  saveApiKey, getMaskedApiKey, hasApiKey,
  getLlmConnections, addLlmConnection, deleteLlmConnection,
  setActiveLlmConnection, getActiveConnection, getConnectionApiKey, getMaskedConnectionApiKey
} from './settings'
import type { LLMConnection } from './settings'
import { indexVault, getProgress, searchNotes } from './indexer'
import {
  listConversations,
  loadConversation,
  saveConversation,
  deleteConversation,
  renameConversation,
  type StoredChat
} from './conversations'
import { streamChat, fetchModels } from './llm'
import type { LLMChatMessage, ChatAttachment } from './llm'
import type { NoteFile } from '../types/indexer'
import {
  getStatus as getLicenseStatus,
  activate as activateLicense,
  deactivate as deactivateLicense,
  isQueryAllowed,
  incrementQueryCount,
  validateInBackground,
  onStatusChange as onLicenseStatusChange
} from './license'

console.log('[DEBUG] MISTRAL_API_KEY:', process.env.MISTRAL_API_KEY ? 'loaded' : 'NOT FOUND')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    // Custom title bar
    ...(isMac
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 12, y: 18 } }
      : { frame: false }
    ),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.maximize()

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Vault IPC
  ipcMain.handle('vault:select', async () => {
    return await selectVaultFolder()
  })

  ipcMain.handle('vault:selectDbFolder', async () => {
    return await selectDbFolder()
  })

  ipcMain.handle('vault:getSavedPath', () => {
    return getSavedVaultPath()
  })

  ipcMain.handle('vault:getDefaultDbPath', () => {
    return getDefaultDbPath()
  })

  ipcMain.handle('vault:setDbPath', (_, dbPath: string) => {
    setDbPath(dbPath)
  })

  ipcMain.handle('vault:loadFiles', async (_, vaultPath: string) => {
    return await loadVaultFiles(vaultPath)
  })

  ipcMain.handle('vault:openInObsidian', async (_, notePath: string) => {
    await openInObsidian(notePath)
  })

  // Indexing IPC
  ipcMain.handle('indexing:start', async (_, vaultPath: string, files: NoteFile[]) => {
    console.log(`[DEBUG] indexing:start called; \npath:${vaultPath};\n files_count:${files?.length}`)
    await indexVault(vaultPath, files, (progress) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('indexing:progress', progress)
    })
  })

  ipcMain.handle('indexing:getProgress', () => {
    return getProgress()
  })

  // Search IPC
  ipcMain.handle('search:query', async (_, query: string) => {
    return await searchNotes(query)
  })

  // Chat IPC — conversation persistence (SQLite)
  ipcMain.handle('chat:listConversations', () => listConversations())
  ipcMain.handle('chat:loadConversation', (_, id: string) => loadConversation(id))
  ipcMain.handle('chat:saveConversation', (_, chat: StoredChat) => saveConversation(chat))
  ipcMain.handle('chat:deleteConversation', (_, id: string) => deleteConversation(id))
  ipcMain.handle('chat:renameConversation', (_, id: string, title: string) => renameConversation(id, title))

  // Write IPC — vector search for related notes
  ipcMain.handle('write:relatedOnly', async (_, query: string, limit = 6) => {
    return await searchNotes(query, limit)
  })

  // Window controls IPC (frameless window)
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:toggleMaximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  // License IPC
  ipcMain.handle('license:getStatus', () => getLicenseStatus())
  ipcMain.handle('license:activate', async (_, email: string, key: string) =>
    activateLicense(email, key)
  )
  ipcMain.handle('license:deactivate', () => deactivateLicense())

  // Forward license status changes to renderer
  onLicenseStatusChange((status) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('license:statusChange', status)
  })

  // Background validation on startup (non-blocking)
  validateInBackground().catch(() => {})

  // LLM IPC (streaming)
  ipcMain.handle('llm:chat', async (event, params: {
    chatId: string
    messages: LLMChatMessage[]
    model?: string
    attachments?: ChatAttachment[]
  }) => {
    const queryCheck = isQueryAllowed()
    if (!queryCheck.allowed) {
      throw new Error(queryCheck.reason)
    }

    await streamChat({
      ...params,
      onToken: (token) => {
        event.sender.send('llm:token', { chatId: params.chatId, token })
      },
      onSources: (sources) => {
        event.sender.send('llm:sources', { chatId: params.chatId, sources })
      }
    })

    incrementQueryCount()
  })

  // Fetch available models for the active connection
  ipcMain.handle('llm:fetchModels', async () => fetchModels())

  // LLM connection check (uses active connection)
  ipcMain.handle('llm:checkConnection', async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const conn = getActiveConnection()
      if (!conn) throw new Error('No active connection configured.')

      if (conn.provider === 'ollama') {
        const base = conn.baseUrl || 'http://localhost:11434'
        const res = await fetch(`${base}/api/tags`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } else if (conn.provider === 'lmstudio') {
        const base = conn.baseUrl || 'http://localhost:1234'
        const res = await fetch(`${base}/v1/models`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } else if (conn.provider === 'openai') {
        const key = getConnectionApiKey(conn.id)
        if (!key) throw new Error('API key not set')
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` }
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } else if (conn.provider === 'anthropic') {
        const key = getConnectionApiKey(conn.id)
        if (!key) throw new Error('API key not set')
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      }

      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  // LLM connections CRUD
  ipcMain.handle('llm:getConnections', (): LLMConnection[] => getLlmConnections())

  ipcMain.handle('llm:addConnection', (_, conn: Omit<LLMConnection, 'id'>, apiKey: string): LLMConnection =>
    addLlmConnection(conn, apiKey)
  )

  ipcMain.handle('llm:deleteConnection', (_, id: string): void => deleteLlmConnection(id))

  ipcMain.handle('llm:setActiveConnection', (_, id: string): void => setActiveLlmConnection(id))

  ipcMain.handle('llm:getMaskedConnectionKey', (_, id: string): string =>
    getMaskedConnectionApiKey(id)
  )

  // --- Settings ---
  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:update', (_, updates) => {
    return updateSettings(updates)
  })

  ipcMain.handle('settings:getDefaultShortcuts', () => {
    return getDefaultShortcuts()
  })

  // --- API Keys (encrypted) ---

  ipcMain.handle('apiKeys:save', (_, keyName: string, value: string) => {
    saveApiKey(keyName as 'embeddings' | 'llm', value)
  })

  ipcMain.handle('apiKeys:getMasked', (_, keyName: string) => {
    return getMaskedApiKey(keyName as 'embeddings' | 'llm')
  })

  ipcMain.handle('apiKeys:has', (_, keyName: string) => {
    return hasApiKey(keyName as 'embeddings' | 'llm')
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
