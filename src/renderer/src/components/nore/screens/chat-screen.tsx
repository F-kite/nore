
import { useState, useRef, useEffect } from "react"
import { ArrowUp, ChevronDown, ChevronRight, Link2, Plus, MoreHorizontal, Trash2, Pencil } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu"

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
}

interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

const mockSources: Source[] = [
  {
    title: "2024-01-15 Deep Work Summary",
    path: "productivity/deep-work-summary.md",
    excerpt: "Cal Newport argues that deep work is becoming increasingly rare in our economy...",
  },
  {
    title: "Zettelkasten Method Notes",
    path: "methods/zettelkasten.md",
    excerpt: "The Zettelkasten method emphasizes atomic notes and meaningful connections...",
  },
  {
    title: "Weekly Review Template",
    path: "templates/weekly-review.md",
    excerpt: "Review what worked, what didn't, and plan for the upcoming week...",
  },
]

const mockChats: Chat[] = [
  {
    id: "1",
    title: "Productivity systems overview",
    messages: [
      {
        id: "1-1",
        role: "user",
        content: "What have I written about productivity systems?",
        timestamp: "2:34 PM",
      },
      {
        id: "1-2",
        role: "assistant",
        content: `Based on your notes, you've explored several productivity frameworks. Your Deep Work summary from January highlights Cal Newport's emphasis on distraction-free focus periods. You've also documented the Zettelkasten method as a way to build a "second brain" through atomic notes.

Your Weekly Review Template shows you practice regular reflection, which aligns with GTD principles. There's an interesting connection between your deep work notes and your time-blocking experiments from February.

I notice you haven't yet connected your spaced repetition research to your productivity system - this could be valuable for retaining insights from your reading.`,
        timestamp: "2:35 PM",
        sources: mockSources,
      },
    ],
    createdAt: new Date(),
  },
  {
    id: "2",
    title: "Deep work vs shallow work",
    messages: [],
    createdAt: new Date(),
  },
  {
    id: "3",
    title: "Zettelkasten method questions",
    messages: [],
    createdAt: new Date(Date.now() - 86400000), // Yesterday
  },
  {
    id: "4",
    title: "Weekly review template ideas",
    messages: [],
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: "5",
    title: "Spaced repetition research",
    messages: [],
    createdAt: new Date(Date.now() - 86400000 * 3),
  },
  {
    id: "6",
    title: "Book notes: Atomic Habits",
    messages: [],
    createdAt: new Date(Date.now() - 86400000 * 5),
  },
]

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

export function ChatScreen({ noteCount, tagCount, backlinkCount, lastIndexed }: ChatScreenProps) {
  const [chats, setChats] = useState<Chat[]>(mockChats)
  const [selectedChatId, setSelectedChatId] = useState<string | null>("1")
  const [input, setInput] = useState("")
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedChat = chats.find(c => c.id === selectedChatId)
  const messages = selectedChat?.messages || []
  const isEmpty = messages.length === 0
  const groupedChats = groupChatsByDate(chats)
  const groupOrder = ["Today", "Yesterday", "Previous 7 Days", "Older"]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New conversation",
      messages: [],
      createdAt: new Date(),
    }
    setChats([newChat, ...chats])
    setSelectedChatId(newChat.id)
  }

  const handleDeleteChat = (chatId: string) => {
    setChats(chats.filter(c => c.id !== chatId))
    if (selectedChatId === chatId) {
      setSelectedChatId(chats[0]?.id || null)
    }
  }

  const handleSend = () => {
    if (!input.trim() || !selectedChatId) return

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    }

    setChats(chats.map(chat => {
      if (chat.id === selectedChatId) {
        const updatedMessages = [...chat.messages, newMessage]
        return {
          ...chat,
          messages: updatedMessages,
          title: chat.messages.length === 0 ? input.trim().slice(0, 40) : chat.title,
        }
      }
      return chat
    }))
    setInput("")

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm analyzing your knowledge base to find relevant information about your query. This is a mock response demonstrating the chat interface.",
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        sources: mockSources.slice(0, 2),
      }
      setChats(prev => prev.map(chat => {
        if (chat.id === selectedChatId) {
          return { ...chat, messages: [...chat.messages, aiResponse] }
        }
        return chat
      }))
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleSources = (messageId: string) => {
    setExpandedSources(prev => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    textareaRef.current?.focus()
  }

  return (
    <div className="flex h-full">
      {/* Chat History Panel */}
      <div className="flex w-[260px] flex-shrink-0 flex-col border-r border-nore-border bg-nore-base">
        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--nore-accent)] px-3 py-2 text-sm text-[var(--nore-accent)] transition-all hover:bg-[var(--nore-accent-muted)] hover:scale-[1.01]"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2">
          {groupOrder.map(group => {
            const groupChats = groupedChats[group]
            if (!groupChats || groupChats.length === 0) return null
            
            return (
              <div key={group} className="mb-4">
                <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-nore-text-tertiary">
                  {group}
                </h3>
                <div className="space-y-0.5">
                  {groupChats.map(chat => (
                    <div
                      key={chat.id}
                      className={`group relative flex items-center rounded-md transition-colors ${
                        selectedChatId === chat.id
                          ? "bg-[var(--nore-accent-muted)]"
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
                        <DropdownMenuContent align="end" className="bg-nore-elevated border-nore-border">
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
          })}
        </div>

        {/* Chat Counter */}
        <div className="border-t border-nore-border px-4 py-3">
          <p className="text-xs text-nore-text-tertiary">{chats.length} conversations</p>
        </div>
      </div>

      {/* Conversation Area */}
      <div className="flex flex-1 flex-col">
        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center px-8">
            <div className="mb-4 flex h-8 w-8 items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ color: "var(--nore-text-secondary)" }}
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            
            <p className="mb-4 text-sm text-nore-text-secondary">Ask your knowledge base</p>
            
            <p className="mb-6 text-xs text-nore-text-tertiary">
              {noteCount} notes indexed &middot; {tagCount} tags &middot; {backlinkCount} backlinks &middot; Last synced {lastIndexed}
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
          /* Chat messages */
          <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
            <div className="mx-auto max-w-[720px] space-y-6">
              {messages.map((message) => (
                <div key={message.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Message header */}
                  <div className="mb-2 flex items-center gap-2">
                    {message.role === "user" ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-nore-elevated text-xs font-medium text-nore-text-secondary">
                        Y
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center">
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
                    )}
                    <span className="text-sm font-medium text-nore-text-primary">
                      {message.role === "user" ? "You" : "Nore"}
                    </span>
                    <span className="text-xs text-nore-text-tertiary">{message.timestamp}</span>
                  </div>
                  
                  {/* Message content */}
                  <div className={`ml-8 ${message.role === "user" ? "rounded-lg bg-nore-elevated px-4 py-3" : ""}`}>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-nore-text-primary">
                      {message.content}
                    </p>
                    
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-4">
                        <button
                          onClick={() => toggleSources(message.id)}
                          className="flex items-center gap-1.5 text-xs text-nore-text-secondary hover:text-nore-text-primary transition-colors"
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
                                className="group cursor-pointer rounded-md border border-nore-border bg-nore-base p-3 hover:border-nore-border-hover transition-colors"
                              >
                                <p className="text-sm font-medium text-nore-text-primary group-hover:text-[var(--nore-accent)] transition-colors">
                                  {source.title}
                                </p>
                                <p className="mt-0.5 font-mono text-xs text-nore-text-tertiary">
                                  {source.path}
                                </p>
                                <p className="mt-1 text-xs text-nore-text-secondary line-clamp-1">
                                  {source.excerpt}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-nore-border bg-nore-base px-6 py-4">
          <div className="mx-auto max-w-[720px]">
            <p className="mb-2 text-xs text-nore-text-tertiary">
              Searching across {noteCount} notes
            </p>
            <div className="flex items-end gap-3 rounded-lg border border-nore-border bg-nore-surface p-3 focus-within:border-[var(--nore-accent)] transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your knowledge base..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-nore-text-primary placeholder:text-nore-text-tertiary focus:outline-none"
                style={{ maxHeight: "120px" }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  input.trim()
                    ? "bg-[var(--nore-accent)] text-white hover:opacity-90"
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
