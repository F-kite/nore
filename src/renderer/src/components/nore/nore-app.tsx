
import { useState, useEffect, useCallback } from "react"
import { MessageCircle, PenLine, Settings, Search } from "lucide-react"
import { ChatScreen } from "./screens/chat-screen"
import { WriteScreen } from "./screens/write-screen"
import { SettingsScreen } from "./screens/settings-screen"
import { SearchModal } from "./search-modal"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@renderer/components/ui/tooltip"

export type Screen = "chat" | "write" | "settings"
export type AccentColor = "blue" | "teal" | "green" | "amber" | "rose" | "violet" | "custom"
export type FontSize = "compact" | "default" | "comfortable"

const accentColors: Record<AccentColor, string> = {
  blue: "#4C8BF5",
  teal: "#14B8A6",
  green: "#22C55E",
  amber: "#F59E0B",
  rose: "#F43F5E",
  violet: "#8B5CF6",
  custom: "#4C8BF5",
}

const fontSizes: Record<FontSize, string> = {
  compact: "13px",
  default: "14px",
  comfortable: "16px",
}

export interface NoreState {
  screen: Screen
  searchOpen: boolean
  accentColor: AccentColor
  customAccentColor: string
  fontSize: FontSize
  vaultPath: string
  vaultName: string
  noteCount: number
  tagCount: number
  backlinkCount: number
  lastIndexed: string
  voyageApiKey: string
  llmApiKey: string
  showLineNumbers: boolean
  indexStatus: "up-to-date" | "indexing" | "error"
}

export function NoreApp() {
  const [state, setState] = useState<NoreState>({
    screen: "chat",
    searchOpen: false,
    accentColor: "blue",
    customAccentColor: "#4C8BF5",
    fontSize: "default",
    vaultPath: "/Users/alex/Documents/obsidian_storage",
    vaultName: "obsidian_storage",
    noteCount: 515,
    tagCount: 12,
    backlinkCount: 847,
    lastIndexed: "2 min ago",
    voyageApiKey: "voy-xxxxxxxxxxxx",
    llmApiKey: "sk-xxxxxxxxxxxx",
    showLineNumbers: true,
    indexStatus: "up-to-date",
  })

  // Apply accent color to CSS variable
  useEffect(() => {
    const color = state.accentColor === "custom"
      ? state.customAccentColor
      : accentColors[state.accentColor]
    document.documentElement.style.setProperty("--nore-accent", color)
    document.documentElement.style.setProperty("--nore-accent-muted", `${color}20`)
  }, [state.accentColor, state.customAccentColor])

  // Apply font size
  useEffect(() => {
    document.documentElement.style.setProperty("--nore-font-size", fontSizes[state.fontSize])
    document.documentElement.style.fontSize = fontSizes[state.fontSize]
  }, [state.fontSize])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === "k") {
        e.preventDefault()
        setState(s => ({ ...s, searchOpen: true }))
      }
      if (isMod && e.key === "1") {
        e.preventDefault()
        setState(s => ({ ...s, screen: "chat" }))
      }
      if (isMod && e.key === "2") {
        e.preventDefault()
        setState(s => ({ ...s, screen: "write" }))
      }
      if (isMod && e.key === ",") {
        e.preventDefault()
        setState(s => ({ ...s, screen: "settings" }))
      }
      if (isMod && e.key === "n") {
        e.preventDefault()
        // New chat - handled in ChatScreen
      }
      if (isMod && e.shiftKey && e.key === "L") {
        e.preventDefault()
        setState(s => ({ ...s, showLineNumbers: !s.showLineNumbers }))
      }
      if (e.key === "Escape" && state.searchOpen) {
        setState(s => ({ ...s, searchOpen: false }))
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [state.searchOpen])

  const setScreen = useCallback((screen: Screen) => {
    setState(s => ({ ...s, screen }))
  }, [])

  const openSearch = useCallback(() => {
    setState(s => ({ ...s, searchOpen: true }))
  }, [])

  const closeSearch = useCallback(() => {
    setState(s => ({ ...s, searchOpen: false }))
  }, [])

  const updateSettings = useCallback((updates: Partial<NoreState>) => {
    setState(s => ({ ...s, ...updates }))
  }, [])

  const navTabs = [
    { screen: "chat" as Screen, icon: MessageCircle, label: "Chat" },
    { screen: "write" as Screen, icon: PenLine, label: "Write" },
  ]

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-nore-base">
        {/* Top Bar */}
        <header className="flex h-12 flex-shrink-0 items-center border-b border-nore-border bg-nore-surface px-4  pl-4 pr-[150px]" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ color: "var(--nore-accent)" }}
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-medium text-nore-text-primary">Nore</span>
          </div>

          {/* Center: Navigation Tabs */}
          <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {navTabs.map(({ screen, icon: Icon, label }) => {
              const isActive = state.screen === screen
              return (
                <button
                  key={screen}
                  onClick={() => setScreen(screen)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm transition-colors ${isActive
                    ? "text-[var(--nore-accent)]"
                    : "text-nore-text-secondary hover:text-nore-text-primary"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {isActive && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full transition-all"
                      style={{ backgroundColor: "var(--nore-accent)" }}
                    />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Right: Search, Settings, Vault Status */}
          <div className="ml-auto flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {/* Search Button */}
            <button
              onClick={openSearch}
              className="flex items-center gap-2 rounded-md border border-nore-border bg-nore-base px-2.5 py-1.5 text-sm text-nore-text-secondary hover:border-nore-border-hover hover:text-nore-text-primary transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search</span>
              <kbd className="ml-1 rounded border border-nore-border bg-nore-surface px-1 py-0.5 text-xs text-nore-text-tertiary">
                Cmd+K
              </kbd>
            </button>

            {/* Settings Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setScreen("settings")}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${state.screen === "settings"
                    ? "bg-nore-elevated text-[var(--nore-accent)]"
                    : "text-nore-text-secondary hover:bg-nore-elevated hover:text-nore-text-primary"
                    }`}
                >
                  <Settings className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-nore-elevated border-nore-border text-nore-text-primary">
                <p>Settings <span className="text-nore-text-tertiary ml-2">Cmd+,</span></p>
              </TooltipContent>
            </Tooltip>

            {/* Vault Status */}
            <div className="flex items-center gap-2 text-xs text-nore-text-secondary">
              <div
                className={`h-2 w-2 rounded-full ${state.indexStatus === "up-to-date"
                  ? "bg-green-500"
                  : state.indexStatus === "indexing"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-red-500"
                  }`}
              />
              <span>{state.noteCount} notes</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <div
            className={`h-full transition-opacity duration-150 ${state.screen === "chat" ? "opacity-100" : "opacity-0 hidden"
              }`}
          >
            <ChatScreen
              noteCount={state.noteCount}
              tagCount={state.tagCount}
              backlinkCount={state.backlinkCount}
              lastIndexed={state.lastIndexed}
            />
          </div>
          <div
            className={`h-full transition-opacity duration-150 ${state.screen === "write" ? "opacity-100" : "opacity-0 hidden"
              }`}
          >
            <WriteScreen showLineNumbers={state.showLineNumbers} />
          </div>
          <div
            className={`h-full transition-opacity duration-150 ${state.screen === "settings" ? "opacity-100" : "opacity-0 hidden"
              }`}
          >
            <SettingsScreen state={state} onUpdate={updateSettings} />
          </div>
        </main>

        {/* Search Modal */}
        <SearchModal
          open={state.searchOpen}
          onClose={closeSearch}
          onSelectNote={(note) => {
            closeSearch()
          }}
        />
      </div>
    </TooltipProvider>
  )
}
