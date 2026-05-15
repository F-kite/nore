import type { ElectronAPI } from '@electron-toolkit/preload'
import type { VaultFile } from '../types/vault'

// --- Conversation persistence types ---

export interface ConversationSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

export interface StoredVersion {
  id: string
  content: string
  timestamp: string
  sources?: unknown
  error?: boolean
}

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  versions?: StoredVersion[]
  activeVersionIndex?: number
}

export interface StoredChat {
  id: string
  title: string
  createdAt: number
  messages: StoredMessage[]
}

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

export interface ChatAttachment {
  name: string
  type: 'text' | 'image'
  content: string
  mimeType?: string
}

export interface SearchSource {
  title: string
  relativePath: string
  content: string
  excerpt: string
  _distance?: number
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

export type Plan = 'free' | 'pro'

export interface LicenseStatus {
  plan: Plan
  email?: string
  validUntil?: number
  queriesUsedThisMonth: number
  /** -1 means unlimited (Pro) */
  queriesLimit: number
  lastValidatedAt: number
}

export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'lmstudio'

export interface LLMConnection {
  id: string
  displayName: string
  provider: LLMProvider
  model: string
  baseUrl: string
}

export interface AppSettings {
  accentColor: string
  customAccentColor: string
  fontSize: string
  showLineNumbers: boolean
  // Multi-connection LLM
  llmConnections: LLMConnection[]
  activeLlmConnectionId: string | null
  // @deprecated — kept for migration
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
      getDefaultDbPath: () => string
      selectDbFolder: () => Promise<string | null>
      setDbPath: (dbPath: string) => void
      openInObsidian: (notePath: string) => Promise<void>
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
      chat: (params: {
        chatId: string
        messages: LLMChatMessage[]
        model?: string
        attachments?: ChatAttachment[]
      }) => Promise<void>
      onToken: (callback: (data: { chatId: string; token: string }) => void) => void
      onSources: (callback: (data: { chatId: string; sources: SearchSource[] }) => void) => void
      fetchModels: () => Promise<string[]>
      checkConnection: () => Promise<{ ok: boolean; error?: string }>
      getConnections: () => Promise<LLMConnection[]>
      addConnection: (conn: Omit<LLMConnection, 'id'>, apiKey: string) => Promise<LLMConnection>
      deleteConnection: (id: string) => Promise<void>
      setActiveConnection: (id: string) => Promise<void>
      getMaskedConnectionKey: (id: string) => Promise<string>
    }
    chat: {
      listConversations: () => Promise<ConversationSummary[]>
      loadConversation: (id: string) => Promise<StoredChat | null>
      saveConversation: (chat: StoredChat) => Promise<void>
      deleteConversation: (id: string) => Promise<void>
      renameConversation: (id: string, title: string) => Promise<void>
    }
    write: {
      relatedOnly: (query: string, limit?: number) => Promise<NoteRecord[]>
    }
    license: {
      getStatus: () => Promise<LicenseStatus>
      activate: (email: string, key: string) => Promise<LicenseStatus>
      deactivate: () => Promise<void>
      onStatusChange: (callback: (status: LicenseStatus) => void) => void
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

export { }
