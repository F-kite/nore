import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, PenLine, Settings, Search, Minus, Square, X } from 'lucide-react'
import { ChatScreen } from './screens/chat-screen'
import { WriteScreen } from './screens/write-screen'
import { SettingsScreen } from './screens/settings-screen'
import { WelcomeScreen } from './screens/welcome-screen'
import { SearchModal, type OpenMode } from './search-modal'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@renderer/components/ui/tooltip'

export type Screen = 'chat' | 'write' | 'settings'
export type AccentColor = 'blue' | 'teal' | 'green' | 'amber' | 'rose' | 'violet' | 'custom'
export type FontSize = 'compact' | 'default' | 'comfortable'

const accentColors: Record<AccentColor, string> = {
  blue: '#4C8BF5',
  teal: '#14B8A6',
  green: '#22C55E',
  amber: '#F59E0B',
  rose: '#F43F5E',
  violet: '#8B5CF6',
  custom: '#4C8BF5'
}

const fontSizes: Record<FontSize, string> = {
  compact: '13px',
  default: '14px',
  comfortable: '16px'
}

export interface NoreState {
  loading: boolean
  isOnboarded: boolean
  screen: Screen
  searchOpen: boolean
  accentColor: AccentColor
  customAccentColor: string
  fontSize: FontSize
  vaultPath: string
  vaultName: string
  lanceDbPath: string
  noteCount: number
  tagCount: number
  backlinkCount: number
  lastIndexed: string
  voyageApiKey: string
  llmApiKey: string
  showLineNumbers: boolean
  indexStatus: 'up-to-date' | 'indexing' | 'error'
  selectedNoteForWrite: { title: string; content: string } | null
}

export function NoreApp() {
  const [state, setState] = useState<NoreState>({
    loading: true,
    isOnboarded: false,
    screen: 'chat',
    searchOpen: false,
    accentColor: 'blue',
    customAccentColor: '#4C8BF5',
    fontSize: 'default',
    vaultPath: '',
    vaultName: '',
    lanceDbPath: '',
    noteCount: 0,
    tagCount: 0,
    backlinkCount: 0,
    lastIndexed: '',
    voyageApiKey: '',
    llmApiKey: '',
    showLineNumbers: true,
    indexStatus: 'up-to-date',
    selectedNoteForWrite: null
  })

  // On mount: check if vault is already configured
  // On mount: check if vault is already configured + listen to indexing progress
  useEffect(() => {
    async function init() {
      try {
        const savedPath = await window.vault.getSavedPath()
        if (savedPath) {
          const files = await window.vault.loadFiles(savedPath)
          const vaultName = savedPath.split(/[\\/]/).pop() || 'Vault'

          // Check current indexing status
          const progress = await window.indexing.getProgress()

          setState((s) => ({
            ...s,
            loading: false,
            isOnboarded: true,
            vaultPath: savedPath,
            vaultName,
            noteCount: files.length,
            indexStatus: progress.status === 'done' ? 'up-to-date'
              : progress.status === 'indexing' ? 'indexing'
                : progress.status === 'error' ? 'error'
                  : 'up-to-date'
          }))
        } else {
          setState((s) => ({ ...s, loading: false }))
        }
      } catch {
        setState((s) => ({ ...s, loading: false }))
      }
    }

    init()

    // Listen to indexing progress updates from main process
    window.indexing.onProgress((progress) => {
      setState((s) => ({
        ...s,
        indexStatus: progress.status === 'done' ? 'up-to-date'
          : progress.status === 'indexing' ? 'indexing'
            : progress.status === 'error' ? 'error'
              : s.indexStatus,
        lastIndexed: progress.status === 'done' ? 'Just now' : s.lastIndexed
      }))

      // When indexing completes, refresh the note count
      if (progress.status === 'done') {
        window.vault.getSavedPath().then(async (path) => {
          if (path) {
            const files = await window.vault.loadFiles(path)
            setState((s) => ({ ...s, noteCount: files.length }))
          }
        })
      }
    })
  }, [])

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback(
    (config: { vaultPath: string; vaultName: string; lanceDbPath: string; noteCount: number }) => {
      setState((s) => ({
        ...s,
        isOnboarded: true,
        vaultPath: config.vaultPath,
        vaultName: config.vaultName,
        lanceDbPath: config.lanceDbPath,
        noteCount: config.noteCount,
        lastIndexed: 'Just now',
        indexStatus: 'up-to-date'
      }))
    },
    []
  )

  // Apply accent color to CSS variable
  useEffect(() => {
    const color =
      state.accentColor === 'custom' ? state.customAccentColor : accentColors[state.accentColor]
    document.documentElement.style.setProperty('--nore-accent', color)
    document.documentElement.style.setProperty('--nore-accent-muted', `${color}20`)
  }, [state.accentColor, state.customAccentColor])

  // Apply font size
  useEffect(() => {
    document.documentElement.style.setProperty('--nore-font-size', fontSizes[state.fontSize])
    document.documentElement.style.fontSize = fontSizes[state.fontSize]
  }, [state.fontSize])

  // Keyboard shortcuts (only when onboarded)
  useEffect(() => {
    if (!state.isOnboarded) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === 'k') {
        e.preventDefault()
        setState((s) => ({ ...s, searchOpen: true }))
      }
      if (isMod && e.key === '1') {
        e.preventDefault()
        setState((s) => ({ ...s, screen: 'chat' }))
      }
      if (isMod && e.key === '2') {
        e.preventDefault()
        setState((s) => ({ ...s, screen: 'write' }))
      }
      if (isMod && e.key === ',') {
        e.preventDefault()
        setState((s) => ({ ...s, screen: 'settings' }))
      }
      if (isMod && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        setState((s) => ({ ...s, showLineNumbers: !s.showLineNumbers }))
      }
      if (e.key === 'Escape' && state.searchOpen) {
        setState((s) => ({ ...s, searchOpen: false }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.isOnboarded, state.searchOpen])

  const setScreen = useCallback((screen: Screen) => {
    setState((s) => ({ ...s, screen }))
  }, [])

  const openSearch = useCallback(() => {
    setState((s) => ({ ...s, searchOpen: true }))
  }, [])

  const closeSearch = useCallback(() => {
    setState((s) => ({ ...s, searchOpen: false }))
  }, [])

  const updateSettings = useCallback((updates: Partial<NoreState>) => {
    setState((s) => ({ ...s, ...updates }))
  }, [])

  const isMac = window.platform?.isMac ?? false

  const navTabs = [
    { screen: 'chat' as Screen, icon: MessageCircle, label: 'Chat' },
    { screen: 'write' as Screen, icon: PenLine, label: 'Write' }
  ]

  // Loading state
  if (state.loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-nore-base">
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 animate-pulse"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: 'var(--nore-accent)' }}
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="text-sm text-nore-text-secondary">Loading...</span>
        </div>
      </div>
    )
  }

  // Welcome/onboarding screen
  if (!state.isOnboarded) {
    return <WelcomeScreen onComplete={handleOnboardingComplete} />
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-nore-base">
        {/* Top Bar — draggable window chrome */}
        <header
          className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-nore-border bg-nore-surface"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          {/* Left col: macOS spacer + Logo */}
          <div className="flex items-center">
            {isMac && <div className="w-20 shrink-0" />}
            <div className="flex items-center gap-2 px-4">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--nore-accent)' }}>
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span className="text-sm font-medium text-nore-text-primary">Nore</span>
            </div>
          </div>

          {/* Center col: Navigation tabs */}
          <nav className="flex items-center gap-1">
            {navTabs.map(({ screen, icon: Icon, label }) => {
              const isActive = state.screen === screen
              return (
                <button
                  key={screen}
                  onClick={() => setScreen(screen)}
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm transition-colors ${
                    isActive ? 'text-(--nore-accent)' : 'text-nore-text-secondary hover:text-nore-text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-(--nore-accent)" />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Right col: Search + Settings + Vault status + Window controls */}
          <div className="flex items-center justify-end gap-3 px-4">
            <button
              onClick={openSearch}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="flex flex-1 min-w-24 max-w-80 items-center gap-2 rounded-md border border-nore-border bg-nore-base px-2.5 py-1.5 text-sm text-nore-text-secondary transition-colors hover:border-nore-border-hover hover:text-nore-text-primary"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search</span>
              <kbd className="ml-auto rounded border border-nore-border bg-nore-surface px-1 py-0.5 text-xs text-nore-text-tertiary">
                Ctrl+K
              </kbd>
            </button>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setScreen('settings')}
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
                    state.screen === 'settings'
                      ? 'bg-nore-elevated text-(--nore-accent)'
                      : 'text-nore-text-secondary hover:bg-nore-elevated hover:text-nore-text-primary'
                  }`}
                >
                  <Settings className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="border-nore-border bg-nore-elevated text-nore-text-primary">
                <p>Settings <span className="ml-2 text-nore-text-tertiary">Ctrl+,</span></p>
              </TooltipContent>
            </Tooltip>

            <div
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="flex shrink-0 items-center gap-2 text-xs text-nore-text-secondary"
            >
              <div className={`h-2 w-2 rounded-full ${
                state.indexStatus === 'up-to-date' ? 'bg-green-500'
                  : state.indexStatus === 'indexing' ? 'animate-pulse bg-amber-500'
                    : 'bg-red-500'
              }`} />
              <span>{state.noteCount} notes</span>
            </div>

            {/* Windows/Linux: custom window controls */}
            {!isMac && (
              <div className="-mr-4 flex h-12 shrink-0 items-stretch">
                <button
                  onClick={() => window.windowControls.minimize()}
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  className="flex w-11 items-center justify-center text-nore-text-tertiary transition-colors hover:bg-nore-elevated hover:text-nore-text-primary"
                  title="Minimize"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => window.windowControls.toggleMaximize()}
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  className="flex w-11 items-center justify-center text-nore-text-tertiary transition-colors hover:bg-nore-elevated hover:text-nore-text-primary"
                  title="Maximize"
                >
                  <Square className="h-3 w-3" />
                </button>
                <button
                  onClick={() => window.windowControls.close()}
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  className="flex w-11 items-center justify-center text-nore-text-tertiary transition-colors hover:bg-red-500 hover:text-white"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <div
            className={`h-full transition-opacity duration-150 ${state.screen === 'chat' ? 'opacity-100' : 'hidden opacity-0'
              }`}
          >
            <ChatScreen
              noteCount={state.noteCount}
              tagCount={state.tagCount}
              backlinkCount={state.backlinkCount}
              lastIndexed={state.lastIndexed}
              onOpenInWrite={(note) => {
                setState((s) => ({
                  ...s,
                  screen: 'write',
                  selectedNoteForWrite: { title: note.title, content: note.content }
                }))
              }}
            />
          </div>
          <div
            className={`h-full transition-opacity duration-150 ${state.screen === 'write' ? 'opacity-100' : 'hidden opacity-0'
              }`}
          >
            <WriteScreen
              showLineNumbers={state.showLineNumbers}
              initialNote={state.selectedNoteForWrite ?? undefined}
            />
          </div>
          <div
            className={`h-full transition-opacity duration-150 ${state.screen === 'settings' ? 'opacity-100' : 'hidden opacity-0'
              }`}
          >
            <SettingsScreen state={state} onUpdate={updateSettings} />
          </div>
        </main>

        <SearchModal
          open={state.searchOpen}
          onClose={closeSearch}
          onSelectNote={(note, mode: OpenMode) => {
            closeSearch()
            setState((s) => ({
              ...s,
              screen: mode,
              selectedNoteForWrite: mode === 'write'
                ? { title: note.title, content: note.content }
                : s.selectedNoteForWrite
            }))
          }}
        />
      </div>
    </TooltipProvider>
  )
}
