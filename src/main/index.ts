import dotenv from 'dotenv'
dotenv.config()
console.log('VOYAGE_API_KEY:', process.env.VOYAGE_API_KEY ? 'loaded ✓' : 'NOT FOUND ✗')
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { indexVault, getProgress, searchNotes } from './indexer'
import { selectVaultFolder, getSavedVaultPath, loadVaultFiles } from './vault'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import type { NoteFile } from '../types/indexer'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })


  ipcMain.handle('vault:select', async () => {
    return await selectVaultFolder()
  })

  ipcMain.handle('vault:getSavedPath', () => {
    return getSavedVaultPath()
  })

  ipcMain.handle('vault:loadFiles', async (_, vaultPath: string) => {
    return await loadVaultFiles(vaultPath)
  })

  //indexation

  ipcMain.handle('indexing:start', async (_, vaultPath: string, files: NoteFile[]) => {
    console.log('indexing:start called', vaultPath, files?.length, files?.[0])
    await indexVault(vaultPath, files, (progress) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('indexing:progress', progress)
    })
  })

  ipcMain.handle('indexing:getProgress', () => {
    return getProgress()
  })

  ipcMain.handle('search:query', async (_, query: string) => {
    return await searchNotes(query)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
