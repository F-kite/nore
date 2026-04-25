import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from 'openai/resources/chat/completions'
import { getActiveConnection, getConnectionApiKey, getLlmConnections } from './settings'

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

export interface StreamChatParams {
  chatId: string
  messages: LLMChatMessage[]
  contextNotes: string
  model?: string // override connection's default model
  attachments?: ChatAttachment[]
  onToken: (token: string) => void
}

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
      : `No relevant notes found for this query. Answer from general knowledge and mention that the user's vault doesn't cover this topic yet.`
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
      // Text files → prepend to message
      let text = msg.content
      for (const att of params.attachments!) {
        if (att.type === 'text') {
          text += `\n\n--- File: ${att.name} ---\n${att.content}`
        }
      }
      parts.push({ type: 'text', text })
      // Images → image_url parts
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
      // Images first (Anthropic expects images before text)
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
  baseURL?: string,
  model?: string
): Promise<void> {
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })
  const systemPrompt = buildSystemPrompt(params.contextNotes)

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
  model?: string
): Promise<void> {
  const systemPrompt = buildSystemPrompt(params.contextNotes)

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

  switch (conn.provider) {
    case 'openai':
      if (!apiKey) throw new Error('OpenAI API key is not configured.')
      return streamChatOpenAI(params, apiKey, conn.baseUrl || undefined, model)

    case 'anthropic':
      if (!apiKey) throw new Error('Anthropic API key is not configured.')
      return streamChatAnthropic(params, apiKey, model)

    case 'ollama': {
      const base = (conn.baseUrl || 'http://localhost:11434').replace(/\/$/, '')
      return streamChatOpenAI(params, 'ollama', `${base}/v1`, model)
    }

    case 'lmstudio': {
      const base = (conn.baseUrl || 'http://localhost:1234').replace(/\/$/, '')
      return streamChatOpenAI(params, 'lmstudio', `${base}/v1`, model)
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
