import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Check,
  Folder,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  X,
  RotateCcw
} from 'lucide-react'
import { codeToKey } from '../nore-app'
import type { NoreState, AccentColor, FontSize } from '../nore-app'

interface SettingsScreenProps {
  state: NoreState
  onUpdate: (updates: Partial<NoreState>) => void
}

// --- Constants ---

const accentPresets: { id: AccentColor; color: string; label: string }[] = [
  { id: 'blue', color: '#4C8BF5', label: 'Blue' },
  { id: 'teal', color: '#14B8A6', label: 'Teal' },
  { id: 'green', color: '#22C55E', label: 'Green' },
  { id: 'amber', color: '#F59E0B', label: 'Amber' },
  { id: 'rose', color: '#F43F5E', label: 'Rose' },
  { id: 'violet', color: '#8B5CF6', label: 'Violet' }
]

const fontSizeOptions: { id: FontSize; label: string }[] = [
  { id: 'compact', label: 'Compact' },
  { id: 'default', label: 'Default' },
  { id: 'comfortable', label: 'Comfortable' }
]

const LLM_PROVIDERS = [
  {
    id: 'openai' as const,
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    needsKey: true,
    endpoint: 'api.openai.com'
  },
  {
    id: 'anthropic' as const,
    label: 'Anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'],
    needsKey: true,
    endpoint: 'api.anthropic.com'
  },
  {
    id: 'ollama' as const,
    label: 'Ollama',
    models: ['llama3.1', 'mistral', 'gemma2', 'phi3', 'qwen2.5'],
    needsKey: false,
    defaultUrl: 'http://localhost:11434'
  },
  {
    id: 'lmstudio' as const,
    label: 'LM Studio',
    models: [],
    needsKey: true,
    defaultUrl: 'http://localhost:1234'
  }
]

const SHORTCUT_ACTIONS = [
  { id: 'newChat', label: 'New Chat' },
  { id: 'searchNotes', label: 'Search Notes' },
  { id: 'switchChat', label: 'Switch to Chat' },
  { id: 'switchWrite', label: 'Switch to Write' },
  { id: 'openSettings', label: 'Open Settings' },
  { id: 'toggleLineNumbers', label: 'Toggle Line Numbers' }
]

// --- Helpers ---

function formatShortcut(shortcut: string, isMac: boolean): string {
  return shortcut
    .replace('CmdOrCtrl', isMac ? '⌘' : 'Ctrl')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace(/\+/g, isMac ? '' : '+')
}

function keyEventToShortcut(e: KeyboardEvent): string | null {
  if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return null
  // Use e.code to get the physical key, then convert to English name
  const englishKey = codeToKey(e.code)
  if (!englishKey) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CmdOrCtrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  parts.push(englishKey.length === 1 ? englishKey.toUpperCase() : englishKey)
  if (parts.length < 2) return null
  return parts.join('+')
}

// --- Component ---

export function SettingsScreen({ state, onUpdate }: SettingsScreenProps) {
  const [isReindexing, setIsReindexing] = useState(false)
  const [isCheckingApiConnection, setIsCheckingApiConnection] = useState(false)
  const [apiConnectionStatus, setApiConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [apiConnectionError, setApiConnectionError] = useState<string | null>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)

  // API keys state (embeddings only)
  const [embeddingsKeyMasked, setEmbeddingsKeyMasked] = useState('')
  const [hasEmbeddingsKey, setHasEmbeddingsKey] = useState(false)
  const [editingKey, setEditingKey] = useState<'embeddings' | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)

  // LLM connections state
  const [connections, setConnections] = useState<import('../../../../../types/index.d').LLMConnection[]>([])
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null)
  const [maskedKeys, setMaskedKeys] = useState<Record<string, string>>({})

  // Add-connection form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [formProvider, setFormProvider] = useState<'openai' | 'anthropic' | 'ollama' | 'lmstudio'>('openai')
  const [formModel, setFormModel] = useState('gpt-4o-mini')
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formBaseUrl, setFormBaseUrl] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [formShowKey, setFormShowKey] = useState(false)
  const [formSaving, setFormSaving] = useState(false)

  // Shortcuts state
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({})
  const [defaultShortcuts, setDefaultShortcuts] = useState<Record<string, string>>({})
  const [recordingShortcut, setRecordingShortcut] = useState<string | null>(null)

  // Platform
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        setIsMac(window.platform?.isMac ?? false)
        const settings = await window.settings.get()
        setShortcuts(settings.shortcuts || {})
        const [defaults, hasEmb, embMasked, conns] = await Promise.all([
          window.settings.getDefaultShortcuts(),
          window.apiKeys.has('embeddings'),
          window.apiKeys.getMasked('embeddings'),
          window.llm.getConnections()
        ])
        setDefaultShortcuts(defaults)
        setHasEmbeddingsKey(hasEmb)
        setEmbeddingsKeyMasked(embMasked)
        setConnections(conns)
        setActiveConnectionId(settings.activeLlmConnectionId ?? null)
        const masked = await Promise.all(conns.map(async (c) => [c.id, await window.llm.getMaskedConnectionKey(c.id)] as const))
        setMaskedKeys(Object.fromEntries(masked))
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!recordingShortcut) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const shortcut = keyEventToShortcut(e)
      if (shortcut) {
        const updated = { ...shortcuts, [recordingShortcut]: shortcut }
        setShortcuts(updated)
        setRecordingShortcut(null)
        window.settings.update({ shortcuts: updated })
      }
    }
    const cancel = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRecordingShortcut(null)
    }
    window.addEventListener('keydown', handler, true)
    window.addEventListener('keydown', cancel)
    return () => {
      window.removeEventListener('keydown', handler, true)
      window.removeEventListener('keydown', cancel)
    }
  }, [recordingShortcut, shortcuts])

  // --- Handlers ---

  const handleReindex = async () => {
    if (!state.vaultPath) return
    setIsReindexing(true)
    try {
      const files = await window.vault.loadFiles(state.vaultPath)
      await window.indexing.start(state.vaultPath, files)
    } catch (err) {
      console.error('Re-index failed:', err)
    } finally {
      setIsReindexing(false)
    }
  }

  const handleCheckingApiConnection = async () => {
    setIsCheckingApiConnection(true)
    setApiConnectionStatus('idle')
    setApiConnectionError(null)
    try {
      const result = await window.llm.checkConnection()
      if (result.ok) {
        setApiConnectionStatus('success')
      } else {
        setApiConnectionStatus('error')
        setApiConnectionError(result.error ?? 'Connection failed')
      }
    } catch (err) {
      setApiConnectionStatus('error')
      setApiConnectionError((err as Error).message)
    } finally {
      setIsCheckingApiConnection(false)
    }
  }

  const handleChangeFolder = async () => {
    const newPath = await window.vault.selectFolder()
    if (newPath) {
      const files = await window.vault.loadFiles(newPath)
      const vaultName = newPath.split(/[\\/]/).pop() || 'Vault'
      onUpdate({ vaultPath: newPath, vaultName, noteCount: files.length })
    }
  }

  const handleSaveApiKey = async () => {
    if (!editingKey || !keyInput.trim()) return
    await window.apiKeys.save(editingKey, keyInput.trim())
    const masked = await window.apiKeys.getMasked(editingKey)
    setEmbeddingsKeyMasked(masked)
    setHasEmbeddingsKey(true)
    setEditingKey(null)
    setKeyInput('')
    setShowKeyInput(false)
  }

  const handleRemoveApiKey = async () => {
    await window.apiKeys.remove('embeddings')
    setEmbeddingsKeyMasked('')
    setHasEmbeddingsKey(false)
  }

  const handleSetActive = async (id: string) => {
    await window.llm.setActiveConnection(id)
    setActiveConnectionId(id)
  }

  const handleDeleteConnection = async (id: string) => {
    await window.llm.deleteConnection(id)
    const updated = connections.filter((c) => c.id !== id)
    setConnections(updated)
    if (activeConnectionId === id) setActiveConnectionId(updated[0]?.id ?? null)
    setMaskedKeys((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  const handleAddConnection = async () => {
    const providerConfig = LLM_PROVIDERS.find((p) => p.id === formProvider)
    const isLocal = formProvider === 'ollama' || formProvider === 'lmstudio'
    setFormSaving(true)
    try {
      const newConn = await window.llm.addConnection(
        {
          displayName: formDisplayName.trim() || `${providerConfig?.label} – ${formModel}`,
          provider: formProvider,
          model: formModel,
          baseUrl: isLocal ? formBaseUrl : ''
        },
        formApiKey
      )
      const updatedConns = [...connections, newConn]
      setConnections(updatedConns)
      if (!activeConnectionId) setActiveConnectionId(newConn.id)
      const masked = await window.llm.getMaskedConnectionKey(newConn.id)
      setMaskedKeys((prev) => ({ ...prev, [newConn.id]: masked }))
      setShowAddForm(false)
      setFormApiKey('')
      setFormDisplayName('')
      setFormModel(LLM_PROVIDERS.find((p) => p.id === formProvider)?.models[0] || 'gpt-4o-mini')
      setFormProvider('openai')
      setFormBaseUrl('')
    } finally {
      setFormSaving(false)
    }
  }

  const handleResetShortcut = useCallback(async (actionId: string) => {
    const defaultValue = defaultShortcuts[actionId]
    if (!defaultValue) return
    const updated = { ...shortcuts, [actionId]: defaultValue }
    setShortcuts(updated)
    await window.settings.update({ shortcuts: updated })
  }, [shortcuts, defaultShortcuts])

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-160 px-8 py-8">

        {/* ===== VAULT ===== */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            Vault
          </h2>
          <div className="space-y-4">
            {/* Location */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-nore-text-secondary">Location</p>
                <p className="mt-1 font-mono text-xs text-nore-text-tertiary">
                  {state.vaultPath || 'Not set'}
                </p>
              </div>
              <button
                onClick={handleChangeFolder}
                className="flex items-center gap-2 rounded-md border border-nore-border bg-transparent px-3 py-1.5 text-sm text-nore-text-primary transition-colors cursor-pointer hover:bg-nore-elevated hover:text-(--nore-accent)"
              >
                <Folder className="h-4 w-4" />
                Change folder
              </button>
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Notes indexed</p>
              <div className="flex items-center gap-3">
                <span className="text-sm text-nore-text-primary">{state.noteCount}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${state.indexStatus === 'up-to-date'
                    ? 'bg-green-500/10 text-green-500'
                    : state.indexStatus === 'indexing'
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-red-500/10 text-red-500'
                    }`}
                >
                  {state.indexStatus === 'up-to-date'
                    ? 'Up to date'
                    : state.indexStatus === 'indexing'
                      ? 'Indexing...'
                      : 'Error'}
                </span>
              </div>
            </div>

            {/* Re-index */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-nore-text-secondary">Re-index vault</p>
                <p className="mt-1 text-xs text-nore-text-tertiary">
                  Last indexed: {state.lastIndexed || 'Never'}
                </p>
              </div>
              <button
                onClick={handleReindex}
                disabled={isReindexing}
                className="flex items-center gap-2 rounded-md border border-nore-border bg-transparent px-3 py-1.5 text-sm text-nore-text-primary transition-colors cursor-pointer hover:bg-nore-elevated disabled:opacity-50 hover:text-(--nore-accent)"
              >
                <RefreshCw className={`h-4 w-4 ${isReindexing ? 'animate-spin' : ''}`} />
                {isReindexing ? 'Indexing...' : 'Re-index'}
              </button>
            </div>

            {/* Embeddings API key */}
            <div className="pt-1">
              <p className="mb-2 text-xs text-nore-text-tertiary">
                Used for semantic search. Keys are encrypted and stored locally.
              </p>
              <ApiKeyRow
                label="Embeddings key (Mistral)"
                hasKey={hasEmbeddingsKey}
                maskedKey={embeddingsKeyMasked}
                isEditing={editingKey === 'embeddings'}
                keyInput={keyInput}
                showInput={showKeyInput}
                onEdit={() => { setEditingKey('embeddings'); setKeyInput(''); setShowKeyInput(false) }}
                onSave={handleSaveApiKey}
                onCancel={() => setEditingKey(null)}
                onRemove={handleRemoveApiKey}
                onInputChange={setKeyInput}
                onToggleShow={() => setShowKeyInput(!showKeyInput)}
              />
            </div>
          </div>
        </section>

        <div className="mb-8 h-px bg-nore-border" />

        {/* ===== APPEARANCE ===== */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            Appearance
          </h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Accent color</p>
              <div className="flex items-center gap-2">
                {accentPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => onUpdate({ accentColor: preset.id })}
                    className="group relative h-6 w-6 rounded-full transition-transform"
                    style={{ backgroundColor: preset.color }}
                    title={preset.label}
                  >
                    {state.accentColor === preset.id && (
                      <Check className="absolute inset-0 m-auto h-3 w-3 text-white" />
                    )}
                  </button>
                ))}
                <div className="relative">
                  <button
                    onClick={() => colorInputRef.current?.click()}
                    className="group relative h-6.5 w-6.5 rounded-full border-2 border-dashed border-nore-border transition-colors hover:border-nore-border-hover"
                    style={
                      state.accentColor === 'custom'
                        ? { backgroundColor: state.customAccentColor, borderStyle: 'solid' }
                        : undefined
                    }
                    title="Custom color"
                  >
                    {state.accentColor === 'custom' && (
                      <Check className="absolute inset-0 m-auto h-3 w-3 text-white" />
                    )}
                  </button>
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={state.customAccentColor}
                    onChange={(e) =>
                      onUpdate({ accentColor: 'custom', customAccentColor: e.target.value })
                    }
                    className="invisible absolute h-0 w-0"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Font size</p>
              <div className="inline-flex rounded-md border border-nore-border bg-nore-base p-0.5">
                {fontSizeOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onUpdate({ fontSize: option.id })}
                    className={`rounded px-3 py-1 text-xs transition-colors cursor-pointer ${state.fontSize === option.id
                      ? 'bg-(--nore-accent) text-white'
                      : 'text-nore-text-secondary hover:text-nore-text-primary hover:text-(--nore-accent)'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Show line numbers in editor</p>
              <button
                onClick={() => onUpdate({ showLineNumbers: !state.showLineNumbers })}
                className={`relative h-5 w-9 rounded-full transition-colors ${state.showLineNumbers ? 'bg-(--nore-accent)' : 'bg-nore-elevated'
                  }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${state.showLineNumbers ? 'left-4.5' : 'left-0.5'
                    }`}
                />
              </button>
            </div>
          </div>
        </section>

        <div className="mb-8 h-px bg-nore-border" />

        {/* ===== AI MODEL ===== */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            AI Model
          </h2>

          {/* Connections list */}
          <div className="mb-3 space-y-2">
            {connections.length === 0 && (
              <p className="text-sm text-nore-text-tertiary">No connections yet. Add one below.</p>
            )}
            {connections.map((conn) => {
              const isActive = conn.id === activeConnectionId
              const providerLabel = LLM_PROVIDERS.find((p) => p.id === conn.provider)?.label ?? conn.provider
              return (
                <div
                  key={conn.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2.5 transition-colors ${isActive ? 'border-(--nore-accent) bg-nore-elevated' : 'border-nore-border bg-nore-base'}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${isActive ? 'bg-(--nore-accent)' : 'bg-nore-border'}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-nore-text-primary">{conn.displayName}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="rounded bg-nore-surface px-1.5 py-0.5 text-xs text-nore-text-tertiary">{providerLabel}</span>
                        <span className="truncate text-xs text-nore-text-tertiary">{conn.model}</span>
                        {maskedKeys[conn.id] && (
                          <span className="font-mono text-xs text-nore-text-tertiary">{maskedKeys[conn.id]}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    {isActive
                      ? <span className="text-xs font-medium text-(--nore-accent)">Active</span>
                      : <button onClick={() => handleSetActive(conn.id)} className="cursor-pointer text-xs text-nore-text-tertiary transition-colors hover:text-(--nore-accent)">Set active</button>
                    }
                    <button onClick={() => handleDeleteConnection(conn.id)} className="cursor-pointer text-nore-text-tertiary transition-colors hover:text-red-400" title="Delete">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add connection form / button */}
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-dashed border-nore-border px-3 py-2 text-sm text-nore-text-tertiary transition-colors hover:border-(--nore-accent) hover:text-(--nore-accent)"
            >
              <span className="text-base leading-none">+</span>
              Add connection
            </button>
          ) : (
            <div className="space-y-3 rounded-md border border-nore-border bg-nore-base p-4">
              <p className="text-sm font-medium text-nore-text-primary">New connection</p>

              {/* Provider */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-nore-text-secondary">Provider</p>
                <div className="inline-flex rounded-md border border-nore-border bg-nore-surface p-0.5">
                  {LLM_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setFormProvider(p.id)
                        setFormModel(p.models[0] || '')
                        setFormBaseUrl('defaultUrl' in p ? (p.defaultUrl ?? '') : '')
                      }}
                      className={`cursor-pointer rounded px-3 py-1 text-xs transition-colors ${formProvider === p.id ? 'bg-(--nore-accent) text-white' : 'text-nore-text-secondary hover:text-(--nore-accent)'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-nore-text-secondary">Model</p>
                <input
                  list="add-conn-models"
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  placeholder="e.g. gpt-4o-mini"
                  className="w-56 rounded-md border border-nore-border bg-nore-surface px-3 py-1.5 text-sm text-nore-text-primary outline-none focus:border-(--nore-accent)"
                />
                <datalist id="add-conn-models">
                  {LLM_PROVIDERS.find((p) => p.id === formProvider)?.models.map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>

              {/* Display name */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-nore-text-secondary">Display name</p>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder={`My ${LLM_PROVIDERS.find((p) => p.id === formProvider)?.label ?? ''}`}
                  className="w-56 rounded-md border border-nore-border bg-nore-surface px-3 py-1.5 text-sm text-nore-text-primary outline-none focus:border-(--nore-accent)"
                />
              </div>

              {/* Base URL — local providers */}
              {(formProvider === 'ollama' || formProvider === 'lmstudio') && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-nore-text-secondary">Base URL</p>
                  <input
                    type="text"
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder={formProvider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234'}
                    className="w-56 rounded-md border border-nore-border bg-nore-surface px-3 py-1.5 text-sm text-nore-text-primary outline-none focus:border-(--nore-accent)"
                  />
                </div>
              )}

              {/* API key — cloud providers */}
              {LLM_PROVIDERS.find((p) => p.id === formProvider)?.needsKey && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-nore-text-secondary">API key</p>
                  <div className="relative w-56">
                    <input
                      type={formShowKey ? 'text' : 'password'}
                      value={formApiKey}
                      onChange={(e) => setFormApiKey(e.target.value)}
                      placeholder="Paste your API key..."
                      className="w-full rounded-md border border-nore-border bg-nore-surface px-3 py-1.5 pr-8 font-mono text-xs text-nore-text-primary outline-none focus:border-(--nore-accent)"
                    />
                    <button
                      onClick={() => setFormShowKey(!formShowKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-nore-text-tertiary hover:text-nore-text-secondary"
                    >
                      {formShowKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => { setShowAddForm(false); setFormApiKey('') }}
                  className="cursor-pointer px-3 py-1.5 text-sm text-nore-text-tertiary transition-colors hover:text-nore-text-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddConnection}
                  disabled={formSaving || !formModel.trim()}
                  className="cursor-pointer rounded-md bg-(--nore-accent) px-4 py-1.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {formSaving ? 'Saving...' : 'Save connection'}
                </button>
              </div>
            </div>
          )}

          {/* Check active connection */}
          {connections.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleCheckingApiConnection}
                disabled={isCheckingApiConnection}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-nore-border bg-transparent px-3 py-1.5 text-sm text-nore-text-primary transition-colors hover:bg-nore-elevated hover:text-(--nore-accent) disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isCheckingApiConnection ? 'animate-spin' : ''}`} />
                {isCheckingApiConnection ? 'Checking...' : 'Check active connection'}
              </button>
              {apiConnectionStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-sm text-green-500">
                  <Check className="h-4 w-4" />Connected
                </span>
              )}
              {apiConnectionStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-sm text-red-500" title={apiConnectionError ?? undefined}>
                  <X className="h-4 w-4" />{apiConnectionError ?? 'Failed'}
                </span>
              )}
            </div>
          )}
        </section>

        <div className="mb-8 h-px bg-nore-border" />

        {/* ===== KEYBOARD SHORTCUTS ===== */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            Keyboard Shortcuts
          </h2>
          <p className="mb-4 text-xs text-nore-text-tertiary">
            Click a shortcut to reassign it. Press Escape to cancel.
          </p>
          <div className="space-y-2">
            {SHORTCUT_ACTIONS.map(({ id, label }) => {
              const shortcut = shortcuts[id] || defaultShortcuts[id] || ''
              const isDefault = shortcut === defaultShortcuts[id]
              const isRecording = recordingShortcut === id
              return (
                <div key={id} className="flex items-center justify-between py-1">
                  <p className="text-sm text-nore-text-secondary">{label}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRecordingShortcut(isRecording ? null : id)}
                      className={`rounded border px-2.5 py-1 text-xs hover:text-(--nore-accent) transition-colors cursor-pointer ${isRecording
                        ? 'animate-pulse border-(--nore-accent) bg-(--nore-accent-muted) text-(--nore-accent)'
                        : 'border-nore-border bg-nore-base text-nore-text-tertiary hover:border-nore-border-hover hover:text-nore-text-primary'
                        }`}
                    >
                      {isRecording ? 'Press keys...' : formatShortcut(shortcut, isMac)}
                    </button>
                    {!isDefault && (
                      <button
                        onClick={() => handleResetShortcut(id)}
                        className="text-nore-text-tertiary transition-colors hover:text-nore-text-secondary cursor-pointer hover:text-(--nore-accent)"
                        title="Reset to default"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="mb-8 h-px bg-nore-border" />

        {/* ===== ABOUT ===== */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            About
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Version</p>
              <p className="text-sm text-nore-text-tertiary">v0.1.0</p>
            </div>
            <div className="flex gap-4">
              {['GitHub', 'Documentation', 'Report a bug'].map((label) => (
                <button
                  key={label}
                  onClick={() => { }}
                  className="rounded-md flex align-center items-center gap-1.5 border border-nore-border bg-transparent px-3 py-1.5 text-sm text-nore-text-primary transition-colors cursor-pointer hover:bg-nore-elevated  hover:text-(--nore-accent)"
                >
                  {label}
                  <ExternalLink className="h-3 w-3" />
                </button>
                // <a

                //   href="#"
                //   className="flex items-center gap-1.5 text-sm text-nore-text-secondary transition-colors hover:text-(--nore-accent)"
                // >


                // </a>
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}

// --- Subcomponent: API Key Row ---

interface ApiKeyRowProps {
  label: string
  hasKey: boolean
  maskedKey: string
  isEditing: boolean
  keyInput: string
  showInput: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onRemove: () => void
  onInputChange: (value: string) => void
  onToggleShow: () => void
}

function ApiKeyRow({
  label, hasKey, maskedKey, isEditing, keyInput, showInput,
  onEdit, onSave, onCancel, onRemove, onInputChange, onToggleShow
}: ApiKeyRowProps) {
  if (isEditing) {
    return (
      <div className="rounded-md border border-nore-border bg-nore-base p-3">
        <p className="mb-2 text-sm text-nore-text-secondary">{label}</p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={showInput ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSave()}
              placeholder="Paste your API key..."
              autoFocus
              className="w-full rounded-md border border-nore-border bg-nore-surface px-3 py-1.5 pr-8 font-mono text-xs text-nore-text-primary outline-none focus:border-(--nore-accent)"
            />
            <button
              onClick={onToggleShow}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-nore-text-tertiary hover:text-nore-text-secondary"
            >
              {showInput ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <button
            onClick={onSave}
            disabled={!keyInput.trim()}
            className="rounded-md bg-(--nore-accent) px-3 py-1.5 text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
          <button onClick={onCancel} className="text-nore-text-tertiary transition-colors hover:text-nore-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm text-nore-text-secondary">{label}</p>
          {hasKey && <Check className="h-3.5 w-3.5 text-green-500" />}
        </div>
        {hasKey && <p className="mt-1 font-mono text-xs text-nore-text-tertiary">{maskedKey}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="rounded-md border border-nore-border bg-transparent px-3 py-1.5 text-sm text-nore-text-primary transition-colors cursor-pointer hover:bg-nore-elevated  hover:text-(--nore-accent)"
        >
          {hasKey ? 'Edit' : 'Add key'}
        </button>
        {hasKey && (
          <button onClick={onRemove} className="text-xs text-nore-text-tertiary transition-colors hover:text-red-400">
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
