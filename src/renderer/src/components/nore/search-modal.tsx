
import { useState, useEffect, useRef } from "react"
import { Search, FileText, ArrowRight } from "lucide-react"

interface SearchModalProps {
  open: boolean
  onClose: () => void
  onSelectNote: (note: SearchResult) => void
}

interface SearchResult {
  id: string
  title: string
  path: string
  relevance: number
  preview: string
}

const mockNotes: SearchResult[] = [
  {
    id: "1",
    title: "2024-01-15 Deep Work Summary",
    path: "productivity/deep-work-summary.md",
    relevance: 95,
    preview: "Cal Newport argues that deep work is becoming increasingly rare in our economy...",
  },
  {
    id: "2",
    title: "Zettelkasten Method Notes",
    path: "methods/zettelkasten.md",
    relevance: 88,
    preview: "The Zettelkasten method emphasizes atomic notes and meaningful connections...",
  },
  {
    id: "3",
    title: "Weekly Review Template",
    path: "templates/weekly-review.md",
    relevance: 76,
    preview: "Review what worked, what didn't, and plan for the upcoming week...",
  },
  {
    id: "4",
    title: "Spaced Repetition Research",
    path: "learning/spaced-repetition.md",
    relevance: 72,
    preview: "The spacing effect demonstrates that learning is more effective when spread out...",
  },
  {
    id: "5",
    title: "Building a Second Brain",
    path: "books/building-second-brain.md",
    relevance: 68,
    preview: "Tiago Forte's methodology for capturing and organizing digital information...",
  },
  {
    id: "6",
    title: "Time Blocking Experiments",
    path: "productivity/time-blocking.md",
    relevance: 65,
    preview: "After three weeks of strict time blocking, I've observed significant changes...",
  },
]

export function SearchModal({ open, onClose, onSelectNote }: SearchModalProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredNotes = query.trim()
    ? mockNotes.filter(
        (note) =>
          note.title.toLowerCase().includes(query.toLowerCase()) ||
          note.preview.toLowerCase().includes(query.toLowerCase())
      )
    : mockNotes

  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      // Focus with a small delay to ensure modal is rendered
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filteredNotes.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && filteredNotes[selectedIndex]) {
      e.preventDefault()
      onSelectNote(filteredNotes[selectedIndex])
    } else if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-lg border border-nore-border bg-nore-surface shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-nore-border px-4 py-3">
          <Search className="h-5 w-5 text-nore-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes..."
            className="flex-1 bg-transparent text-sm text-nore-text-primary placeholder:text-nore-text-tertiary focus:outline-none"
          />
          <kbd className="rounded border border-nore-border bg-nore-base px-1.5 py-0.5 text-xs text-nore-text-tertiary">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
          {filteredNotes.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-nore-text-tertiary">
              No notes found matching "{query}"
            </div>
          ) : (
            <div className="py-2">
              {filteredNotes.map((note, index) => (
                <button
                  key={note.id}
                  onClick={() => onSelectNote(note)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                    selectedIndex === index
                      ? "bg-nore-elevated"
                      : "hover:bg-nore-base"
                  }`}
                >
                  <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-nore-text-tertiary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-nore-text-primary">
                        {note.title}
                      </p>
                      <span className="flex-shrink-0 rounded bg-nore-base px-1.5 py-0.5 text-xs text-nore-text-tertiary">
                        {note.relevance}%
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-nore-text-tertiary">
                      {note.path}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-nore-text-secondary">
                      {note.preview}
                    </p>
                  </div>
                  {selectedIndex === index && (
                    <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--nore-accent)]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-nore-border px-4 py-2 text-xs text-nore-text-tertiary">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-nore-border bg-nore-base px-1 py-0.5">↑</kbd>
            <kbd className="rounded border border-nore-border bg-nore-base px-1 py-0.5">↓</kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-nore-border bg-nore-base px-1.5 py-0.5">Enter</kbd>
            to select
          </span>
        </div>
      </div>
    </div>
  )
}
