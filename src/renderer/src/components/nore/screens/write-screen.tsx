
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import {
  RefreshCw, ExternalLink, Bold, Italic, Heading, LinkIcon,
  Code, FileText, ChevronDown, ChevronRight, Folder
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@renderer/components/ui/tooltip"
import type { NoteRecord } from "../../../../../types/index.d"
import type { VaultFile } from "../../../../../types/vault"

interface WriteScreenProps {
  showLineNumbers: boolean
  initialNote?: { title: string; content: string }
}

interface RelatedNote {
  title: string
  path: string
  excerpt: string
  score: number
}

// --- Tree ---

interface TreeNode {
  name: string
  isFile: boolean
  children: TreeNode[]
  file?: VaultFile
  nodePath: string
}

function buildTree(files: VaultFile[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const file of files) {
    const parts = file.relativePath.replace(/\\/g, "/").split("/")
    let level = root

    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join("/")
      let dir = level.find((n) => !n.isFile && n.name === parts[i])
      if (!dir) {
        dir = { name: parts[i], isFile: false, children: [], nodePath: folderPath }
        level.push(dir)
      }
      level = dir.children
    }

    level.push({
      name: parts[parts.length - 1],
      isFile: true,
      children: [],
      file,
      nodePath: file.relativePath,
    })
  }

  function sortLevel(nodes: TreeNode[]): void {
    nodes.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
      return a.name.localeCompare(b.name)
    })
    nodes.forEach((n) => { if (!n.isFile) sortLevel(n.children) })
  }
  sortLevel(root)
  return root
}

function TreeItem({
  node,
  depth,
  onSelectNote,
  activeNotePath,
}: {
  node: TreeNode
  depth: number
  onSelectNote: (file: VaultFile) => void
  activeNotePath: string
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const indent = depth * 12 + 6

  if (!node.isFile) {
    return (
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-1.5 rounded py-0.5 text-left text-sm text-nore-text-secondary hover:bg-nore-elevated cursor-pointer hover:text-nore-text-primary transition-colors"
          style={{ paddingLeft: `${indent}px`, paddingRight: "6px" }}
        >
          {expanded
            ? <ChevronDown className="h-3 w-3 shrink-0 text-nore-text-tertiary" />
            : <ChevronRight className="h-3 w-3 shrink-0 text-nore-text-tertiary" />}
          <Folder className="h-3 w-3 shrink-0 text-nore-text-tertiary" />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded &&
          node.children.map((child) => (
            <TreeItem
              key={child.nodePath}
              node={child}
              depth={depth + 1}
              onSelectNote={onSelectNote}
              activeNotePath={activeNotePath}
            />
          ))}
      </div>
    )
  }

  const isActive = node.nodePath === activeNotePath
  return (
    <button
      onClick={() => node.file && onSelectNote(node.file)}
      className={`flex w-full items-center gap-1.5 rounded py-0.5 text-left text-sm transition-colors cursor-pointer ${isActive
        ? "bg-(--nore-accent-muted) text-(--nore-accent)"
        : "text-nore-text-primary hover:bg-nore-elevated hover:text-(--nore-accent)"
        }`}
      style={{ paddingLeft: `${indent}px`, paddingRight: "6px" }}
    >
      <FileText className="h-3 w-3 shrink-0 text-nore-text-tertiary" />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

// --- Search helpers ---

function extractSearchQuery(content: string): string {
  // Strip frontmatter
  const stripped = content.replace(/^---[\s\S]*?---\n?/, "").trim()
  const lines = stripped.split("\n")

  // All headings (topic signals)
  const headings = lines
    .filter((l) => /^#{1,3}\s/.test(l))
    .map((l) => l.replace(/^#+\s+/, "").trim())

  // Substantial body lines (skip bullets, short lines, empty lines)
  const bodyLines = lines
    .filter((l) => {
      const t = l.trim()
      return t.length > 30 && !t.startsWith("#") && !t.startsWith("!") && !t.startsWith("|")
    })
    .slice(0, 5)
    .map((l) => l.trim())

  return [...headings, ...bodyLines].filter(Boolean).join(" ").slice(0, 600)
}

function noteToRelated(note: NoteRecord): RelatedNote {
  const distance = note._distance ?? 1.414
  // Voyage AI vectors are L2-normalized → cosine_similarity = 1 - d²/2
  const score = Math.round(Math.max(0, (1 - (distance * distance) / 2) * 100))
  const excerpt = note.content
    .replace(/^---[\s\S]*?---\n?/, "")
    .trim()
    .slice(0, 180)
  return { title: note.title, path: note.relativePath, excerpt, score }
}

// --- Toolbar ---

const toolbarButtons = [
  { icon: Bold, label: "Bold", shortcut: "Cmd+B" },
  { icon: Italic, label: "Italic", shortcut: "Cmd+I" },
  { icon: Heading, label: "Heading", shortcut: "Cmd+H" },
  { icon: LinkIcon, label: "Link", shortcut: "Cmd+K" },
  { icon: Code, label: "Code", shortcut: "Cmd+`" },
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

// --- Main component ---

export function WriteScreen({ showLineNumbers, initialNote }: WriteScreenProps) {
  const [content, setContent] = useState(initialContent)
  const [fileName, setFileName] = useState("Productivity Systems Review.md")
  const [activeNotePath, setActiveNotePath] = useState("")

  useEffect(() => {
    if (initialNote) {
      setContent(initialNote.content)
      setFileName(
        initialNote.title.endsWith(".md") ? initialNote.title : `${initialNote.title}.md`
      )
    }
  }, [initialNote])

  const [panelWidth, setPanelWidth] = useState(38)
  const [isResizing, setIsResizing] = useState(false)
  const [activePanel, setActivePanel] = useState<"connections" | "vault">("connections")

  const [isSearching, setIsSearching] = useState(false)
  const [rawResults, setRawResults] = useState<NoteRecord[]>([])
  const [threshold, setThreshold] = useState(65)
  const [lastSearchQuery, setLastSearchQuery] = useState("")
  const contentRef = useRef(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { contentRef.current = content }, [content])

  // Auto-grow textarea to content height — outer container scrolls, not the textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [content])

  const [vaultTree, setVaultTree] = useState<TreeNode[]>([])
  const [isLoadingVault, setIsLoadingVault] = useState(false)

  // Load vault tree on mount
  useEffect(() => {
    async function loadTree() {
      setIsLoadingVault(true)
      try {
        const vaultPath = await window.vault.getSavedPath()
        if (!vaultPath) return
        const files = await window.vault.loadFiles(vaultPath)
        setVaultTree(buildTree(files))
      } catch {
        // vault not set up
      } finally {
        setIsLoadingVault(false)
      }
    }
    loadTree()
  }, [])

  // Filtered notes computed from raw results + threshold (no API call)
  const currentTitle = fileName.replace(/\.md$/, "").toLowerCase()
  const relatedNotes = useMemo(() =>
    rawResults
      .map(noteToRelated)
      .filter((n) => n.title.toLowerCase() !== currentTitle && n.score >= threshold),
    [rawResults, threshold, currentTitle]
  )

  // Manual search — called by the refresh button or when a note is opened
  const searchConnections = useCallback(async () => {
    const current = contentRef.current
    if (!current.trim()) { setRawResults([]); setLastSearchQuery(""); return }
    const query = extractSearchQuery(current)
    if (!query.trim()) return
    setLastSearchQuery(query)
    setIsSearching(true)
    try {
      const results: NoteRecord[] = await window.write.relatedOnly(query, 30)
      setRawResults(results)
    } catch {
      // search unavailable
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleRefresh = useCallback(() => searchConnections(), [searchConnections])

  const handleSelectVaultNote = useCallback((file: VaultFile) => {
    contentRef.current = file.content  // update ref immediately before searching
    setContent(file.content)
    setFileName(file.name)
    setActiveNotePath(file.relativePath)
    setActivePanel("connections")
    searchConnections()
  }, [searchConnections])

  // Resize
  const handleMouseDown = () => setIsResizing(true)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing) return
      const container = document.getElementById("write-container")
      if (!container) return
      const rect = container.getBoundingClientRect()
      const newWidth = ((rect.right - e.clientX) / rect.width) * 100
      setPanelWidth(Math.max(25, Math.min(60, newWidth)))
    }
    const onUp = () => setIsResizing(false)
    if (isResizing) {
      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", onUp)
    }
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
  }, [isResizing])

  const lines = content.split("\n")

  return (
    <TooltipProvider delayDuration={300}>
      <div id="write-container" className="flex h-full">

        {/* Editor */}
        <div className="flex flex-col overflow-hidden " style={{ width: `${100 - panelWidth}%` }}>
          <div className="flex min-h-10 items-center justify-between border-b border-nore-border px-4">
            <div className="flex items-center gap-2 min-h-10">
              <FileText className="h-4 w-4 text-nore-text-tertiary" />
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="bg-transparent text-sm text-nore-text-primary focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              {toolbarButtons.map(({ icon: Icon, label, shortcut }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <button className="flex h-7 w-7 items-center justify-center rounded text-nore-text-secondary hover:bg-nore-elevated hover:text-nore-text-primary transition-colors cursor-pointer hover:text-(--nore-accent)">
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

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="min-h-full p-6">
              {showLineNumbers ? (
                <div className="flex font-mono text-sm">
                  <div className="flex flex-col pr-6 text-right text-nore-text-tertiary select-none">
                    {lines.map((_, i) => (
                      <div key={i} className="leading-relaxed">{i + 1}</div>
                    ))}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="flex-1 resize-none overflow-hidden bg-transparent leading-relaxed text-nore-text-primary placeholder:text-nore-text-tertiary focus:outline-none caret-(--nore-accent)"
                    placeholder="Start writing..."
                    spellCheck={false}
                  />
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full resize-none overflow-hidden bg-transparent font-mono text-sm leading-relaxed text-nore-text-primary placeholder:text-nore-text-tertiary focus:outline-none caret-(--nore-accent)"
                  placeholder="Start writing..."
                  spellCheck={false}
                />
              )}
            </div>
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`w-px cursor-col-resize bg-nore-border pr-1 bg-(--nore-text-primary) transition-colors ${isResizing ? "bg-(--nore-accent)" : ""
            }`}
        />

        {/* Right panel */}
        <div className="flex flex-col overflow-hidden bg-nore-surface" style={{ width: `${panelWidth}%` }}>

          {/* Tab bar */}
          <div className="flex items-center justify-between border-b border-nore-border px-3 py-2 min-h-10">
            <div className="flex gap-0.5">
              {(["connections", "vault"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActivePanel(tab)}
                  className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${activePanel === tab
                    ? "bg-(--nore-accent-muted) text-(--nore-accent)"
                    : "text-nore-text-secondary hover:text-nore-text-primary"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {activePanel === "connections" && (
              <div className="flex items-center gap-2">
                {relatedNotes.length > 0 && (
                  <span className="text-xs text-nore-text-tertiary">{relatedNotes.length} found</span>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={isSearching}
                  className="rounded p-1 text-nore-text-secondary hover:bg-nore-elevated hover:text-nore-text-primary transition-colors disabled:opacity-40"
                  title="Find connections"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSearching ? "animate-spin" : ""}`} />
                </button>
              </div>
            )}
          </div>

          {/* Connections tab */}
          {activePanel === "connections" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Threshold slider */}
              <div className="flex items-center gap-2 border-b border-nore-border px-4 py-2 shrink-0">
                <span className="text-xs text-nore-text-tertiary whitespace-nowrap">Min match</span>
                <input
                  type="range"
                  min={20}
                  max={90}
                  step={5}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="flex-1 accent-(--nore-accent)"
                />
                <span className="w-8 shrink-0 text-right text-xs text-nore-text-secondary">{threshold}%</span>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
                {!lastSearchQuery && !isSearching ? (
                  <p className="pt-8 text-center text-sm text-nore-text-tertiary">
                    Open a note or click <RefreshCw className="inline h-3 w-3" /> to find connections
                  </p>
                ) : relatedNotes.length === 0 && !isSearching ? (
                  <p className="pt-4 text-sm text-nore-text-tertiary">
                    No notes above {threshold}% similarity
                  </p>
                ) : (
                  <div className="space-y-2">
                    {relatedNotes.map((note, i) => (
                      <Tooltip key={i}>
                        <TooltipTrigger asChild>
                          <div className="group rounded-md border border-nore-border bg-nore-base p-3 hover:border-nore-border-hover transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-medium text-nore-text-primary group-hover:text-(--nore-accent) transition-colors">
                                    {note.title}
                                  </p>
                                  <span className="shrink-0 rounded bg-nore-elevated px-1.5 py-0.5 text-xs text-nore-text-secondary">
                                    {note.score}%
                                  </span>
                                </div>
                                {note.excerpt && (
                                  <p className="mt-1 line-clamp-1 text-xs text-nore-text-secondary">
                                    {note.excerpt}
                                  </p>
                                )}
                                <p className="mt-0.5 truncate font-mono text-xs text-nore-text-tertiary">
                                  {note.path}
                                </p>
                              </div>
                              <button
                                onClick={() => window.vault.openInObsidian(note.path).catch(() => {})}
                                title="Open in Obsidian"
                                className="shrink-0 cursor-pointer text-nore-text-tertiary opacity-0 transition-opacity group-hover:opacity-100 hover:text-(--nore-accent)"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-56 bg-nore-elevated border-nore-border text-nore-text-primary">
                          <p className="text-xs text-nore-text-tertiary mb-0.5">Found via query:</p>
                          <p className="text-xs">{lastSearchQuery.slice(0, 120)}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vault tab */}
          {activePanel === "vault" && (
            <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
              {isLoadingVault ? (
                <div className="space-y-1.5 px-3 pt-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex animate-pulse items-center gap-2">
                      <div className="h-3 w-3 rounded bg-nore-elevated" />
                      <div
                        className="h-3 rounded bg-nore-elevated"
                        style={{ width: `${40 + i * 10}%` }}
                      />
                    </div>
                  ))}
                </div>
              ) : vaultTree.length === 0 ? (
                <p className="px-4 pt-8 text-center text-sm text-nore-text-tertiary">
                  No vault connected
                </p>
              ) : (
                vaultTree.map((node) => (
                  <TreeItem
                    key={node.nodePath}
                    node={node}
                    depth={0}
                    onSelectNote={handleSelectVaultNote}
                    activeNotePath={activeNotePath}
                  />
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </TooltipProvider>
  )
}
