
import { useState, useRef, useEffect, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  ArrowUp, ChevronDown, ChevronRight, Link2, Plus, MoreHorizontal, Trash2, Pencil,
  Copy, Check, RotateCcw, ChevronLeft, X, PenLine
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu"
import type { NoteRecord, LLMChatMessage } from "../../../../../types/index.d"

interface ChatScreenProps {
  noteCount: number
  tagCount: number
  backlinkCount: number
  lastIndexed: string
  onOpenInWrite: (note: { title: string; content: string }) => void
}

interface Source {
  title: string
  path: string
  excerpt: string
  content: string  // full note content
}

interface AssistantVersion {
  id: string
  content: string
  timestamp: string
  sources?: Source[]
  isStreaming?: boolean
  error?: boolean
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  // assistant-only: versioning
  versions?: AssistantVersion[]
  activeVersionIndex?: number
}

interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

const STORAGE_KEY = "nore-chats"

const promptSuggestions = [
  "What have I written about productivity?",
  "Find contradictions in my thinking",
  "Summarize my notes from last month",
]

function getDateGroup(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 86400000 * 7)
  const chatDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (chatDate.getTime() === today.getTime()) return "Today"
  if (chatDate.getTime() === yesterday.getTime()) return "Yesterday"
  if (chatDate.getTime() > weekAgo.getTime()) return "Previous 7 Days"
  return "Older"
}

function groupChatsByDate(chats: Chat[]): Record<string, Chat[]> {
  const groups: Record<string, Chat[]> = {}
  for (const chat of chats) {
    const group = getDateGroup(chat.createdAt)
    if (!groups[group]) groups[group] = []
    groups[group].push(chat)
  }
  return groups
}

function noteToSource(note: NoteRecord): Source {
  const body = note.content.replace(/^---[\s\S]*?---\n?/, "").trim()
  return {
    title: note.title,
    path: note.relativePath,
    excerpt: body.slice(0, 200),
    content: note.content,
  }
}

function formatContextNotes(sources: Source[]): string {
  if (sources.length === 0) return ""
  return sources.map((s, i) => `[${i + 1}] ${s.title}\nPath: ${s.path}\n${s.excerpt}`).join("\n\n---\n\n")
}

function TypingIndicator() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--nore-accent)" }}>
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-sm font-medium text-nore-text-primary">Nore</span>
      </div>
      <div className="ml-8 flex items-center gap-1.5 py-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-nore-text-tertiary" style={{ animationDelay: "0ms" }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-nore-text-tertiary" style={{ animationDelay: "150ms" }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-nore-text-tertiary" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  )
}

function StreamingCursor() {
  return <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-text-bottom opacity-70" />
}

function NotePopup({
  source,
  onClose,
  onOpenInWrite,
}: {
  source: Source
  onClose: () => void
  onOpenInWrite: (note: { title: string; content: string }) => void
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const mdComponents = {
    p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-2 mt-3 text-base font-bold">{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-2 mt-3 text-sm font-semibold">{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 mt-2 text-sm font-semibold">{children}</h3>,
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
    li: ({ children }: { children?: React.ReactNode }) => <li className="text-sm">{children}</li>,
    code: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
      className?.includes("language-")
        ? <code className="block rounded bg-nore-base px-3 py-2 font-mono text-xs">{children}</code>
        : <code className="rounded bg-nore-base px-1 py-0.5 font-mono text-xs">{children}</code>,
    pre: ({ children }: { children?: React.ReactNode }) => <pre className="mb-2 overflow-x-auto rounded bg-nore-base p-3">{children}</pre>,
    blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="mb-2 border-l-2 border-nore-border pl-3 text-nore-text-secondary">{children}</blockquote>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-nore-text-primary">{children}</strong>,
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex max-h-[75vh] w-160 max-w-[90vw] flex-col rounded-xl border border-nore-border bg-nore-surface shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-nore-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-nore-text-primary">{source.title}</h2>
            <p className="mt-0.5 truncate font-mono text-xs text-nore-text-tertiary">{source.path}</p>
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-2">
            <button
              onClick={() => { onOpenInWrite({ title: source.title, content: source.content }); onClose() }}
              className="flex items-center gap-1.5 rounded-md border border-nore-border px-3 py-1.5 text-xs text-nore-text-secondary transition-colors hover:border-(--nore-accent) hover:text-(--nore-accent) cursor-pointer"
            >
              <PenLine className="h-3.5 w-3.5" />
              Open in Write
            </button>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-nore-text-tertiary transition-colors hover:bg-nore-elevated hover:text-nore-text-primary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          <div className="select-text text-sm leading-relaxed text-nore-text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {source.content.replace(/^---[\s\S]*?---\n?/, "").trim()}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy response"
      className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-nore-text-tertiary transition-colors cursor-pointer hover:text-(--nore-accent) hover:bg-nore-elevated hover:text-nore-text-secondary "
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

export function ChatScreen({ noteCount, tagCount, backlinkCount, lastIndexed, onOpenInWrite }: ChatScreenProps) {
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({})
  const [popupNote, setPopupNote] = useState<Source | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamingRef = useRef<{ chatId: string; assistantMsgId: string; versionId: string } | null>(null)
  const persistedRef = useRef(false)

  const selectedChat = chats.find((c) => c.id === selectedChatId)
  const messages = selectedChat?.messages || []
  const isEmpty = messages.length === 0
  const groupedChats = groupChatsByDate(chats)
  const groupOrder = ["Today", "Yesterday", "Previous 7 Days", "Older"]
  const isGenerating = messages.some(
    (m) => m.role === "assistant" && m.versions?.some((v) => v.isStreaming)
  )

  // Load persisted chats on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { chats: (Omit<Chat, "createdAt"> & { createdAt: string })[]; selectedChatId: string | null }
        const restored: Chat[] = parsed.chats.map((c) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          messages: c.messages.map((m) => ({
            ...m,
            versions: m.versions?.map((v) => ({ ...v, isStreaming: false }))
          }))
        }))
        setChats(restored)
        setSelectedChatId(parsed.selectedChatId ?? null)
      }
    } catch {
      // corrupted storage — start fresh
    }
    persistedRef.current = true
  }, [])

  // Persist after changes (skip during streaming)
  useEffect(() => {
    if (!persistedRef.current) return
    if (isGenerating) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ chats, selectedChatId }))
    } catch { /* storage full */ }
  }, [chats, selectedChatId, isGenerating])

  // Register LLM token listener once on mount
  useEffect(() => {
    window.llm.onToken(({ chatId: tChatId, token }) => {
      if (!streamingRef.current || streamingRef.current.chatId !== tChatId) return
      const { assistantMsgId, versionId } = streamingRef.current
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== tChatId) return chat
          return {
            ...chat,
            messages: chat.messages.map((msg) => {
              if (msg.id !== assistantMsgId) return msg
              return {
                ...msg,
                versions: msg.versions!.map((v) =>
                  v.id === versionId ? { ...v, content: v.content + token } : v
                ),
              }
            }),
          }
        })
      )
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSearching])

  const handleNewChat = () => {
    const newChat: Chat = { id: Date.now().toString(), title: "New conversation", messages: [], createdAt: new Date() }
    setChats((prev) => [newChat, ...prev])
    setSelectedChatId(newChat.id)
  }

  const handleDeleteChat = (chatId: string) => {
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== chatId)
      if (selectedChatId === chatId) setSelectedChatId(filtered[0]?.id || null)
      return filtered
    })
  }

  // Core: run LLM for a given message. If assistantMsgId is provided → add new version. Otherwise → create new assistant message.
  const runLLM = useCallback(async (
    chatId: string,
    queryText: string,
    llmMessages: LLMChatMessage[],
    existingAssistantMsgId?: string
  ) => {
    // Phase 1: semantic search
    setIsSearching(true)
    let sources: Source[] = []
    let contextNotes = ""
    try {
      const noteResults: NoteRecord[] = await window.search.query(queryText)
      sources = noteResults.slice(0, 5).map(noteToSource)
      contextNotes = formatContextNotes(sources)
    } catch { /* search failed — proceed without context */ }
    setIsSearching(false)

    // Phase 2: create new version — compute IDs synchronously before setChats
    const versionId = `${Date.now()}-v`
    const assistantMsgId = existingAssistantMsgId ?? `${Date.now() + 1}-assistant`
    const newVersion: AssistantVersion = {
      id: versionId,
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      sources: sources.length > 0 ? sources : undefined,
      isStreaming: true,
    }

    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat
        if (existingAssistantMsgId) {
          // Add version to existing assistant message
          return {
            ...chat,
            messages: chat.messages.map((msg) => {
              if (msg.id !== existingAssistantMsgId) return msg
              const versions = [...(msg.versions ?? []), newVersion]
              return { ...msg, versions, activeVersionIndex: versions.length - 1 }
            }),
          }
        } else {
          // Create new assistant message with pre-computed ID
          const assistantMessage: Message = {
            id: assistantMsgId,
            role: "assistant",
            content: "",
            timestamp: newVersion.timestamp,
            versions: [newVersion],
            activeVersionIndex: 0,
          }
          return { ...chat, messages: [...chat.messages, assistantMessage] }
        }
      })
    )

    streamingRef.current = { chatId, assistantMsgId, versionId }

    try {
      await window.llm.chat({ chatId, messages: llmMessages, contextNotes })
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId) return chat
          return {
            ...chat,
            messages: chat.messages.map((msg) => {
              if (msg.id !== assistantMsgId) return msg
              return {
                ...msg,
                versions: msg.versions!.map((v) =>
                  v.id === versionId ? { ...v, isStreaming: false } : v
                ),
              }
            }),
          }
        })
      )
    } catch (err) {
      const errorText = err instanceof Error ? err.message : "LLM request failed."
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId) return chat
          return {
            ...chat,
            messages: chat.messages.map((msg) => {
              if (msg.id !== assistantMsgId) return msg
              return {
                ...msg,
                versions: msg.versions!.map((v) =>
                  v.id === versionId ? { ...v, content: errorText, isStreaming: false, error: true } : v
                ),
              }
            }),
          }
        })
      )
    } finally {
      streamingRef.current = null
    }
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isSearching || isGenerating) return
    const queryText = input.trim()
    setInput("")

    let chatId = selectedChatId
    if (!chatId) {
      const newChat: Chat = { id: Date.now().toString(), title: queryText.slice(0, 40), messages: [], createdAt: new Date() }
      setChats((prev) => [newChat, ...prev])
      setSelectedChatId(newChat.id)
      chatId = newChat.id
    }

    const historyMessages = chats.find((c) => c.id === chatId)?.messages ?? []
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    }

    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat
        return {
          ...chat,
          messages: [...chat.messages, userMessage],
          title: chat.messages.length === 0 ? queryText.slice(0, 40) : chat.title,
        }
      })
    )

    const llmMessages: LLMChatMessage[] = [
      ...historyMessages.map((m) => {
        if (m.role === "assistant") {
          const v = m.versions?.[m.activeVersionIndex ?? 0]
          return { role: "assistant" as const, content: v?.content ?? m.content }
        }
        return { role: "user" as const, content: m.content }
      }),
      { role: "user", content: queryText },
    ]

    await runLLM(chatId!, queryText, llmMessages)
  }

  // Retry: re-run the same user message, adding new version to the following assistant message
  const handleRetry = useCallback(async (userMsgIndex: number) => {
    if (!selectedChatId || isSearching || isGenerating) return
    const chat = chats.find((c) => c.id === selectedChatId)
    if (!chat) return

    const userMsg = chat.messages[userMsgIndex]
    const assistantMsg = chat.messages[userMsgIndex + 1]
    if (!userMsg || userMsg.role !== "user" || !assistantMsg || assistantMsg.role !== "assistant") return

    // Build history up to (not including) the assistant message
    const historyMessages: LLMChatMessage[] = chat.messages.slice(0, userMsgIndex).map((m) => {
      if (m.role === "assistant") {
        const v = m.versions?.[m.activeVersionIndex ?? 0]
        return { role: "assistant" as const, content: v?.content ?? m.content }
      }
      return { role: "user" as const, content: m.content }
    })
    historyMessages.push({ role: "user", content: userMsg.content })

    await runLLM(selectedChatId, userMsg.content, historyMessages, assistantMsg.id)
  }, [selectedChatId, chats, isSearching, isGenerating, runLLM])

  const handleVersionNav = (chatId: string, msgId: string, delta: number) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat
        return {
          ...chat,
          messages: chat.messages.map((msg) => {
            if (msg.id !== msgId) return msg
            const total = msg.versions?.length ?? 1
            const current = msg.activeVersionIndex ?? 0
            const next = Math.max(0, Math.min(total - 1, current + delta))
            return { ...msg, activeVersionIndex: next }
          }),
        }
      })
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleSources = (messageId: string) => {
    setExpandedSources((prev) => ({ ...prev, [messageId]: !prev[messageId] }))
  }

  const isInputDisabled = isSearching || isGenerating

  return (
    <div className="flex h-full">
      {/* Chat History Panel */}
      <div className="flex w-65 shrink-0 flex-col border-r border-nore-border bg-nore-base">
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-(--nore-accent) px-3 py-2 text-sm text-(--nore-accent) transition-all hover:bg-(--nore-accent-muted) hover:scale-[1.01]"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
          {chats.length === 0 ? (
            <p className="px-2 py-4 text-xs text-nore-text-tertiary">No conversations yet</p>
          ) : (
            groupOrder.map((group) => {
              const groupChats = groupedChats[group]
              if (!groupChats || groupChats.length === 0) return null
              return (
                <div key={group} className="mb-4">
                  <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">{group}</h3>
                  <div className="space-y-0.5">
                    {groupChats.map((chat) => (
                      <div
                        key={chat.id}
                        className={`group relative flex items-center rounded-md transition-colors ${selectedChatId === chat.id ? "bg-(--nore-accent-muted)" : "hover:bg-nore-elevated"}`}
                      >
                        {selectedChatId === chat.id && (
                          <div className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full" style={{ backgroundColor: "var(--nore-accent)" }} />
                        )}
                        <button onClick={() => setSelectedChatId(chat.id)} className="flex-1 truncate px-3 py-2 text-left text-sm text-nore-text-primary">
                          {chat.title}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="mr-1 flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity hover:bg-nore-border group-hover:opacity-100">
                              <MoreHorizontal className="h-3.5 w-3.5 text-nore-text-secondary" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-nore-border bg-nore-elevated">
                            <DropdownMenuItem className="text-nore-text-primary hover:bg-nore-border focus:bg-nore-border">
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteChat(chat.id)} className="text-red-400 hover:bg-nore-border focus:bg-nore-border">
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="border-t border-nore-border px-4 py-3">
          <p className="text-xs text-nore-text-tertiary">{chats.length} conversations</p>
        </div>
      </div>

      {/* Conversation Area */}
      <div className="flex flex-1 flex-col">
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8">
            <div className="mb-4 flex h-8 w-8 items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--nore-text-secondary)" }}>
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <p className="mb-4 text-sm text-nore-text-secondary">Ask your knowledge base</p>
            <p className="mb-6 text-xs text-nore-text-tertiary">
              {noteCount} notes indexed &middot; {tagCount} tags &middot; {backlinkCount} backlinks
              {lastIndexed && <> &middot; Last synced {lastIndexed}</>}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {promptSuggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(suggestion); textareaRef.current?.focus() }}
                  className="rounded-lg border border-nore-border bg-transparent px-4 py-2 text-sm text-nore-text-secondary transition-all hover:border-nore-border-hover hover:text-nore-text-primary hover:shadow-[0_0_12px_var(--nore-accent-muted)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
            <div className="mx-auto max-w-180 space-y-6">
              {messages.map((message, msgIndex) => {
                const isUser = message.role === "user"
                const activeVersion = message.versions?.[message.activeVersionIndex ?? 0]
                const totalVersions = message.versions?.length ?? 1
                const activeIdx = message.activeVersionIndex ?? 0
                const content = activeVersion?.content ?? message.content
                const isStreaming = activeVersion?.isStreaming ?? false
                const isError = activeVersion?.error ?? false
                const sources = activeVersion?.sources

                return (
                  <div key={message.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="mb-2 flex items-center gap-2">
                      {isUser ? (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-nore-elevated text-xs font-medium text-nore-text-secondary">Y</div>
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center">
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: isError ? "var(--nore-text-tertiary)" : "var(--nore-accent)" }}>
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5" />
                            <path d="M2 12l10 5 10-5" />
                          </svg>
                        </div>
                      )}
                      <span className="text-sm font-medium text-nore-text-primary">{isUser ? "You" : "Nore"}</span>
                      <span className="text-xs text-nore-text-tertiary">{activeVersion?.timestamp ?? message.timestamp}</span>

                      {/* User message: retry button */}
                      {isUser && (
                        <button
                          onClick={() => handleRetry(msgIndex)}
                          disabled={isGenerating || isSearching}
                          title="Regenerate response"
                          className="ml-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-nore-text-tertiary opacity-0 transition-all hover:bg-nore-elevated hover:text-nore-text-secondary group-hover:opacity-100 disabled:pointer-events-none [.group:hover_&]:opacity-100"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className={`ml-8 ${isUser ? "rounded-lg bg-nore-elevated px-4 py-3" : ""}`}>
                      {isUser ? (
                        <p className="select-text whitespace-pre-wrap text-sm leading-relaxed text-nore-text-primary">{content}</p>
                      ) : (
                        <div className={`select-text text-sm leading-relaxed ${isError ? "text-nore-text-secondary" : "text-nore-text-primary"}`}>
                          {/* Markdown rendering */}
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                              h1: ({ children }) => <h1 className="mb-3 mt-4 text-lg font-bold text-nore-text-primary">{children}</h1>,
                              h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-semibold text-nore-text-primary">{children}</h2>,
                              h3: ({ children }) => <h3 className="mb-2 mt-3 text-sm font-semibold text-nore-text-primary">{children}</h3>,
                              ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="text-sm">{children}</li>,
                              code: ({ children, className }) => {
                                const isBlock = className?.includes('language-')
                                return isBlock
                                  ? <code className="block rounded bg-nore-elevated px-3 py-2 font-mono text-xs">{children}</code>
                                  : <code className="rounded bg-nore-elevated px-1 py-0.5 font-mono text-xs">{children}</code>
                              },
                              pre: ({ children }) => <pre className="mb-3 overflow-x-auto rounded bg-nore-elevated p-3">{children}</pre>,
                              blockquote: ({ children }) => <blockquote className="mb-3 border-l-2 border-nore-border pl-3 text-nore-text-secondary">{children}</blockquote>,
                              strong: ({ children }) => <strong className="font-semibold text-nore-text-primary">{children}</strong>,
                              hr: () => <hr className="my-3 border-nore-border" />,
                            }}
                          >
                            {content}
                          </ReactMarkdown>
                          {isStreaming && <StreamingCursor />}
                        </div>
                      )}

                      {/* Sources */}
                      {sources && sources.length > 0 && !isStreaming && (
                        <div className="mt-4">
                          <button
                            onClick={() => toggleSources(message.id)}
                            className="flex items-center gap-1.5 text-xs text-nore-text-secondary transition-colors cursor-pointer hover:text-(--nore-accent) hover:text-nore-text-primary"
                          >
                            {expandedSources[message.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <Link2 className="h-3 w-3" />
                            <span>{sources.length} sources</span>
                          </button>
                          {expandedSources[message.id] && (
                            <div className="mt-3 space-y-2">
                              {sources.map((source, i) => (
                                <div key={i} onClick={() => setPopupNote(source)} className="group cursor-pointer rounded-md border border-nore-border bg-nore-base p-3 transition-colors hover:border-(--nore-accent)">
                                  <p className="text-sm font-medium text-nore-text-primary transition-colors group-hover:text-(--nore-accent)">{source.title}</p>
                                  <p className="mt-0.5 font-mono text-xs text-nore-text-tertiary">{source.path}</p>
                                  {source.excerpt && <p className="mt-1 line-clamp-2 text-xs text-nore-text-secondary">{source.excerpt}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Assistant message toolbar: copy + version navigation */}
                      {!isUser && !isStreaming && content && (
                        <div className="mt-2 flex items-center gap-1">
                          <CopyButton text={content} />
                          {totalVersions > 1 && (
                            <div className="ml-2 flex items-center gap-1">
                              <button
                                onClick={() => handleVersionNav(selectedChatId!, message.id, -1)}
                                disabled={activeIdx === 0}
                                className="flex h-6 w-6 items-center justify-center rounded text-nore-text-tertiary transition-colors hover:bg-nore-elevated hover:text-nore-text-secondary disabled:opacity-30"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </button>
                              <span className="text-xs text-nore-text-tertiary">{activeIdx + 1}/{totalVersions}</span>
                              <button
                                onClick={() => handleVersionNav(selectedChatId!, message.id, +1)}
                                disabled={activeIdx === totalVersions - 1}
                                className="flex h-6 w-6 items-center justify-center rounded text-nore-text-tertiary transition-colors hover:bg-nore-elevated hover:text-nore-text-secondary disabled:opacity-30"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          {/* Retry button below user message — show on following assistant message */}
                          {messages[msgIndex - 1]?.role === "user" && (
                            <button
                              onClick={() => handleRetry(msgIndex - 1)}
                              disabled={isGenerating || isSearching}
                              title="Regenerate"
                              className="ml-1 flex items-center gap-1 rounded px-1.5 py-1 text-xs text-nore-text-tertiary transition-colors cursor-pointer hover:text-(--nore-accent) hover:bg-nore-elevated hover:text-nore-text-secondary disabled:opacity-30"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Retry
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {isSearching && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-nore-border bg-nore-base px-6 py-4">
          <div className="mx-auto max-w-180">
            <p className="mb-2 text-xs text-nore-text-tertiary">
              {isSearching ? "Searching vault..." : isGenerating ? "Generating response..." : `Searching across ${noteCount} notes`}
            </p>
            <div className="flex items-end gap-3 rounded-lg border border-nore-border bg-nore-surface p-3 transition-colors focus-within:border-(--nore-accent)">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your knowledge base..."
                rows={1}
                disabled={isInputDisabled}
                className="flex-1 resize-none bg-transparent text-sm text-nore-text-primary placeholder:text-nore-text-tertiary focus:outline-none disabled:opacity-50"
                style={{ maxHeight: "120px" }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isInputDisabled}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${input.trim() && !isInputDisabled ? "bg-(--nore-accent) text-white hover:opacity-90" : "bg-nore-elevated text-nore-text-tertiary"}`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {popupNote && (
        <NotePopup
          source={popupNote}
          onClose={() => setPopupNote(null)}
          onOpenInWrite={onOpenInWrite}
        />
      )}
    </div>
  )
}
