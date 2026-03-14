
import { useState, useEffect, useRef, useCallback } from "react"
import { Search, FileText, ArrowRight, Loader2 } from "lucide-react"
import type { NoteRecord } from "../../../../types/index.d"

interface SearchModalProps {
  open: boolean
  onClose: () => void
  onSelectNote: (note: NoteRecord) => void
}

function distanceToRelevance(distance: number | undefined): number | null {
  if (distance === undefined) return null
  // LanceDB cosine distance: 0 = identical, 2 = opposite
  return Math.round(Math.max(0, (1 - distance / 2) * 100))
}

export function SearchModal({ open, onClose, onSelectNote }: SearchModalProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<NoteRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await window.search.query(q.trim())
      setResults(res)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSelectedIndex(0)

    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(() => runSearch(query), 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      setSelectedIndex(0)
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault()
      onSelectNote(results[selectedIndex])
    } else if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  const showEmpty = !loading && query.trim() && results.length === 0
  const showPlaceholder = !loading && !query.trim()

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
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-nore-text-tertiary" />
          ) : (
            <Search className="h-5 w-5 text-nore-text-tertiary" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes semantically..."
            className="flex-1 bg-transparent text-sm text-nore-text-primary placeholder:text-nore-text-tertiary focus:outline-none"
          />
          <kbd className="rounded border border-nore-border bg-nore-base px-1.5 py-0.5 text-xs text-nore-text-tertiary">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-100 overflow-y-auto scrollbar-thin">
          {showPlaceholder && (
            <div className="px-4 py-8 text-center text-sm text-nore-text-tertiary">
              Type to search your vault semantically
            </div>
          )}

          {showEmpty && (
            <div className="px-4 py-8 text-center text-sm text-nore-text-tertiary">
              No notes found for &ldquo;{query}&rdquo;
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {results.map((note, index) => {
                const relevance = distanceToRelevance(note._distance)
                const preview = note.content.replace(/^---[\s\S]*?---\n?/, "").trim().slice(0, 120)

                return (
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
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-nore-text-tertiary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-nore-text-primary">
                          {note.title}
                        </p>
                        {relevance !== null && (
                          <span className="shrink-0 rounded bg-nore-base px-1.5 py-0.5 text-xs text-nore-text-tertiary">
                            {relevance}%
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-xs text-nore-text-tertiary">
                        {note.relativePath}
                      </p>
                      {preview && (
                        <p className="mt-1 line-clamp-1 text-xs text-nore-text-secondary">
                          {preview}
                        </p>
                      )}
                    </div>
                    {selectedIndex === index && (
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-(--nore-accent)" />
                    )}
                  </button>
                )
              })}
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
