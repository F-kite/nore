import type { ElectronAPI } from '@electron-toolkit/preload'
import type { VaultFile } from '../types/vault'

export interface IndexingProgress {
  total: number
  processed: number
  status: 'idle' | 'indexing' | 'done' | 'error'
  error?: string
}

export interface NoteRecord {
  id: string
  filePath: string
  relativePath: string
  title: string
  content: string
  createdAt: number
  modifiedAt: number
  vector: number[]
}

declare global {
  interface Window {
    electron: ElectronAPI
    vault: {
      selectFolder: () => Promise<string | null>
      getSavedPath: () => Promise<string | null>
      loadFiles: (vaultPath: string) => Promise<VaultFile[]>
    }
    indexing: {
      start: (vaultPath: string, files: VaultFile[]) => Promise<void>
      getProgress: () => Promise<IndexingProgress>
      onProgress: (callback: (progress: IndexingProgress) => void) => void
    }
    search: {
      query: (query: string) => Promise<NoteRecord[]>
    }
  }
}

export { }