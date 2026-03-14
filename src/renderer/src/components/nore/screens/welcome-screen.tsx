import { useState } from 'react'
import { Folder, Database, Loader2, Check, ChevronRight, AlertCircle } from 'lucide-react'
import type { IndexingProgress } from '../../../../../types/index'

interface WelcomeScreenProps {
  onComplete: (config: {
    vaultPath: string
    vaultName: string
    lanceDbPath: string
    noteCount: number
  }) => void
}

type Step = 'vault' | 'lancedb' | 'indexing' | 'complete'

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [step, setStep] = useState<Step>('vault')
  const [vaultPath, setVaultPath] = useState('')
  const [noteCount, setNoteCount] = useState(0)
  const [lanceDbPath, setLanceDbPath] = useState('')
  const [defaultLanceDbPath, setDefaultLanceDbPath] = useState('')
  const [indexingProgress, setIndexingProgress] = useState(0)
  const [indexingStatus, setIndexingStatus] = useState('')
  const [error, setError] = useState('')

  const selectVaultFolder = async () => {
    try {
      const selected = await window.vault.selectFolder()
      if (selected) {
        setVaultPath(selected)
        setError('')

        // Count notes
        const files = await window.vault.loadFiles(selected)
        setNoteCount(files.length)

        // Get default LanceDB path
        const dbDefault = await window.vault.getDefaultDbPath()
        setDefaultLanceDbPath(dbDefault)
        if (!lanceDbPath) {
          setLanceDbPath(dbDefault)
        }
      }
    } catch (err) {
      setError('Failed to select folder')
    }
  }

  const selectLanceDbFolder = async () => {
    try {
      const selected = await window.vault.selectDbFolder()
      if (selected) {
        setLanceDbPath(selected)
        setError('')
      }
    } catch (err) {
      setError('Failed to select folder')
    }
  }

  const useDefaultPath = () => {
    setLanceDbPath(defaultLanceDbPath)
    setError('')
  }

  const proceedToLanceDb = () => {
    if (!vaultPath) {
      setError('Please select an Obsidian vault folder')
      return
    }
    setStep('lancedb')
    setError('')
  }

  const startIndexing = async () => {
    if (!lanceDbPath) {
      setError('Please select a folder for the vector database')
      return
    }
    setStep('indexing')
    setError('')
    setIndexingProgress(0)
    setIndexingStatus('Loading vault files...')

    try {
      // Save the custom DB path
      await window.vault.setDbPath(lanceDbPath)

      // Load files
      const files = await window.vault.loadFiles(vaultPath)
      setNoteCount(files.length)
      setIndexingStatus(`Indexing ${files.length} notes...`)

      // Listen to progress
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

      // Start indexing
      await window.indexing.start(vaultPath, files)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Indexing failed')
      setStep('lancedb')
    }
  }

  const finishSetup = () => {
    const vaultName = vaultPath.split(/[\\/]/).pop() || 'Vault'
    onComplete({
      vaultPath,
      vaultName,
      lanceDbPath,
      noteCount,
    })
  }

  const renderStepIndicator = () => {
    const steps = [
      { key: 'vault', label: 'Vault' },
      { key: 'lancedb', label: 'Database' },
      { key: 'indexing', label: 'Index' },
    ]

    const getCurrentStepIndex = () => {
      if (step === 'complete') return 3
      return steps.findIndex((s) => s.key === step)
    }

    const currentIndex = getCurrentStepIndex()

    return (
      <div className="mb-12 flex items-center justify-center gap-2">
        {steps.map((s, index) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                index < currentIndex
                  ? 'bg-[var(--nore-accent)] text-white'
                  : index === currentIndex
                    ? 'border-2 border-[var(--nore-accent)] text-[var(--nore-accent)]'
                    : 'border border-nore-border text-nore-text-tertiary'
              }`}
            >
              {index < currentIndex ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span
              className={`ml-2 text-sm ${
                index <= currentIndex ? 'text-nore-text-primary' : 'text-nore-text-tertiary'
              }`}
            >
              {s.label}
            </span>
            {index < steps.length - 1 && (
              <ChevronRight className="mx-3 h-4 w-4 text-nore-text-tertiary" />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-nore-base">
      <div className="w-full max-w-lg px-6">
        {/* Logo and Title */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-nore-elevated">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: 'var(--nore-accent)' }}
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-nore-text-primary">Welcome to Nore</h1>
          <p className="mt-2 text-sm text-nore-text-secondary">
            AI-powered assistant for your Obsidian knowledge base
          </p>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Step Content */}
        <div className="rounded-xl border border-nore-border bg-nore-surface p-6">
          {step === 'vault' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-nore-text-primary">
                  Select Obsidian Vault
                </h2>
                <p className="mt-1 text-sm text-nore-text-secondary">
                  Choose the folder containing your Obsidian knowledge base
                </p>
              </div>

              <button
                onClick={selectVaultFolder}
                className="flex w-full items-center gap-4 rounded-lg border border-dashed border-nore-border p-4 transition-colors hover:border-nore-border-hover hover:bg-nore-elevated"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-nore-elevated">
                  <Folder className="h-6 w-6 text-[var(--nore-accent)]" />
                </div>
                <div className="flex-1 text-left">
                  {vaultPath ? (
                    <>
                      <p className="text-sm font-medium text-nore-text-primary">
                        {vaultPath.split(/[\\/]/).pop()}
                      </p>
                      <p className="truncate text-xs text-nore-text-tertiary">{vaultPath}</p>
                      <p className="mt-1 text-xs text-nore-text-secondary">
                        {noteCount} notes found
                      </p>
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

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <button
                onClick={proceedToLanceDb}
                disabled={!vaultPath}
                className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: vaultPath ? 'var(--nore-accent)' : undefined
                }}
              >
                Continue
              </button>
            </div>
          )}

          {step === 'lancedb' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-nore-text-primary">
                  Vector Database Location
                </h2>
                <p className="mt-1 text-sm text-nore-text-secondary">
                  Choose where to store the LanceDB vector database
                </p>
              </div>

              <button
                onClick={selectLanceDbFolder}
                className="flex w-full items-center gap-4 rounded-lg border border-dashed border-nore-border p-4 transition-colors hover:border-nore-border-hover hover:bg-nore-elevated"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-nore-elevated">
                  <Database className="h-6 w-6 text-[var(--nore-accent)]" />
                </div>
                <div className="flex-1 text-left">
                  {lanceDbPath ? (
                    <>
                      <p className="text-sm font-medium text-nore-text-primary">
                        {lanceDbPath.split(/[\\/]/).pop()}
                      </p>
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
                  onClick={useDefaultPath}
                  className="w-full text-left text-xs text-nore-text-secondary hover:text-[var(--nore-accent)] transition-colors"
                >
                  Use default path: {defaultLanceDbPath}
                </button>
              )}

              <div className="rounded-lg bg-nore-elevated p-3">
                <p className="text-xs text-nore-text-secondary">
                  The vector database stores embeddings for semantic search. It will be created in
                  the selected folder and can be rebuilt at any time.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('vault')}
                  className="flex-1 rounded-lg border border-nore-border bg-transparent py-2.5 text-sm font-medium text-nore-text-primary transition-colors hover:bg-nore-elevated"
                >
                  Back
                </button>
                <button
                  onClick={startIndexing}
                  disabled={!lanceDbPath}
                  className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: lanceDbPath ? 'var(--nore-accent)' : undefined
                  }}
                >
                  Start Indexing
                </button>
              </div>
            </div>
          )}

          {step === 'indexing' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-medium text-nore-text-primary">
                  Indexing Knowledge Base
                </h2>
                <p className="mt-1 text-sm text-nore-text-secondary">
                  This may take a few minutes depending on vault size
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="relative">
                    <svg className="h-24 w-24 -rotate-90 transform">
                      <circle
                        cx="48"
                        cy="48"
                        r="42"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-nore-elevated"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="42"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={264}
                        strokeDashoffset={264 - (264 * indexingProgress) / 100}
                        style={{ color: 'var(--nore-accent)' }}
                        className="transition-all duration-300"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-semibold text-nore-text-primary">
                        {Math.round(indexingProgress)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-nore-text-secondary">
                  {indexingProgress < 100 && <Loader2 className="h-4 w-4 animate-spin" />}
                  {indexingProgress >= 100 && <Check className="h-4 w-4 text-green-500" />}
                  <span>{indexingStatus}</span>
                </div>
              </div>

              <div className="space-y-2 rounded-lg bg-nore-elevated p-3 text-xs text-nore-text-tertiary">
                <p>Vault: {vaultPath}</p>
                <p>Database: {lanceDbPath}</p>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <Check className="h-8 w-8 text-green-500" />
              </div>

              <div>
                <h2 className="text-lg font-medium text-nore-text-primary">Setup Complete!</h2>
                <p className="mt-1 text-sm text-nore-text-secondary">
                  Your knowledge base is ready to explore
                </p>
              </div>

              <div className="space-y-2 rounded-lg bg-nore-elevated p-4 text-left text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-nore-text-secondary">Vault</span>
                  <span className="text-nore-text-primary">
                    {vaultPath.split(/[\\/]/).pop()}
                  </span>
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
