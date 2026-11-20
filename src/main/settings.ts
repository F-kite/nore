import { safeStorage } from 'electron'
import Store from 'electron-store'
import { randomUUID } from 'crypto'

// --- Types ---

export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'lmstudio'

export interface LLMConnection {
  id: string
  displayName: string
  provider: LLMProvider
  model: string
  baseUrl: string
}

export interface AppSettings {
  // Appearance
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
  // Keyboard shortcuts
  shortcuts: Record<string, string>
}

const DEFAULT_SHORTCUTS: Record<string, string> = {
  newChat: 'CmdOrCtrl+T',
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
  llmConnections: [],
  activeLlmConnectionId: null,
  llmProvider: 'openai',
  llmModel: 'gpt-4o-mini',
  llmDisplayName: '',
  llmBaseUrl: 'http://localhost:11434',
  shortcuts: DEFAULT_SHORTCUTS
}

// --- Store ---

interface StoreSchema {
  settings: AppSettings
  // encryptedKeys: fixed 'embeddings', legacy 'llm', and dynamic 'conn_${id}'
  encryptedKeys: Record<string, string>
}

const store = new Store<StoreSchema>({
  defaults: {
    settings: DEFAULT_SETTINGS,
    encryptedKeys: {}
  }
})

// --- Encryption ---

function encrypt(plainText: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(plainText).toString('base64')
  }
  return safeStorage.encryptString(plainText).toString('base64')
}

function decrypt(encoded: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(encoded, 'base64').toString('utf-8')
  }
  return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
}

// --- One-time migration: single LLM config → connections list ---

function migrateToConnections(): void {
  const settings = store.get('settings', DEFAULT_SETTINGS)
  if (settings.llmConnections && settings.llmConnections.length > 0) return

  const keys = store.get('encryptedKeys', {})
  const oldEncryptedKey = keys['llm']
  const hadConfig = !!(settings.llmProvider || settings.llmModel || oldEncryptedKey)
  if (!hadConfig) return

  const id = randomUUID()
  const connection: LLMConnection = {
    id,
    displayName: settings.llmDisplayName || settings.llmProvider || 'Default',
    provider: settings.llmProvider || 'openai',
    model: settings.llmModel || 'gpt-4o-mini',
    baseUrl: settings.llmBaseUrl || ''
  }

  if (oldEncryptedKey) {
    keys[`conn_${id}`] = oldEncryptedKey
    store.set('encryptedKeys', keys)
  }

  store.set('settings', {
    ...settings,
    llmConnections: [connection],
    activeLlmConnectionId: id
  })
}

migrateToConnections()

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

// --- Encrypted API Keys (legacy: embeddings + llm) ---

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
  return !!store.get('encryptedKeys', {})[keyName]
}

export function getMaskedApiKey(keyName: 'embeddings' | 'llm'): string {
  const key = getApiKey(keyName)
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

// --- LLM Connections ---

export function getLlmConnections(): LLMConnection[] {
  return getSettings().llmConnections ?? []
}

export function getActiveConnection(): LLMConnection | null {
  const settings = getSettings()
  const id = settings.activeLlmConnectionId
  if (!id) return null
  return (settings.llmConnections ?? []).find((c) => c.id === id) ?? null
}

export function addLlmConnection(conn: Omit<LLMConnection, 'id'>, apiKey: string): LLMConnection {
  const id = randomUUID()
  const newConn: LLMConnection = { id, ...conn }
  const settings = getSettings()
  const connections = [...(settings.llmConnections ?? []), newConn]
  const activeLlmConnectionId = settings.activeLlmConnectionId ?? id
  store.set('settings', { ...settings, llmConnections: connections, activeLlmConnectionId })

  if (apiKey.trim()) {
    const keys = store.get('encryptedKeys', {})
    keys[`conn_${id}`] = encrypt(apiKey.trim())
    store.set('encryptedKeys', keys)
  }

  return newConn
}

export function deleteLlmConnection(id: string): void {
  const settings = getSettings()
  const connections = (settings.llmConnections ?? []).filter((c) => c.id !== id)
  let activeLlmConnectionId = settings.activeLlmConnectionId
  if (activeLlmConnectionId === id) {
    activeLlmConnectionId = connections[0]?.id ?? null
  }
  store.set('settings', { ...settings, llmConnections: connections, activeLlmConnectionId })

  const keys = store.get('encryptedKeys', {})
  delete keys[`conn_${id}`]
  store.set('encryptedKeys', keys)
}

export function setActiveLlmConnection(id: string): void {
  const settings = getSettings()
  const exists = (settings.llmConnections ?? []).some((c) => c.id === id)
  if (!exists) throw new Error(`Connection ${id} not found`)
  store.set('settings', { ...settings, activeLlmConnectionId: id })
}

export function getConnectionApiKey(connectionId: string): string {
  const keys = store.get('encryptedKeys', {})
  const encoded = keys[`conn_${connectionId}`]
  if (!encoded) return ''
  try {
    return decrypt(encoded)
  } catch {
    return ''
  }
}

export function getMaskedConnectionApiKey(connectionId: string): string {
  const key = getConnectionApiKey(connectionId)
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 4) + '••••' + key.slice(-4)
}
