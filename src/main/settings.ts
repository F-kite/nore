import { safeStorage } from 'electron'
import Store from 'electron-store'

// --- Types ---

export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'lmstudio'

export interface LLMProviderConfig {
  provider: LLMProvider
  apiKey: string // stored encrypted
  model: string
  baseUrl?: string // for Ollama custom endpoint
}

export interface AppSettings {
  // Appearance
  accentColor: string // preset name or 'custom'
  customAccentColor: string
  fontSize: string // 'compact' | 'default' | 'comfortable'
  showLineNumbers: boolean

  // LLM
  llmProvider: LLMProvider
  llmModel: string
  llmDisplayName: string
  llmBaseUrl: string // for local providers (Ollama, LM Studio)

  // Keyboard shortcuts (action -> shortcut string)
  shortcuts: Record<string, string>
}

const DEFAULT_SHORTCUTS: Record<string, string> = {
  newChat: 'CmdOrCtrl+N',
  searchNotes: 'CmdOrCtrl+K',
  switchChat: 'CmdOrCtrl+1',
  switchWrite: 'CmdOrCtrl+2',
  openSettings: 'CmdOrCtrl+,',
  toggleLineNumbers: 'CmdOrCtrl+Shift+L'
}

const DEFAULT_SETTINGS: AppSettings = {
  accentColor: 'blue',
  customAccentColor: '#4C8BF5',
  fontSize: 'default',
  showLineNumbers: true,
  llmProvider: 'openai',
  llmModel: 'gpt-4o-mini',
  llmDisplayName: '',
  llmBaseUrl: 'http://localhost:11434',
  shortcuts: DEFAULT_SHORTCUTS
}

// --- Store ---

interface StoreSchema {
  settings: AppSettings
  // Encrypted API keys stored as base64 strings
  encryptedKeys: {
    embeddings?: string
    llm?: string
  }
}

const store = new Store<StoreSchema>({
  defaults: {
    settings: DEFAULT_SETTINGS,
    encryptedKeys: {}
  }
})

// --- Settings ---

export function getSettings(): AppSettings {
  return store.get('settings', DEFAULT_SETTINGS)
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...updates }
  store.set('settings', updated)
  return updated
}

export function getDefaultShortcuts(): Record<string, string> {
  return { ...DEFAULT_SHORTCUTS }
}

// --- Encrypted API Keys ---

function encrypt(plainText: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: store as base64 (not truly secure, but functional)
    return Buffer.from(plainText).toString('base64')
  }
  const encrypted = safeStorage.encryptString(plainText)
  return encrypted.toString('base64')
}

function decrypt(encoded: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(encoded, 'base64').toString('utf-8')
  }
  const buffer = Buffer.from(encoded, 'base64')
  return safeStorage.decryptString(buffer)
}

export function saveApiKey(keyName: 'embeddings' | 'llm', value: string): void {
  const keys = store.get('encryptedKeys', {})
  if (value.trim()) {
    keys[keyName] = encrypt(value.trim())
  } else {
    delete keys[keyName]
  }
  store.set('encryptedKeys', keys)
}

export function getApiKey(keyName: 'embeddings' | 'llm'): string {
  const keys = store.get('encryptedKeys', {})
  const encoded = keys[keyName]
  if (!encoded) return ''
  try {
    return decrypt(encoded)
  } catch {
    return ''
  }
}

export function hasApiKey(keyName: 'embeddings' | 'llm'): boolean {
  const keys = store.get('encryptedKeys', {})
  return !!keys[keyName]
}

/** Returns masked version of key for display (e.g., "sk-...abc123") */
export function getMaskedApiKey(keyName: 'embeddings' | 'llm'): string {
  const key = getApiKey(keyName)
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}
