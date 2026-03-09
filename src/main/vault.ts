import { dialog, app } from 'electron'
import { readdir, readFile, stat } from 'fs/promises'
import { join, extname, relative } from 'path'
import Store from 'electron-store'
import type { VaultFile, VaultStore } from "../types/vault"

// Хранилище настроек
const store = new Store<VaultStore>()

// Открыть диалог выбора папки vault
export async function selectVaultFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select your Obsidian vault folder',
    buttonLabel: 'Select Vault'
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const vaultPath = result.filePaths[0]
  store.set('vaultPath', vaultPath)
  return vaultPath
}

// Получить сохранённый путь к vault
export function getSavedVaultPath(): string | null {
  return store.get('vaultPath') ?? null
}

// Рекурсивно читать все .md файлы из папки
async function readMdFiles(dirPath: string, rootPath: string): Promise<VaultFile[]> {
  const files: VaultFile[] = []
  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    // Пропускаем скрытые папки (.obsidian, .git и т.д.)
    if (entry.name.startsWith('.')) continue

    const fullPath = join(dirPath, entry.name)

    if (entry.isDirectory()) {
      const nested = await readMdFiles(fullPath, rootPath)
      files.push(...nested)
    } else if (entry.isFile() && extname(entry.name) === '.md') {
      const [fileStat, content] = await Promise.all([
        stat(fullPath),
        readFile(fullPath, 'utf-8')
      ])

      files.push({
        name: entry.name.replace('.md', ''),
        path: fullPath,
        relativePath: relative(rootPath, fullPath),
        content,
        createdAt: fileStat.birthtimeMs,
        modifiedAt: fileStat.mtimeMs
      })
    }
  }

  return files
}

// Загрузить все файлы из vault
export async function loadVaultFiles(vaultPath: string): Promise<VaultFile[]> {
  return await readMdFiles(vaultPath, vaultPath)
}