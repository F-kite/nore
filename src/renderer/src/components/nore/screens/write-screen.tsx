
import { useState, useEffect } from "react"
import { RefreshCw, ExternalLink, Plus, AlertCircle, Bold, Italic, Heading, LinkIcon, Code, FileText } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@renderer/components/ui/tooltip"

interface WriteScreenProps {
  showLineNumbers: boolean
}

interface RelatedNote {
  title: string
  score: number
  excerpt: string
}

interface Gap {
  topic: string
  suggestion: string
}

const mockRelatedNotes: RelatedNote[] = [
  {
    title: "Zettelkasten Method Notes",
    score: 87,
    excerpt: "The Zettelkasten method emphasizes atomic notes and meaningful connections between ideas.",
  },
  {
    title: "2024-01-15 Deep Work Summary",
    score: 72,
    excerpt: "Cal Newport argues that deep work is becoming increasingly rare in our economy.",
  },
  {
    title: "Weekly Review Template",
    score: 65,
    excerpt: "Review what worked, what didn't, and plan for the upcoming week.",
  },
  {
    title: "Building a Second Brain",
    score: 58,
    excerpt: "Tiago Forte's methodology for capturing and organizing digital information.",
  },
]

const mockGaps: Gap[] = [
  {
    topic: "spaced repetition",
    suggestion: "Topic 'spaced repetition' mentioned but not explored",
  },
  {
    topic: "learning techniques",
    suggestion: "Consider linking to your learning techniques notes",
  },
]

const initialContent = `# Productivity Systems Review

After several months of experimentation, I'm documenting my thoughts on different productivity systems and how they integrate.

## Key Insights

The most important realization is that **no single system works in isolation**. Deep work requires protected time blocks, which needs calendar management. The Zettelkasten method helps with knowledge retention, but only if combined with spaced repetition.

## What's Working

1. Time blocking in 90-minute chunks
2. Weekly reviews every Sunday
3. Capturing fleeting notes immediately

## Questions to Explore

- How can I better integrate spaced repetition into my workflow?
- Should I track habits separately or within my note-taking system?
`

const toolbarButtons = [
  { icon: Bold, label: "Bold", shortcut: "Cmd+B" },
  { icon: Italic, label: "Italic", shortcut: "Cmd+I" },
  { icon: Heading, label: "Heading", shortcut: "Cmd+H" },
  { icon: LinkIcon, label: "Link", shortcut: "Cmd+K" },
  { icon: Code, label: "Code", shortcut: "Cmd+`" },
]

export function WriteScreen({ showLineNumbers }: WriteScreenProps) {
  const [content, setContent] = useState(initialContent)
  const [fileName, setFileName] = useState("Productivity Systems Review.md")
  const [panelWidth, setPanelWidth] = useState(40) // percentage
  const [isResizing, setIsResizing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [relatedNotes, setRelatedNotes] = useState<RelatedNote[]>([])
  const [gaps, setGaps] = useState<Gap[]>([])

  // Simulate loading connections when content changes
  useEffect(() => {
    if (!content.trim()) {
      setRelatedNotes([])
      setGaps([])
      return
    }

    setIsLoading(true)
    const timer = setTimeout(() => {
      setRelatedNotes(mockRelatedNotes)
      setGaps(mockGaps)
      setIsLoading(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [content])

  const handleMouseDown = () => {
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const container = document.getElementById("write-container")
      if (!container) return
      const rect = container.getBoundingClientRect()
      const newWidth = ((rect.right - e.clientX) / rect.width) * 100
      setPanelWidth(Math.max(25, Math.min(60, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing])

  const handleRefresh = () => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
    }, 800)
  }

  const lines = content.split("\n")

  return (
    <TooltipProvider delayDuration={300}>
      <div id="write-container" className="flex h-full">
        {/* Editor panel */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: `${100 - panelWidth}%` }}
        >
          {/* Toolbar */}
          <div className="flex h-10 items-center justify-between border-b border-nore-border px-4">
            {/* File name */}
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-nore-text-tertiary" />
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="bg-transparent text-sm text-nore-text-primary focus:outline-none"
              />
            </div>

            {/* Formatting buttons */}
            <div className="flex items-center gap-1">
              {toolbarButtons.map(({ icon: Icon, label, shortcut }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <button className="flex h-7 w-7 items-center justify-center rounded text-nore-text-secondary hover:bg-nore-elevated hover:text-nore-text-primary transition-colors">
                      <Icon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-nore-elevated border-nore-border text-nore-text-primary">
                    <p>{label} <span className="text-nore-text-tertiary ml-2">{shortcut}</span></p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Editor area */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="min-h-full p-6">
              {showLineNumbers ? (
                <div className="flex font-mono text-sm">
                  {/* Line numbers */}
                  <div className="flex flex-col pr-6 text-right text-nore-text-tertiary select-none">
                    {lines.map((_, i) => (
                      <div key={i} className="leading-relaxed">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  {/* Editor */}
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="flex-1 resize-none bg-transparent leading-relaxed text-nore-text-primary placeholder:text-nore-text-tertiary focus:outline-none caret-[var(--nore-accent)]"
                    placeholder="Start writing..."
                    spellCheck={false}
                    style={{ minHeight: "100%" }}
                  />
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full resize-none bg-transparent font-mono text-sm leading-relaxed text-nore-text-primary placeholder:text-nore-text-tertiary focus:outline-none caret-[var(--nore-accent)]"
                  placeholder="Start writing..."
                  spellCheck={false}
                  style={{ minHeight: "calc(100vh - 160px)" }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`flex w-px cursor-col-resize items-center justify-center bg-nore-border hover:bg-[var(--nore-accent)] transition-colors ${
            isResizing ? "bg-[var(--nore-accent)]" : ""
          }`}
        />

        {/* Suggestions panel */}
        <div
          className="flex flex-col overflow-hidden bg-nore-surface"
          style={{ width: `${panelWidth}%` }}
        >
          <div className="flex items-center justify-between border-b border-nore-border px-4 py-3">
            <h2 className="text-sm font-medium text-nore-text-primary">Connections</h2>
            <button
              onClick={handleRefresh}
              className="rounded p-1 text-nore-text-secondary hover:bg-nore-elevated hover:text-nore-text-primary transition-colors"
              title="Refresh connections"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
            {!content.trim() ? (
              <p className="text-center text-sm text-nore-text-tertiary">
                Start writing to see connections...
              </p>
            ) : isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse space-y-2">
                    <div className="h-4 w-3/4 rounded bg-nore-elevated" />
                    <div className="h-3 w-1/4 rounded bg-nore-elevated" />
                    <div className="h-3 w-full rounded bg-nore-elevated" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Related Notes */}
                <div className="mb-6">
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
                    Related Notes
                  </h3>
                  <div className="space-y-2">
                    {relatedNotes.map((note, i) => (
                      <div
                        key={i}
                        className="group cursor-pointer rounded-md border border-nore-border bg-nore-base p-3 hover:border-nore-border-hover transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-nore-text-primary group-hover:text-[var(--nore-accent)] transition-colors">
                                {note.title}
                              </p>
                              <span className="flex-shrink-0 rounded bg-nore-elevated px-1.5 py-0.5 text-xs text-nore-text-secondary">
                                {note.score}% match
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-1 text-xs text-nore-text-secondary">
                              {note.excerpt}
                            </p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-nore-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gaps Detected */}
                {gaps.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
                      Gaps Detected
                    </h3>
                    <div className="space-y-2">
                      {gaps.map((gap, i) => (
                        <div
                          key={i}
                          className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3"
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-nore-text-secondary">
                                {gap.suggestion}
                              </p>
                              <button className="mt-2 flex items-center gap-1 rounded px-2 py-1 text-xs text-nore-text-secondary hover:text-[var(--nore-accent)] transition-colors">
                                <Plus className="h-3 w-3" />
                                Create note
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
