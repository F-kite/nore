import { useState, useEffect, useCallback } from 'react'
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
    needsKey: true
  },
  {
    id: 'anthropic' as const,
    label: 'Anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'],
    needsKey: true
  },
  {
    id: 'ollama' as const,
    label: 'Ollama (Local)',
    models: ['llama3.1', 'mistral', 'gemma2', 'phi3'],
    needsKey: false
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

/** Convert internal shortcut format to display format */
function formatShortcut(shortcut: string, isMac: boolean): string {
  return shortcut
    .replace('CmdOrCtrl', isMac ? '⌘' : 'Ctrl')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace(/\+/g, isMac ? '' : '+')
}

/** Convert a keyboard event to internal shortcut string */
function keyEventToShortcut(e: KeyboardEvent): string | null {
  const key = e.key
  // Ignore modifier-only presses
  if (['Control', 'Meta', 'Shift', 'Alt'].includes(key)) return null

  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CmdOrCtrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  // Normalize key
  const normalizedKey = key.length === 1 ? key.toUpperCase() : key
  parts.push(normalizedKey)

  if (parts.length < 2) return null // must have at least one modifier
  return parts.join('+')
}

// --- Component ---

export function SettingsScreen({ state, onUpdate }: SettingsScreenProps) {
  const [isReindexing, setIsReindexing] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

  // API keys state
  const [embeddingsKeyMasked, setEmbeddingsKeyMasked] = useState('')
  const [llmKeyMasked, setLlmKeyMasked] = useState('')
  const [hasEmbeddingsKey, setHasEmbeddingsKey] = useState(false)
  const [hasLlmKey, setHasLlmKey] = useState(false)
  const [editingKey, setEditingKey] = useState<'embeddings' | 'llm' | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)

  // LLM provider state
  const [llmProvider, setLlmProvider] = useState<'openai' | 'anthropic' | 'ollama'>('openai')
  const [llmModel, setLlmModel] = useState('gpt-4o-mini')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')

  // Shortcuts state
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({})
  const [defaultShortcuts, setDefaultShortcuts] = useState<Record<string, string>>({})
  const [recordingShortcut, setRecordingShortcut] = useState<string | null>(null)

  // Platform
  const [isMac, setIsMac] = useState(false)

  // Load settings on mount
  useEffect(() => {
    async function load() {
      try {
        setIsMac(window.platform?.isMac ?? false)

        const settings = await window.settings.get()
        setLlmProvider(settings.llmProvider || 'openai')
        setLlmModel(settings.llmModel || 'gpt-4o-mini')
        setOllamaUrl(settings.llmBaseUrl || 'http://localhost:11434')
        setShortcuts(settings.shortcuts || {})

        const defaults = await window.settings.getDefaultShortcuts()
        setDefaultShortcuts(defaults)

        // Load API key status
        const [hasEmb, hasLlm, embMasked, llmMask] = await Promise.all([
          window.apiKeys.has('embeddings'),
          window.apiKeys.has('llm'),
          window.apiKeys.getMasked('embeddings'),
          window.apiKeys.getMasked('llm')
        ])
        setHasEmbeddingsKey(hasEmb)
        setHasLlmKey(hasLlm)
        setEmbeddingsKeyMasked(embMasked)
        setLlmKeyMasked(llmMask)
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
    }
    load()
  }, [])

  // Shortcut recording listener
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
      if (e.key === 'Escape') {
        setRecordingShortcut(null)
      }
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
    if (editingKey === 'embeddings') {
      setEmbeddingsKeyMasked(masked)
      setHasEmbeddingsKey(true)
    } else {
      setLlmKeyMasked(masked)
      setHasLlmKey(true)
    }
    setEditingKey(null)
    setKeyInput('')
    setShowKeyInput(false)
  }

  const handleRemoveApiKey = async (keyName: 'embeddings' | 'llm') => {
    await window.apiKeys.remove(keyName)
    if (keyName === 'embeddings') {
      setEmbeddingsKeyMasked('')
      setHasEmbeddingsKey(false)
    } else {
      setLlmKeyMasked('')
      setHasLlmKey(false)
    }
  }

  const handleProviderChange = useCallback(
    async (provider: 'openai' | 'anthropic' | 'ollama') => {
      const providerConfig = LLM_PROVIDERS.find((p) => p.id === provider)
      const model = providerConfig?.models[0] || ''
      setLlmProvider(provider)
      setLlmModel(model)
      await window.settings.update({ llmProvider: provider, llmModel: model })
    },
    []
  )

  const handleModelChange = useCallback(
    async (model: string) => {
      setLlmModel(model)
      await window.settings.update({ llmModel: model })
    },
    []
  )

  const handleOllamaUrlChange = useCallback(async (url: string) => {
    setOllamaUrl(url)
    await window.settings.update({ llmBaseUrl: url })
  }, [])

  const handleResetShortcut = useCallback(
    async (actionId: string) => {
      const defaultValue = defaultShortcuts[actionId]
      if (!defaultValue) return
      const updated = { ...shortcuts, [actionId]: defaultValue }
      setShortcuts(updated)
      await window.settings.update({ shortcuts: updated })
    },
    [shortcuts, defaultShortcuts]
  )

  const currentProvider = LLM_PROVIDERS.find((p) => p.id === llmProvider)

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-[640px] px-8 py-8">
        {/* ===== VAULT ===== */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            Vault
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-nore-text-secondary">Current vault path</p>
                <p className="mt-1 font-mono text-xs text-nore-text-tertiary">
                  {state.vaultPath || 'Not set'}
                </p>
              </div>
              <button
                onClick={handleChangeFolder}
                className="flex items-center gap-2 rounded-md border border-nore-border bg-transparent px-3 py-1.5 text-sm text-nore-text-primary transition-colors hover:bg-nore-elevated"
              >
                <Folder className="h-4 w-4" />
                Change folder
              </button>
            </div>
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
                className="flex items-center gap-2 rounded-md border border-nore-border bg-transparent px-3 py-1.5 text-sm text-nore-text-primary transition-colors hover:bg-nore-elevated disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isReindexing ? 'animate-spin' : ''}`} />
                {isReindexing ? 'Indexing...' : 'Re-index'}
              </button>
            </div>
          </div>
        </section>

        <div className="mb-8 h-px bg-nore-border" />

        {/* ===== INDEXING ===== */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            Indexing
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Status</p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  state.indexStatus === 'up-to-date'
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Total notes indexed</p>
              <p className="text-sm text-nore-text-primary">{state.noteCount}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Last indexed</p>
              <p className="text-sm text-nore-text-primary">{state.lastIndexed || 'Never'}</p>
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
            {/* Accent Color */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Accent color</p>
              <div className="flex items-center gap-2">
                {accentPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => onUpdate({ accentColor: preset.id })}
                    className="group relative h-6 w-6 rounded-full transition-transform hover:scale-110"
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
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="group relative h-6 w-6 rounded-full border-2 border-dashed border-nore-border transition-colors hover:border-nore-border-hover"
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
                  {showColorPicker && (
                    <div className="absolute right-0 top-8 z-10 rounded-md border border-nore-border bg-nore-elevated p-3 shadow-lg">
                      <input
                        type="color"
                        value={state.customAccentColor}
                        onChange={(e) =>
                          onUpdate({ accentColor: 'custom', customAccentColor: e.target.value })
                        }
                        className="h-8 w-24 cursor-pointer bg-transparent"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Font Size */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Font size</p>
              <div className="inline-flex rounded-md border border-nore-border bg-nore-base p-0.5">
                {fontSizeOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onUpdate({ fontSize: option.id })}
                    className={`rounded px-3 py-1 text-xs transition-colors ${
                      state.fontSize === option.id
                        ? 'bg-[var(--nore-accent)] text-white'
                        : 'text-nore-text-secondary hover:text-nore-text-primary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Numbers */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Show line numbers in editor</p>
              <button
                onClick={() => onUpdate({ showLineNumbers: !state.showLineNumbers })}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  state.showLineNumbers ? 'bg-[var(--nore-accent)]' : 'bg-nore-elevated'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    state.showLineNumbers ? 'left-[18px]' : 'left-0.5'
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
          <div className="space-y-4">
            {/* Provider selector */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Provider</p>
              <div className="inline-flex rounded-md border border-nore-border bg-nore-base p-0.5">
                {LLM_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleProviderChange(provider.id)}
                    className={`rounded px-3 py-1 text-xs transition-colors ${
                      llmProvider === provider.id
                        ? 'bg-[var(--nore-accent)] text-white'
                        : 'text-nore-text-secondary hover:text-nore-text-primary'
                    }`}
                  >
                    {provider.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model selector */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Model</p>
              <select
                value={llmModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="rounded-md border border-nore-border bg-nore-base px-3 py-1.5 text-sm text-nore-text-primary outline-none focus:border-[var(--nore-accent)]"
              >
                {currentProvider?.models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            {/* Ollama URL */}
            {llmProvider === 'ollama' && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-nore-text-secondary">Ollama endpoint</p>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => handleOllamaUrlChange(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-64 rounded-md border border-nore-border bg-nore-base px-3 py-1.5 text-sm text-nore-text-primary outline-none focus:border-[var(--nore-accent)]"
                />
              </div>
            )}
          </div>
        </section>

        <div className="mb-8 h-px bg-nore-border" />

        {/* ===== API KEYS ===== */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            API Keys
          </h2>
          <p className="mb-4 text-xs text-nore-text-tertiary">
            Keys are encrypted and stored locally on your device.
          </p>
          <div className="space-y-4">
            {/* Embeddings key (Mistral) */}
            <ApiKeyRow
              label="Embeddings key (Mistral)"
              hasKey={hasEmbeddingsKey}
              maskedKey={embeddingsKeyMasked}
              isEditing={editingKey === 'embeddings'}
              keyInput={keyInput}
              showInput={showKeyInput}
              onEdit={() => {
                setEditingKey('embeddings')
                setKeyInput('')
                setShowKeyInput(false)
              }}
              onSave={handleSaveApiKey}
              onCancel={() => setEditingKey(null)}
              onRemove={() => handleRemoveApiKey('embeddings')}
              onInputChange={setKeyInput}
              onToggleShow={() => setShowKeyInput(!showKeyInput)}
            />

            {/* LLM key (only for cloud providers) */}
            {currentProvider?.needsKey && (
              <ApiKeyRow
                label={`${currentProvider.label} API key`}
                hasKey={hasLlmKey}
                maskedKey={llmKeyMasked}
                isEditing={editingKey === 'llm'}
                keyInput={keyInput}
                showInput={showKeyInput}
                onEdit={() => {
                  setEditingKey('llm')
                  setKeyInput('')
                  setShowKeyInput(false)
                }}
                onSave={handleSaveApiKey}
                onCancel={() => setEditingKey(null)}
                onRemove={() => handleRemoveApiKey('llm')}
                onInputChange={setKeyInput}
                onToggleShow={() => setShowKeyInput(!showKeyInput)}
              />
            )}
          </div>
        </section>

        <div className="mb-8 h-px bg-nore-border" />

        {/* ===== KEYBOARD SHORTCUTS ===== */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            Keyboard Shortcuts
          </h2>
          <p className="mb-4 text-xs text-nore-text-tertiary">
            Click on a shortcut to reassign it. Press Escape to cancel.
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
                      className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                        isRecording
                          ? 'animate-pulse border-[var(--nore-accent)] bg-[var(--nore-accent-muted)] text-[var(--nore-accent)]'
                          : 'border-nore-border bg-nore-base text-nore-text-tertiary hover:border-nore-border-hover hover:text-nore-text-primary'
                      }`}
                    >
                      {isRecording ? 'Press keys...' : formatShortcut(shortcut, isMac)}
                    </button>
                    {!isDefault && (
                      <button
                        onClick={() => handleResetShortcut(id)}
                        className="text-nore-text-tertiary transition-colors hover:text-nore-text-secondary"
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
            <div>
              <button className="text-sm text-nore-text-secondary transition-colors hover:text-[var(--nore-accent)]">
                Check for updates
              </button>
            </div>
            <div className="flex gap-4">
              {['GitHub', 'Documentation', 'Report a bug'].map((label) => (
                <a
                  key={label}
                  href="#"
                  className="flex items-center gap-1.5 text-sm text-nore-text-secondary transition-colors hover:text-nore-text-primary"
                >
                  {label}
                  <ExternalLink className="h-3 w-3" />
                </a>
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
  label,
  hasKey,
  maskedKey,
  isEditing,
  keyInput,
  showInput,
  onEdit,
  onSave,
  onCancel,
  onRemove,
  onInputChange,
  onToggleShow
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
              className="w-full rounded-md border border-nore-border bg-nore-surface px-3 py-1.5 pr-8 font-mono text-xs text-nore-text-primary outline-none focus:border-[var(--nore-accent)]"
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
            className="rounded-md bg-[var(--nore-accent)] px-3 py-1.5 text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="text-nore-text-tertiary transition-colors hover:text-nore-text-primary"
          >
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
        {hasKey && (
          <p className="mt-1 font-mono text-xs text-nore-text-tertiary">{maskedKey}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="rounded-md border border-nore-border bg-transparent px-3 py-1.5 text-sm text-nore-text-primary transition-colors hover:bg-nore-elevated"
        >
          {hasKey ? 'Edit' : 'Add key'}
        </button>
        {hasKey && (
          <button
            onClick={onRemove}
            className="text-xs text-nore-text-tertiary transition-colors hover:text-red-400"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
