
import { useState, useRef, useEffect } from "react"
import { ArrowUp, ChevronDown, ChevronRight, Link2, Plus, MoreHorizontal, Trash2, Pencil } from "lucide-react"
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
}

interface Source {
  title: string
  path: string
  excerpt: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  sources?: Source[]
  isStreaming?: boolean
  error?: boolean
}

interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

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
  return {
    title: note.title,
    path: note.relativePath,
    excerpt: note.content
      .replace(/^---[\s\S]*?---\n?/, "")
      .trim()
      .slice(0, 200),
  }
}

function formatContextNotes(sources: Source[]): string {
  if (sources.length === 0) return ""
  return sources
    .map((s, i) => `[${i + 1}] ${s.title}\nPath: ${s.path}\n${s.excerpt}`)
    .join("\n\n---\n\n")
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
  return (
    <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-text-bottom opacity-70" />
  )
}

const STORAGE_KEY = "nore-chats"

export function ChatScreen({ noteCount, tagCount, backlinkCount, lastIndexed }: ChatScreenProps) {
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamingRef = useRef<{ chatId: string; messageId: string } | null>(null)
  const persistedRef = useRef(false) // prevents saving before initial load completes

  const selectedChat = chats.find((c) => c.id === selectedChatId)
  const messages = selectedChat?.messages || []
  const isEmpty = messages.length === 0
  const groupedChats = groupChatsByDate(chats)
  const groupOrder = ["Today", "Yesterday", "Previous 7 Days", "Older"]
  const isGenerating = messages.some((m) => m.isStreaming)

  // Load persisted chats on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { chats: (Omit<Chat, "createdAt"> & { createdAt: string })[]; selectedChatId: string | null }
        const restored: Chat[] = parsed.chats.map((c) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          // clear streaming flag in case app was closed mid-stream
          messages: c.messages.map((m) => ({ ...m, isStreaming: false }))
        }))
        setChats(restored)
        setSelectedChatId(parsed.selectedChatId ?? null)
      }
    } catch {
      // corrupted storage — start fresh
    }
    persistedRef.current = true
  }, [])

  // Persist chats after every change (skip during streaming to avoid excessive writes)
  useEffect(() => {
    if (!persistedRef.current) return
    if (isGenerating) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ chats, selectedChatId }))
    } catch {
      // storage full or unavailable
    }
  }, [chats, selectedChatId, isGenerating])

  // Register LLM token listener once on mount
  useEffect(() => {
    window.llm.onToken(({ chatId: tChatId, token }) => {
      if (!streamingRef.current || streamingRef.current.chatId !== tChatId) return
      const msgId = streamingRef.current.messageId
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== tChatId) return chat
          return {
            ...chat,
            messages: chat.messages.map((msg) =>
              msg.id === msgId ? { ...msg, content: msg.content + token } : msg
            ),
          }
        })
      )
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSearching])

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New conversation",
      messages: [],
      createdAt: new Date(),
    }
    setChats((prev) => [newChat, ...prev])
    setSelectedChatId(newChat.id)
  }

  const handleDeleteChat = (chatId: string) => {
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== chatId)
      if (selectedChatId === chatId) {
        setSelectedChatId(filtered[0]?.id || null)
      }
      return filtered
    })
  }

  const handleSend = async () => {
    if (!input.trim() || isSearching || isGenerating) return

    const queryText = input.trim()
    setInput("")

    // Auto-create chat if none selected
    let chatId = selectedChatId
    if (!chatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: queryText.slice(0, 40),
        messages: [],
        createdAt: new Date(),
      }
      setChats((prev) => [newChat, ...prev])
      setSelectedChatId(newChat.id)
      chatId = newChat.id
    }

    // Capture history BEFORE adding new user message (for LLM context)
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

    // Build LLM message list: history + new user message
    const llmMessages: LLMChatMessage[] = [
      ...historyMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: queryText },
    ]

    // Phase 1: semantic search
    setIsSearching(true)
    let sources: Source[] = []
    let contextNotes = ""

    try {
      const noteResults: NoteRecord[] = await window.search.query(queryText)
      sources = noteResults.slice(0, 5).map(noteToSource)
      contextNotes = formatContextNotes(sources)
    } catch {
      // search failed — proceed without context
    }

    setIsSearching(false)

    // Phase 2: add empty assistant message, start LLM streaming
    const assistantMsgId = `${Date.now()}-assistant`
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      sources: sources.length > 0 ? sources : undefined,
      isStreaming: true,
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: [...chat.messages, assistantMessage] }
          : chat
      )
    )

    streamingRef.current = { chatId: chatId!, messageId: assistantMsgId }

    try {
      await window.llm.chat({ chatId: chatId!, messages: llmMessages, contextNotes })

      // Mark streaming done
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId) return chat
          return {
            ...chat,
            messages: chat.messages.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
            ),
          }
        })
      )
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : "LLM request failed. Check your API key and settings."

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId) return chat
          return {
            ...chat,
            messages: chat.messages.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: errorText, isStreaming: false, error: true }
                : msg
            ),
          }
        })
      )
    } finally {
      streamingRef.current = null
    }
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

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    textareaRef.current?.focus()
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
                  <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
                    {group}
                  </h3>
                  <div className="space-y-0.5">
                    {groupChats.map((chat) => (
                      <div
                        key={chat.id}
                        className={`group relative flex items-center rounded-md transition-colors ${
                          selectedChatId === chat.id
                            ? "bg-(--nore-accent-muted)"
                            : "hover:bg-nore-elevated"
                        }`}
                      >
                        {selectedChatId === chat.id && (
                          <div
                            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full"
                            style={{ backgroundColor: "var(--nore-accent)" }}
                          />
                        )}
                        <button
                          onClick={() => setSelectedChatId(chat.id)}
                          className="flex-1 truncate px-3 py-2 text-left text-sm text-nore-text-primary"
                        >
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
                            <DropdownMenuItem
                              onClick={() => handleDeleteChat(chat.id)}
                              className="text-red-400 hover:bg-nore-border focus:bg-nore-border"
                            >
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
                  onClick={() => handleSuggestionClick(suggestion)}
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
              {messages.map((message) => (
                <div key={message.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="mb-2 flex items-center gap-2">
                    {message.role === "user" ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-nore-elevated text-xs font-medium text-nore-text-secondary">
                        Y
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"
                          style={{ color: message.error ? "var(--nore-text-tertiary)" : "var(--nore-accent)" }}
                        >
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          <path d="M2 17l10 5 10-5" />
                          <path d="M2 12l10 5 10-5" />
                        </svg>
                      </div>
                    )}
                    <span className="text-sm font-medium text-nore-text-primary">
                      {message.role === "user" ? "You" : "Nore"}
                    </span>
                    <span className="text-xs text-nore-text-tertiary">{message.timestamp}</span>
                  </div>

                  <div className={`ml-8 ${message.role === "user" ? "rounded-lg bg-nore-elevated px-4 py-3" : ""}`}>
                    <p className={`whitespace-pre-wrap text-sm leading-relaxed ${
                      message.error ? "text-nore-text-secondary" : "text-nore-text-primary"
                    }`}>
                      {message.content}
                      {message.isStreaming && <StreamingCursor />}
                    </p>

                    {message.sources && message.sources.length > 0 && !message.isStreaming && (
                      <div className="mt-4">
                        <button
                          onClick={() => toggleSources(message.id)}
                          className="flex items-center gap-1.5 text-xs text-nore-text-secondary transition-colors hover:text-nore-text-primary"
                        >
                          {expandedSources[message.id] ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          <Link2 className="h-3 w-3" />
                          <span>{message.sources.length} sources</span>
                        </button>

                        {expandedSources[message.id] && (
                          <div className="mt-3 space-y-2">
                            {message.sources.map((source, i) => (
                              <div
                                key={i}
                                className="group cursor-pointer rounded-md border border-nore-border bg-nore-base p-3 transition-colors hover:border-nore-border-hover"
                              >
                                <p className="text-sm font-medium text-nore-text-primary transition-colors group-hover:text-(--nore-accent)">
                                  {source.title}
                                </p>
                                <p className="mt-0.5 font-mono text-xs text-nore-text-tertiary">
                                  {source.path}
                                </p>
                                {source.excerpt && (
                                  <p className="mt-1 line-clamp-2 text-xs text-nore-text-secondary">
                                    {source.excerpt}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isSearching && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-nore-border bg-nore-base px-6 py-4">
          <div className="mx-auto max-w-180">
            <p className="mb-2 text-xs text-nore-text-tertiary">
              {isSearching
                ? "Searching vault..."
                : isGenerating
                  ? "Generating response..."
                  : `Searching across ${noteCount} notes`}
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
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  input.trim() && !isInputDisabled
                    ? "bg-(--nore-accent) text-white hover:opacity-90"
                    : "bg-nore-elevated text-nore-text-tertiary"
                }`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
