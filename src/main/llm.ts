import OpenAI from 'openai'
import { getActiveConnection, getConnectionApiKey } from './settings'

export interface LLMChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamChatParams {
  chatId: string
  messages: LLMChatMessage[]
  contextNotes: string
  onToken: (token: string) => void
}

function buildSystemPrompt(contextNotes: string): string {
  const hasContext = contextNotes.trim().length > 0
  return `You are Nore, an intelligent assistant for personal knowledge management. You help users explore and understand their notes.

${
  hasContext
    ? `Here are the most relevant notes from the user's vault:\n\n${contextNotes}\n\nUse these notes to inform your answer. Be concise and insightful. Reference specific notes when relevant.`
    : "No relevant notes were found in the vault for this query. Answer based on general knowledge and let the user know their vault doesn't contain information on this topic."
}`
}

async function streamChatOpenAI(
  params: StreamChatParams,
  apiKey: string,
  baseURL?: string,
  model?: string
): Promise<void> {
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })

  const stream = await client.chat.completions.create({
    model: model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildSystemPrompt(params.contextNotes) },
      ...params.messages.map((m) => ({ role: m.role, content: m.content }))
    ],
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
      system: buildSystemPrompt(params.contextNotes),
      messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
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

export async function streamChat(params: StreamChatParams): Promise<void> {
  const conn = getActiveConnection()
  if (!conn) throw new Error('No active LLM connection. Add one in Settings → AI Model.')

  const apiKey = getConnectionApiKey(conn.id)

  switch (conn.provider) {
    case 'openai':
      if (!apiKey) throw new Error('OpenAI API key is not configured.')
      return streamChatOpenAI(params, apiKey, conn.baseUrl || undefined, conn.model)

    case 'anthropic':
      if (!apiKey) throw new Error('Anthropic API key is not configured.')
      return streamChatAnthropic(params, apiKey, conn.model)

    case 'ollama': {
      const base = (conn.baseUrl || 'http://localhost:11434').replace(/\/$/, '')
      return streamChatOpenAI(params, 'ollama', `${base}/v1`, conn.model)
    }

    case 'lmstudio': {
      const base = (conn.baseUrl || 'http://localhost:1234').replace(/\/$/, '')
      return streamChatOpenAI(params, 'lmstudio', `${base}/v1`, conn.model)
    }

    default:
      throw new Error(`Unknown LLM provider: ${conn.provider}`)
  }
}
