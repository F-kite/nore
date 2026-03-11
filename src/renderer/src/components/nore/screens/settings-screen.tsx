
import { useState } from "react"
import { Check, Folder, RefreshCw, ExternalLink, Eye, EyeOff } from "lucide-react"
import type { NoreState, AccentColor, FontSize } from "../nore-app"

interface SettingsScreenProps {
  state: NoreState
  onUpdate: (updates: Partial<NoreState>) => void
}

const accentPresets: { id: AccentColor; color: string; label: string }[] = [
  { id: "blue", color: "#4C8BF5", label: "Blue" },
  { id: "teal", color: "#14B8A6", label: "Teal" },
  { id: "green", color: "#22C55E", label: "Green" },
  { id: "amber", color: "#F59E0B", label: "Amber" },
  { id: "rose", color: "#F43F5E", label: "Rose" },
  { id: "violet", color: "#8B5CF6", label: "Violet" },
]

const fontSizeOptions: { id: FontSize; label: string }[] = [
  { id: "compact", label: "Compact" },
  { id: "default", label: "Default" },
  { id: "comfortable", label: "Comfortable" },
]

const keyboardShortcuts = [
  { action: "New Chat", shortcut: "Cmd+N" },
  { action: "Search Notes", shortcut: "Cmd+K" },
  { action: "Switch to Chat", shortcut: "Cmd+1" },
  { action: "Switch to Write", shortcut: "Cmd+2" },
  { action: "Open Settings", shortcut: "Cmd+," },
  { action: "Toggle Line Numbers", shortcut: "Cmd+Shift+L" },
]

export function SettingsScreen({ state, onUpdate }: SettingsScreenProps) {
  const [showVoyageKey, setShowVoyageKey] = useState(false)
  const [showLlmKey, setShowLlmKey] = useState(false)
  const [isReindexing, setIsReindexing] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const handleReindex = () => {
    setIsReindexing(true)
    setTimeout(() => {
      setIsReindexing(false)
    }, 2000)
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-[640px] px-8 py-8">
        {/* Vault Section */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            Vault
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-nore-text-secondary">Current vault path</p>
                <p className="mt-1 font-mono text-xs text-nore-text-tertiary">
                  {state.vaultPath}
                </p>
              </div>
              <button className="flex items-center gap-2 rounded-md border border-nore-border bg-transparent px-3 py-1.5 text-sm text-nore-text-primary hover:bg-nore-elevated transition-colors">
                Change folder
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-nore-text-secondary">Re-index vault</p>
                <p className="mt-1 text-xs text-nore-text-tertiary">
                  Last indexed: {state.lastIndexed}
                </p>
              </div>
              <button
                onClick={handleReindex}
                disabled={isReindexing}
                className="flex items-center gap-2 rounded-md border border-nore-border bg-transparent px-3 py-1.5 text-sm text-nore-text-primary hover:bg-nore-elevated transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isReindexing ? "animate-spin" : ""}`} />
                {isReindexing ? "Indexing..." : "Re-index"}
              </button>
            </div>
          </div>
        </section>

        <div className="mb-8 h-px bg-nore-border" />

        {/* Indexing Section */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            Indexing
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Status</p>
              <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-500">
                Up to date
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Total notes indexed</p>
              <p className="text-sm text-nore-text-primary">{state.noteCount}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Index size on disk</p>
              <p className="text-sm text-nore-text-primary">23.4 MB</p>
            </div>
          </div>
        </section>

        <div className="mb-8 h-px bg-nore-border" />

        {/* Appearance Section */}
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
                    className="group relative h-6 w-6 rounded-full border-2 border-dashed border-nore-border hover:border-nore-border-hover transition-colors"
                    style={state.accentColor === "custom" ? { backgroundColor: state.customAccentColor, borderStyle: "solid" } : undefined}
                    title="Custom color"
                  >
                    {state.accentColor === "custom" && (
                      <Check className="absolute inset-0 m-auto h-3 w-3 text-white" />
                    )}
                  </button>
                  {showColorPicker && (
                    <div className="absolute right-0 top-8 z-10 rounded-md border border-nore-border bg-nore-elevated p-3 shadow-lg">
                      <input
                        type="color"
                        value={state.customAccentColor}
                        onChange={(e) => onUpdate({ accentColor: "custom", customAccentColor: e.target.value })}
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
                        ? "bg-[var(--nore-accent)] text-white"
                        : "text-nore-text-secondary hover:text-nore-text-primary"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Numbers Toggle */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-nore-text-secondary">Show line numbers in editor</p>
              <button
                onClick={() => onUpdate({ showLineNumbers: !state.showLineNumbers })}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  state.showLineNumbers ? "bg-[var(--nore-accent)]" : "bg-nore-elevated"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    state.showLineNumbers ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        <div className="mb-8 h-px bg-nore-border" />

        {/* Keyboard Shortcuts Section */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            Keyboard Shortcuts
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {keyboardShortcuts.map(({ action, shortcut }) => (
              <div key={action} className="flex items-center justify-between">
                <p className="text-sm text-nore-text-secondary">{action}</p>
                <kbd className="rounded border border-nore-border bg-nore-base px-2 py-0.5 text-xs text-nore-text-tertiary">
                  {shortcut}
                </kbd>
              </div>
            ))}
          </div>
        </section>

        <div className="mb-8 h-px bg-nore-border" />

        {/* API Keys Section */}
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
            API Keys
          </h2>
          <div className="space-y-4">
            {/* Voyage AI Key */}
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-nore-text-secondary">Voyage AI key</p>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-mono text-xs text-nore-text-tertiary">
                    {showVoyageKey ? state.voyageApiKey : "••••••••••••••••"}
                  </p>
                  <button
                    onClick={() => setShowVoyageKey(!showVoyageKey)}
                    className="text-nore-text-tertiary hover:text-nore-text-secondary transition-colors"
                  >
                    {showVoyageKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="text-xs text-nore-text-secondary hover:text-[var(--nore-accent)] transition-colors">
                  Test connection
                </button>
                <button className="rounded-md border border-nore-border bg-transparent px-3 py-1.5 text-sm text-nore-text-primary hover:bg-nore-elevated transition-colors">
                  Edit
                </button>
              </div>
            </div>

            {/* LLM API Key */}
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-nore-text-secondary">LLM API key</p>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-mono text-xs text-nore-text-tertiary">
                    {showLlmKey ? state.llmApiKey : "••••••••••••••••"}
                  </p>
                  <button
                    onClick={() => setShowLlmKey(!showLlmKey)}
                    className="text-nore-text-tertiary hover:text-nore-text-secondary transition-colors"
                  >
                    {showLlmKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="text-xs text-nore-text-secondary hover:text-[var(--nore-accent)] transition-colors">
                  Test connection
                </button>
                <button className="rounded-md border border-nore-border bg-transparent px-3 py-1.5 text-sm text-nore-text-primary hover:bg-nore-elevated transition-colors">
                  Edit
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-8 h-px bg-nore-border" />

        {/* About Section */}
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
              <button className="text-sm text-nore-text-secondary hover:text-[var(--nore-accent)] transition-colors">
                Check for updates
              </button>
            </div>
            <div className="flex gap-4">
              <a
                href="#"
                className="flex items-center gap-1.5 text-sm text-nore-text-secondary hover:text-nore-text-primary transition-colors"
              >
                GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="#"
                className="flex items-center gap-1.5 text-sm text-nore-text-secondary hover:text-nore-text-primary transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="#"
                className="flex items-center gap-1.5 text-sm text-nore-text-secondary hover:text-nore-text-primary transition-colors"
              >
                Report a bug
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
