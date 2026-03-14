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
  loadVaultFiles
} from './vault'
import icon from '../../resources/icon.png?asset'
import { getSettings, updateSettings, getDefaultShortcuts, saveApiKey, getMaskedApiKey, hasApiKey } from './settings'
import { indexVault, getProgress, searchNotes } from './indexer'
import type { NoteFile } from '../types/indexer'

console.log('[DEBUG] MISTRAL_API_KEY:', process.env.MISTRAL_API_KEY ? 'loaded' : 'NOT FOUND')

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.maximize()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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
