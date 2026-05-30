import { useState } from 'react'
import { Folder, Database, Loader2, Check, ChevronRight, AlertCircle, Eye, EyeOff, Key } from 'lucide-react'
import type { IndexingProgress } from '../../../../../types/index'

interface WelcomeScreenProps {
  onComplete: (config: {
    vaultPath: string
    vaultName: string
    lanceDbPath: string
    noteCount: number
  }) => void
}

type Step = 'vault' | 'apikeys' | 'lancedb' | 'indexing' | 'complete'

type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | ''

const PROVIDER_DEFAULTS: Record<string, { model: string; baseUrl: string; needsKey: boolean }> = {
  openai: { model: 'gpt-4o-mini', baseUrl: '', needsKey: true },
  anthropic: { model: 'claude-haiku-4-5-20251001', baseUrl: '', needsKey: true },
  ollama: { model: 'llama3.1', baseUrl: 'http://localhost:11434', needsKey: false },
  lmstudio: { model: '', baseUrl: 'http://localhost:1234', needsKey: false }
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [step, setStep] = useState<Step>('vault')
  const [error, setError] = useState('')

  // Vault step
  const [vaultPath, setVaultPath] = useState('')
  const [noteCount, setNoteCount] = useState(0)

  // API Keys step
  const [mistralKey, setMistralKey] = useState('')
  const [showMistralKey, setShowMistralKey] = useState(false)
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('')
  const [llmKey, setLlmKey] = useState('')
  const [showLlmKey, setShowLlmKey] = useState(false)
  const [llmModel, setLlmModel] = useState('')
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [savingKeys, setSavingKeys] = useState(false)

  // LanceDB step
  const [lanceDbPath, setLanceDbPath] = useState('')
  const [defaultLanceDbPath, setDefaultLanceDbPath] = useState('')

  // Indexing step
  const [indexingProgress, setIndexingProgress] = useState(0)
  const [indexingStatus, setIndexingStatus] = useState('')

  // --- Vault ---

  const selectVaultFolder = async () => {
    try {
      const selected = await window.vault.selectFolder()
      if (selected) {
        setVaultPath(selected)
        setError('')
        const files = await window.vault.loadFiles(selected)
        setNoteCount(files.length)
        const dbDefault = await window.vault.getDefaultDbPath()
        setDefaultLanceDbPath(dbDefault)
        if (!lanceDbPath) setLanceDbPath(dbDefault)
      }
    } catch {
      setError('Failed to select folder')
    }
  }

  const proceedToApiKeys = () => {
    if (!vaultPath) { setError('Please select an Obsidian vault folder'); return }
    setError('')
    setStep('apikeys')
  }

  // --- API Keys ---

  const handleProviderChange = (provider: LLMProvider) => {
    setLlmProvider(provider)
    setLlmKey('')
    if (provider && PROVIDER_DEFAULTS[provider]) {
      const defaults = PROVIDER_DEFAULTS[provider]
      setLlmModel(defaults.model)
      setLlmBaseUrl(defaults.baseUrl)
    } else {
      setLlmModel('')
      setLlmBaseUrl('')
    }
  }

  const saveApiKeysAndContinue = async () => {
    if (!mistralKey.trim()) { setError('Mistral API key is required for indexing your notes'); return }
    setError('')
    setSavingKeys(true)
    try {
      await window.apiKeys.save('embeddings', mistralKey.trim())

      if (llmProvider) {
        const providerDefaults = PROVIDER_DEFAULTS[llmProvider]
        const needsKey = providerDefaults?.needsKey ?? true
        if (!needsKey || llmKey.trim()) {
          await window.llm.addConnection(
            {
              displayName: llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1),
              provider: llmProvider,
              model: llmModel.trim() || providerDefaults?.model || '',
              baseUrl: llmBaseUrl.trim() || providerDefaults?.baseUrl || ''
            },
            llmKey.trim()
          )
        }
      }

      setStep('lancedb')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save keys')
    } finally {
      setSavingKeys(false)
    }
  }

  // --- LanceDB ---

  const selectLanceDbFolder = async () => {
    try {
      const selected = await window.vault.selectDbFolder()
      if (selected) { setLanceDbPath(selected); setError('') }
    } catch {
      setError('Failed to select folder')
    }
  }

  const startIndexing = async () => {
    if (!lanceDbPath) { setError('Please select a folder for the vector database'); return }
    setStep('indexing')
    setError('')
    setIndexingProgress(0)
    setIndexingStatus('Loading vault files...')

    try {
      await window.vault.setDbPath(lanceDbPath)
      const files = await window.vault.loadFiles(vaultPath)
      setNoteCount(files.length)
      setIndexingStatus(`Indexing ${files.length} notes...`)

      window.indexing.onProgress((progress: IndexingProgress) => {
        if (progress.total > 0) {
          const pct = Math.round((progress.processed / progress.total) * 100)
          setIndexingProgress(pct)
          setIndexingStatus(`Indexing... ${progress.processed} / ${progress.total} notes`)
        }
        if (progress.status === 'done') {
          setIndexingProgress(100)
          setIndexingStatus('Indexing complete!')
          setTimeout(() => setStep('complete'), 1000)
        }
        if (progress.status === 'error') {
          setError(progress.error || 'Indexing failed')
          setStep('lancedb')
        }
      })

      await window.indexing.start(vaultPath, files)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Indexing failed')
      setStep('lancedb')
    }
  }

  const finishSetup = () => {
    onComplete({ vaultPath, vaultName: vaultPath.split(/[\\/]/).pop() || 'Vault', lanceDbPath, noteCount })
  }

  // --- Step indicator ---

  const STEPS = [
    { key: 'vault', label: 'Vault' },
    { key: 'apikeys', label: 'API Keys' },
    { key: 'lancedb', label: 'Database' },
    { key: 'indexing', label: 'Index' }
  ]

  const currentStepIndex = step === 'complete' ? STEPS.length : STEPS.findIndex((s) => s.key === step)

  // --- Render ---

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-nore-base">
      <div className="w-full max-w-lg px-6">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-nore-elevated">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--nore-accent)' }}>
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-nore-text-primary">Welcome to Nore</h1>
          <p className="mt-2 text-sm text-nore-text-secondary">AI-powered assistant for your Obsidian knowledge base</p>
        </div>

        {/* Step indicator */}
        {step !== 'complete' && (
          <div className="mb-8 flex items-center justify-center gap-2">
            {STEPS.map((s, index) => (
              <div key={s.key} className="flex items-center">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  index < currentStepIndex
                    ? 'bg-(--nore-accent) text-white'
                    : index === currentStepIndex
                      ? 'border-2 border-(--nore-accent) text-(--nore-accent)'
                      : 'border border-nore-border text-nore-text-tertiary'
                }`}>
                  {index < currentStepIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <span className={`ml-1.5 text-sm ${index <= currentStepIndex ? 'text-nore-text-primary' : 'text-nore-text-tertiary'}`}>
                  {s.label}
                </span>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="mx-2 h-4 w-4 text-nore-text-tertiary" />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-nore-border bg-nore-surface p-6">

          {/* ── VAULT ── */}
          {step === 'vault' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-nore-text-primary">Select Obsidian Vault</h2>
                <p className="mt-1 text-sm text-nore-text-secondary">Choose the folder containing your Obsidian knowledge base</p>
              </div>
              <button
                onClick={selectVaultFolder}
                className="flex w-full items-center gap-4 rounded-lg border border-dashed border-nore-border p-4 transition-colors hover:border-nore-border-hover hover:bg-nore-elevated"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-nore-elevated">
                  <Folder className="h-6 w-6 text-(--nore-accent)" />
                </div>
                <div className="flex-1 text-left">
                  {vaultPath ? (
                    <>
                      <p className="text-sm font-medium text-nore-text-primary">{vaultPath.split(/[\\/]/).pop()}</p>
                      <p className="truncate text-xs text-nore-text-tertiary">{vaultPath}</p>
                      <p className="mt-1 text-xs text-nore-text-secondary">{noteCount} notes found</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-nore-text-secondary">Click to select folder</p>
                      <p className="text-xs text-nore-text-tertiary">Browse your file system</p>
                    </>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-nore-text-tertiary" />
              </button>
              {error && <div className="flex items-center gap-2 text-sm text-red-400"><AlertCircle className="h-4 w-4" />{error}</div>}
              <button
                onClick={proceedToApiKeys}
                disabled={!vaultPath}
                className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: vaultPath ? 'var(--nore-accent)' : undefined }}
              >
                Continue
              </button>
            </div>
          )}

          {/* ── API KEYS ── */}
          {step === 'apikeys' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-medium text-nore-text-primary">API Keys</h2>
                <p className="mt-1 text-sm text-nore-text-secondary">
                  Nore needs two keys: one for indexing your notes, one for AI chat.
                </p>
              </div>

              {/* Mistral key — required */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-(--nore-accent)" />
                  <label className="text-sm font-medium text-nore-text-primary">
                    Mistral API key <span className="text-red-400">*</span>
                  </label>
                </div>
                <p className="text-xs text-nore-text-tertiary">
                  Used to embed your notes for semantic search. Get a key at{' '}
                  <span className="text-nore-text-secondary">console.mistral.ai</span>
                </p>
                <div className="relative">
                  <input
                    type={showMistralKey ? 'text' : 'password'}
                    value={mistralKey}
                    onChange={(e) => setMistralKey(e.target.value)}
                    placeholder="Paste your Mistral API key..."
                    className="w-full rounded-md border border-nore-border bg-nore-base px-3 py-2 pr-9 font-mono text-sm text-nore-text-primary outline-none transition-colors focus:border-(--nore-accent) placeholder:text-nore-text-tertiary"
                  />
                  <button
                    onClick={() => setShowMistralKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nore-text-tertiary hover:text-nore-text-secondary"
                  >
                    {showMistralKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* LLM connection — optional */}
              <div className="space-y-2 rounded-lg border border-nore-border bg-nore-base p-4">
                <div className="flex items-center gap-1.5">
                  <label className="text-sm font-medium text-nore-text-primary">AI Model</label>
                  <span className="rounded bg-nore-elevated px-1.5 py-0.5 text-xs text-nore-text-tertiary">optional</span>
                </div>
                <p className="text-xs text-nore-text-tertiary">
                  For AI chat. You can add or change this later in Settings.
                </p>

                <select
                  value={llmProvider}
                  onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
                  className="w-full rounded-md border border-nore-border bg-nore-surface px-3 py-2 text-sm text-nore-text-primary outline-none focus:border-(--nore-accent)"
                >
                  <option value="">— Skip for now —</option>
                  <option value="openai">OpenAI (GPT)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="ollama">Ollama (local)</option>
                  <option value="lmstudio">LM Studio (local)</option>
                </select>

                {llmProvider && (
                  <div className="space-y-2 pt-1">
                    {/* Model name */}
                    <input
                      type="text"
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      placeholder="Model name"
                      className="w-full rounded-md border border-nore-border bg-nore-surface px-3 py-1.5 font-mono text-sm text-nore-text-primary outline-none focus:border-(--nore-accent) placeholder:text-nore-text-tertiary"
                    />
                    {/* API key (cloud providers) */}
                    {PROVIDER_DEFAULTS[llmProvider]?.needsKey && (
                      <div className="relative">
                        <input
                          type={showLlmKey ? 'text' : 'password'}
                          value={llmKey}
                          onChange={(e) => setLlmKey(e.target.value)}
                          placeholder="API key"
                          className="w-full rounded-md border border-nore-border bg-nore-surface px-3 py-1.5 pr-9 font-mono text-sm text-nore-text-primary outline-none focus:border-(--nore-accent) placeholder:text-nore-text-tertiary"
                        />
                        <button
                          onClick={() => setShowLlmKey((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nore-text-tertiary hover:text-nore-text-secondary"
                        >
                          {showLlmKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}
                    {/* Base URL (local providers) */}
                    {!PROVIDER_DEFAULTS[llmProvider]?.needsKey && (
                      <input
                        type="text"
                        value={llmBaseUrl}
                        onChange={(e) => setLlmBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="w-full rounded-md border border-nore-border bg-nore-surface px-3 py-1.5 font-mono text-sm text-nore-text-primary outline-none focus:border-(--nore-accent) placeholder:text-nore-text-tertiary"
                      />
                    )}
                  </div>
                )}
              </div>

              {error && <div className="flex items-center gap-2 text-sm text-red-400"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('vault'); setError('') }}
                  className="flex-1 rounded-lg border border-nore-border bg-transparent py-2.5 text-sm font-medium text-nore-text-primary transition-colors hover:bg-nore-elevated"
                >
                  Back
                </button>
                <button
                  onClick={saveApiKeysAndContinue}
                  disabled={!mistralKey.trim() || savingKeys}
                  className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: mistralKey.trim() ? 'var(--nore-accent)' : undefined }}
                >
                  {savingKeys ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {/* ── LANCEDB ── */}
          {step === 'lancedb' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-nore-text-primary">Vector Database Location</h2>
                <p className="mt-1 text-sm text-nore-text-secondary">Choose where to store the LanceDB vector database</p>
              </div>
              <button
                onClick={selectLanceDbFolder}
                className="flex w-full items-center gap-4 rounded-lg border border-dashed border-nore-border p-4 transition-colors hover:border-nore-border-hover hover:bg-nore-elevated"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-nore-elevated">
                  <Database className="h-6 w-6 text-(--nore-accent)" />
                </div>
                <div className="flex-1 text-left">
                  {lanceDbPath ? (
                    <>
                      <p className="text-sm font-medium text-nore-text-primary">{lanceDbPath.split(/[\\/]/).pop()}</p>
                      <p className="truncate text-xs text-nore-text-tertiary">{lanceDbPath}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-nore-text-secondary">Click to select folder</p>
                      <p className="text-xs text-nore-text-tertiary">Recommended: near your vault</p>
                    </>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-nore-text-tertiary" />
              </button>
              {defaultLanceDbPath && lanceDbPath !== defaultLanceDbPath && (
                <button
                  onClick={() => setLanceDbPath(defaultLanceDbPath)}
                  className="w-full text-left text-xs text-nore-text-secondary transition-colors hover:text-(--nore-accent)"
                >
                  Use default: {defaultLanceDbPath}
                </button>
              )}
              <div className="rounded-lg bg-nore-elevated p-3">
                <p className="text-xs text-nore-text-secondary">
                  The vector database stores embeddings for semantic search. It can be rebuilt at any time.
                </p>
              </div>
              {error && <div className="flex items-center gap-2 text-sm text-red-400"><AlertCircle className="h-4 w-4" />{error}</div>}
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('apikeys'); setError('') }}
                  className="flex-1 rounded-lg border border-nore-border bg-transparent py-2.5 text-sm font-medium text-nore-text-primary transition-colors hover:bg-nore-elevated"
                >
                  Back
                </button>
                <button
                  onClick={startIndexing}
                  disabled={!lanceDbPath}
                  className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: lanceDbPath ? 'var(--nore-accent)' : undefined }}
                >
                  Start Indexing
                </button>
              </div>
            </div>
          )}

          {/* ── INDEXING ── */}
          {step === 'indexing' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-medium text-nore-text-primary">Indexing Knowledge Base</h2>
                <p className="mt-1 text-sm text-nore-text-secondary">This may take a few minutes depending on vault size</p>
              </div>
              <div className="flex justify-center">
                <div className="relative">
                  <svg className="h-24 w-24 -rotate-90 transform">
                    <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-nore-elevated" />
                    <circle
                      cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                      strokeLinecap="round" strokeDasharray={264}
                      strokeDashoffset={264 - (264 * indexingProgress) / 100}
                      style={{ color: 'var(--nore-accent)' }}
                      className="transition-all duration-300"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-semibold text-nore-text-primary">{Math.round(indexingProgress)}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-nore-text-secondary">
                {indexingProgress < 100 && <Loader2 className="h-4 w-4 animate-spin" />}
                {indexingProgress >= 100 && <Check className="h-4 w-4 text-green-500" />}
                <span>{indexingStatus}</span>
              </div>
              <div className="space-y-1 rounded-lg bg-nore-elevated p-3 text-xs text-nore-text-tertiary">
                <p>Vault: {vaultPath}</p>
                <p>Database: {lanceDbPath}</p>
              </div>
            </div>
          )}

          {/* ── COMPLETE ── */}
          {step === 'complete' && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-nore-text-primary">Setup Complete!</h2>
                <p className="mt-1 text-sm text-nore-text-secondary">Your knowledge base is ready to explore</p>
              </div>
              <div className="space-y-2 rounded-lg bg-nore-elevated p-4 text-left text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-nore-text-secondary">Vault</span>
                  <span className="text-nore-text-primary">{vaultPath.split(/[\\/]/).pop()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-nore-text-secondary">Notes indexed</span>
                  <span className="text-nore-text-primary">{noteCount}</span>
                </div>
              </div>
              <button
                onClick={finishSetup}
                className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: 'var(--nore-accent)' }}
              >
                Get Started
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-nore-text-tertiary">Nore v0.1.0</p>
      </div>
    </div>
  )
}
