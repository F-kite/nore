import type { ElectronAPI } from '@electron-toolkit/preload'
import type { VaultFile } from '../types/vault'

export interface IndexingProgress {
  total: number
  processed: number
  status: 'idle' | 'indexing' | 'done' | 'error'
  error?: string
}

export interface LLMChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface NoteRecord {
  id: string
  filePath: string
  relativePath: string
  title: string
  content: string
  createdAt: number
  modifiedAt: number
  _distance?: number
  vector: number[]
}

export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'lmstudio'

export interface AppSettings {
  accentColor: string
  customAccentColor: string
  fontSize: string
  showLineNumbers: boolean
  llmProvider: LLMProvider
  llmModel: string
  llmDisplayName: string
  llmBaseUrl: string
  shortcuts: Record<string, string>
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
    settings: {
      get: () => Promise<AppSettings>
      update: (updates: Partial<AppSettings>) => Promise<AppSettings>
      getDefaultShortcuts: () => Promise<Record<string, string>>
    }
    apiKeys: {
      save: (keyName: 'embeddings' | 'llm', value: string) => Promise<void>
      getMasked: (keyName: 'embeddings' | 'llm') => Promise<string>
      has: (keyName: 'embeddings' | 'llm') => Promise<boolean>
      remove: (keyName: 'embeddings' | 'llm') => Promise<void>
    }
    llm: {
      chat: (params: { chatId: string; messages: LLMChatMessage[]; contextNotes: string }) => Promise<void>
      onToken: (callback: (data: { chatId: string; token: string }) => void) => void
    }
    windowControls: {
      minimize: () => void
      toggleMaximize: () => void
      close: () => void
    }
    platform: {
      isMac: boolean
    }
  }
}

export {}
