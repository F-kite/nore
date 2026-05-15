import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

// --- Types ---

export interface ConversationSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

export interface StoredVersion {
  id: string
  content: string
  timestamp: string
  sources?: unknown
  error?: boolean
}

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  versions?: StoredVersion[]
  activeVersionIndex?: number
}

export interface StoredChat {
  id: string
  title: string
  createdAt: number
  messages: StoredMessage[]
}

// --- DB singleton ---

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'conversations.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id           TEXT    PRIMARY KEY,
      title        TEXT    NOT NULL,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL,
      messages_json TEXT   NOT NULL DEFAULT '[]'
    )
  `)

  return db
}

// --- Public API ---

export function listConversations(): ConversationSummary[] {
  return getDb()
    .prepare(`
      SELECT
        id,
        title,
        created_at   AS createdAt,
        updated_at   AS updatedAt,
        json_array_length(messages_json) AS messageCount
      FROM conversations
      ORDER BY updated_at DESC
    `)
    .all() as ConversationSummary[]
}

export function loadConversation(id: string): StoredChat | null {
  const row = getDb()
    .prepare('SELECT id, title, created_at AS createdAt, messages_json FROM conversations WHERE id = ?')
    .get(id) as { id: string; title: string; createdAt: number; messages_json: string } | undefined

  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    messages: JSON.parse(row.messages_json) as StoredMessage[]
  }
}

export function saveConversation(chat: StoredChat): void {
  // Strip UI-only isStreaming flag before persisting
  const cleanMessages: StoredMessage[] = chat.messages.map((m) => ({
    ...m,
    versions: m.versions?.map((v) => {
      const clean: StoredVersion = { id: v.id, content: v.content, timestamp: v.timestamp }
      if (v.sources !== undefined) clean.sources = v.sources
      if (v.error) clean.error = v.error
      return clean
    })
  }))

  getDb()
    .prepare(`
      INSERT INTO conversations (id, title, created_at, updated_at, messages_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title         = excluded.title,
        updated_at    = excluded.updated_at,
        messages_json = excluded.messages_json
    `)
    .run(chat.id, chat.title, chat.createdAt, Date.now(), JSON.stringify(cleanMessages))
}

export function deleteConversation(id: string): void {
  getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id)
}

export function renameConversation(id: string, title: string): void {
  getDb()
    .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
    .run(title, Date.now(), id)
}
