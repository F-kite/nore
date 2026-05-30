import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from 'openai/resources/chat/completions'
import { getActiveConnection, getConnectionApiKey, getLlmConnections } from './settings'
import { searchNotes } from './indexer'

// --- Types ---

export interface LLMChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatAttachment {
  name: string
  type: 'text' | 'image'
  content: string // text content or base64 data (without data: prefix)
  mimeType?: string // e.g. image/png
}

export interface SearchNoteSource {
  title: string
  relativePath: string
  content: string
  excerpt: string
  _distance?: number
}

export interface StreamChatParams {
  chatId: string
  messages: LLMChatMessage[]
  model?: string // override connection's default model
  attachments?: ChatAttachment[]
  onToken: (token: string) => void
  onSources?: (sources: SearchNoteSource[]) => void
}

// --- Intent check ---

// --- Heuristic intent detection (fast, no API call) ---

function heuristicIntent(
  messages: LLMChatMessage[]
): { verdict: 'no' | 'yes' | 'maybe'; query: string } {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const lower = lastUserMsg.toLowerCase().trim()
  const query = lastUserMsg.slice(0, 300)

  // Clearly conversational — very short, no question mark, no semantic content
  if (lower.length < 25 && !/[?]/.test(lower)) return { verdict: 'no', query }

  // Greetings and social phrases
  const noPatterns = [
    /^(привет|здравствуй|добрый\s+(день|утро|вечер)|хай|хей|privet)/,
    /^(hello|hi[\s,!]|hey[\s,!]|good\s+(morning|afternoon|evening))/,
    /^(спасибо|благодарю|thanks|thank\s+you|ок|ok|хорошо|понял|ясно|понятно|отлично|супер|класс)/,
    /^(пока|bye|до\s+свидания)/,
  ]
  if (noPatterns.some((r) => r.test(lower))) return { verdict: 'no', query }

  // Explicit note-vault queries
  const yesPatterns = [
    /мои\s+заметки|my\s+notes|my\s+vault/,
    /что\s+я\s+(писал|думал|заметил|записал|изучал)/,
    /what\s+(did\s+i|have\s+i)\s+(written?|noted?|thought|studied)/,
    /найди|поищи|покажи\s+мне|show\s+me|find\s+my/,
    /в\s+моих\s+(заметках|записях)|из\s+(моих\s+)?(заметок|записей)/,
    /из\s+базы\s+знаний|в\s+базе\s+знаний/,
  ]
  if (yesPatterns.some((r) => r.test(lower))) return { verdict: 'yes', query }

  // Pure creative/code tasks with no reference to personal notes
  const noCreativePattern = /^(напиши|создай|сгенерируй|write\s+me|generate|create)\s+(?!.*(мо[йеяих]|my\s+notes|заметк))/
  if (noCreativePattern.test(lower) && lower.length < 120) return { verdict: 'no', query }

  return { verdict: 'maybe', query }
}

const INTENT_PROMPT = `You are a search router. Decide if this message needs to search the user's personal notes vault.

Respond ONLY with valid JSON: {"shouldSearch": true/false, "query": "optimized search terms"}

SEARCH when message asks about: specific topics the user might have notes on, their past ideas/plans/writings, knowledge from their vault.
DO NOT SEARCH for: casual chat, greetings, general knowledge questions, pure creative/coding tasks.`

async function checkSearchIntent(
  messages: LLMChatMessage[],
  provider: string,
  apiKey: string | null,
  baseURL: string | undefined,
  model: string
): Promise<{ shouldSearch: boolean; query: string }> {
  // Step 1: fast heuristic check (no API call)
  const heuristic = heuristicIntent(messages)
  if (heuristic.verdict === 'no') return { shouldSearch: false, query: '' }
  if (heuristic.verdict === 'yes') return { shouldSearch: true, query: heuristic.query }

  // Step 2: ambiguous — ask the LLM (fallback: search, because topic questions usually benefit from context)
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const fallback = { shouldSearch: true, query: lastUserMsg.slice(0, 300) }

  try {
    let text = ''
    const userPrompt = `Message: "${lastUserMsg.slice(0, 500)}"`

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 80,
          system: INTENT_PROMPT,
          messages: [{ role: 'user', content: userPrompt }]
        })
      })
      if (!res.ok) return fallback
      const data = await res.json()
      text = data.content?.[0]?.text ?? ''
    } else {
      const client = new OpenAI({ apiKey: apiKey ?? 'none', ...(baseURL ? { baseURL } : {}) })
      const res = await client.chat.completions.create({
        model,
        max_tokens: 80,
        temperature: 0,
        messages: [
          { role: 'system', content: INTENT_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      })
      text = res.choices[0]?.message?.content ?? ''
    }

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    const parsed = JSON.parse(match[0])
    return {
      shouldSearch: Boolean(parsed.shouldSearch),
      query: (typeof parsed.query === 'string' && parsed.query.trim()
        ? parsed.query
        : lastUserMsg
      ).slice(0, 300)
    }
  } catch {
    return fallback
  }
}

// Minimum cosine similarity for a note to be included as context (~65%)
// Cosine similarity = 1 - d²/2  →  d_max = sqrt(2 * (1 - 0.65)) = sqrt(0.70) ≈ 0.837
const CONTEXT_DISTANCE_THRESHOLD = 0.837

// --- System prompt ---

function buildSystemPrompt(contextNotes: string): string {
  const hasContext = contextNotes.trim().length > 0
  return `You are Nore — an AI assistant for personal knowledge management. You help the user explore, connect, and build on their notes.

Rules:
- Respond in the same language the user writes in.
- Be concise. Prefer short paragraphs over long walls of text.
- When referencing a note, mention its title in bold: **Note Title**.
- Never fabricate note content. If you're unsure, say so.
- When you see connections between notes, point them out.

${hasContext
      ? `Relevant notes from the user's vault:\n\n${contextNotes}\n\nUse these notes to answer. Highlight connections between them when relevant. If the notes only partially cover the question, say what's missing.`
      : `No relevant notes from the vault for this query. Answer from general knowledge.`
    }`
}

// --- Message builders (handle attachments for the last user message) ---

function buildOpenAIMessages(
  params: StreamChatParams,
  systemPrompt: string
): ChatCompletionMessageParam[] {
  const result: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt }
  ]

  for (let i = 0; i < params.messages.length; i++) {
    const msg = params.messages[i]
    const isLast = i === params.messages.length - 1
    const hasAttachments = isLast && msg.role === 'user' && params.attachments?.length

    if (hasAttachments) {
      const parts: ChatCompletionContentPart[] = []
      let text = msg.content
      for (const att of params.attachments!) {
        if (att.type === 'text') {
          text += `\n\n--- File: ${att.name} ---\n${att.content}`
        }
      }
      parts.push({ type: 'text', text })
      for (const att of params.attachments!) {
        if (att.type === 'image') {
          parts.push({
            type: 'image_url',
            image_url: { url: `data:${att.mimeType || 'image/png'};base64,${att.content}` }
          })
        }
      }
      result.push({ role: 'user', content: parts })
    } else {
      result.push({ role: msg.role, content: msg.content })
    }
  }

  return result
}

function buildAnthropicMessages(params: StreamChatParams): unknown[] {
  const result: unknown[] = []

  for (let i = 0; i < params.messages.length; i++) {
    const msg = params.messages[i]
    const isLast = i === params.messages.length - 1
    const hasAttachments = isLast && msg.role === 'user' && params.attachments?.length

    if (hasAttachments) {
      const content: unknown[] = []
      let text = msg.content
      for (const att of params.attachments!) {
        if (att.type === 'text') {
          text += `\n\n--- File: ${att.name} ---\n${att.content}`
        }
      }
      for (const att of params.attachments!) {
        if (att.type === 'image') {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: att.mimeType || 'image/png',
              data: att.content
            }
          })
        }
      }
      content.push({ type: 'text', text })
      result.push({ role: 'user', content })
    } else {
      result.push({ role: msg.role, content: msg.content })
    }
  }

  return result
}

// --- Streaming implementations ---

async function streamChatOpenAI(
  params: StreamChatParams,
  apiKey: string,
  contextNotes: string,
  baseURL?: string,
  model?: string
): Promise<void> {
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })
  const systemPrompt = buildSystemPrompt(contextNotes)

  const stream = await client.chat.completions.create({
    model: model || 'gpt-4o-mini',
    messages: buildOpenAIMessages(params, systemPrompt),
    stream: true
  })

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || ''
    if (token) params.onToken(token)
  }
}

async function streamChatAnthropic(
  params: StreamChatParams,
  apiKey: string,
  contextNotes: string,
  model?: string
): Promise<void> {
  const systemPrompt = buildSystemPrompt(contextNotes)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: buildAnthropicMessages(params),
      stream: true
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${errText}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (!raw) continue
      try {
        const event = JSON.parse(raw)
        if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta' &&
          event.delta.text
        ) {
          params.onToken(event.delta.text)
        }
      } catch {
        // skip malformed SSE line
      }
    }
  }
}

// --- Public API ---

export async function streamChat(params: StreamChatParams): Promise<void> {
  const conn = getActiveConnection()
  if (!conn) throw new Error('No active LLM connection. Add one in Settings → AI Model.')

  const apiKey = getConnectionApiKey(conn.id)
  const model = params.model || conn.model

  // Phase 1: decide whether to search notes
  let contextNotes = ''
  try {
    const intent = await checkSearchIntent(
      params.messages,
      conn.provider,
      apiKey,
      conn.baseUrl || undefined,
      model
    )

    if (intent.shouldSearch) {
      const results = await searchNotes(intent.query, 15)
      // Keep only notes above the similarity threshold (sorted by distance asc from LanceDB)
      const relevant = results.filter((r) => {
        const d = typeof r._distance === 'number' ? r._distance : 1.414
        return d <= CONTEXT_DISTANCE_THRESHOLD
      })
      if (relevant.length > 0) {
        const sources: SearchNoteSource[] = relevant.map((r) => ({
          title: r.title,
          relativePath: r.relativePath,
          content: r.content,
          excerpt: r.content.replace(/^---[\s\S]*?---\n?/, '').trim().slice(0, 200),
          _distance: typeof r._distance === 'number' ? r._distance : undefined
        }))
        params.onSources?.(sources)
        contextNotes = sources
          .map((s, i) => `[${i + 1}] ${s.title}\nPath: ${s.relativePath}\n${s.excerpt}`)
          .join('\n\n---\n\n')
      }
    }
  } catch {
    // intent check or search failed — stream without context
  }

  // Phase 2: stream response
  switch (conn.provider) {
    case 'openai':
      if (!apiKey) throw new Error('OpenAI API key is not configured.')
      return streamChatOpenAI(params, apiKey, contextNotes, conn.baseUrl || undefined, model)

    case 'anthropic':
      if (!apiKey) throw new Error('Anthropic API key is not configured.')
      return streamChatAnthropic(params, apiKey, contextNotes, model)

    case 'ollama': {
      const base = (conn.baseUrl || 'http://localhost:11434').replace(/\/$/, '')
      return streamChatOpenAI(params, 'ollama', contextNotes, `${base}/v1`, model)
    }

    case 'lmstudio': {
      const base = (conn.baseUrl || 'http://localhost:1234').replace(/\/$/, '')
      return streamChatOpenAI(params, 'lmstudio', contextNotes, `${base}/v1`, model)
    }

    default:
      throw new Error(`Unknown LLM provider: ${conn.provider}`)
  }
}

export async function fetchModels(): Promise<string[]> {
  const conn = getActiveConnection()
  if (!conn) return []

  const apiKey = getConnectionApiKey(conn.id)

  try {
    switch (conn.provider) {
      case 'openai': {
        if (!apiKey) return []
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` }
        })
        if (!res.ok) return []
        const data = await res.json()
        return (data.data as { id: string }[])
          .map((m) => m.id)
          .filter((id) => id.startsWith('gpt-') || id.startsWith('o') || id.startsWith('chatgpt-'))
          .sort()
      }

      case 'anthropic':
        return [
          'claude-opus-4-20250514',
          'claude-sonnet-4-20250514',
          'claude-haiku-4-5-20251001'
        ]

      case 'ollama': {
        const base = (conn.baseUrl || 'http://localhost:11434').replace(/\/$/, '')
        const res = await fetch(`${base}/api/tags`)
        if (!res.ok) return []
        const data = await res.json()
        return (data.models as { name: string }[])?.map((m) => m.name) ?? []
      }

      case 'lmstudio': {
        const base = (conn.baseUrl || 'http://localhost:1234').replace(/\/$/, '')
        const res = await fetch(`${base}/v1/models`)
        if (!res.ok) return []
        const data = await res.json()
        return (data.data as { id: string }[])?.map((m) => m.id) ?? []
      }

      default:
        return []
    }
  } catch {
    return []
  }
}

/** Fetch models for a specific connection (not just the active one) */
export async function fetchModelsForConnection(connectionId: string): Promise<string[]> {
  const connections = getLlmConnections()
  const conn = connections.find((c) => c.id === connectionId)
  if (!conn) return []

  const apiKey = getConnectionApiKey(conn.id)

  try {
    switch (conn.provider) {
      case 'openai': {
        if (!apiKey) return []
        const url = conn.baseUrl
          ? `${conn.baseUrl.replace(/\/$/, '')}/v1/models`
          : 'https://api.openai.com/v1/models'
        const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
        if (!res.ok) return []
        const data = await res.json()
        return (data.data as { id: string }[]).map((m) => m.id).sort()
      }

      case 'anthropic':
        return [
          'claude-opus-4-20250514',
          'claude-sonnet-4-20250514',
          'claude-haiku-4-5-20251001'
        ]

      case 'ollama': {
        const base = (conn.baseUrl || 'http://localhost:11434').replace(/\/$/, '')
        const res = await fetch(`${base}/api/tags`)
        if (!res.ok) return []
        const data = await res.json()
        return (data.models as { name: string }[])?.map((m) => m.name) ?? []
      }

      case 'lmstudio': {
        const base = (conn.baseUrl || 'http://localhost:1234').replace(/\/$/, '')
        const res = await fetch(`${base}/v1/models`)
        if (!res.ok) return []
        const data = await res.json()
        return (data.data as { id: string }[])?.map((m) => m.id) ?? []
      }

      default:
        return []
    }
  } catch {
    return []
  }
}
