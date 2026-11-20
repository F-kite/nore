import * as lancedb from '@lancedb/lancedb'
import { getSavedDbPath } from './vault'

export interface NoteRecord {
  id: string
  filePath: string
  relativePath: string
  title: string
  content: string
  createdAt: number
  modifiedAt: number
  vector: number[]
  [key: string]: unknown
}

let db: lancedb.Connection | null = null
let currentDbPath: string | null = null

export async function getDb(): Promise<lancedb.Connection> {
  const dbPath = getSavedDbPath()

  // Reconnect if path changed
  if (db && currentDbPath !== dbPath) {
    db = null
  }

  if (!db) {
    db = await lancedb.connect(dbPath)
    currentDbPath = dbPath
  }
  return db
}

export async function getNotesTable(db: lancedb.Connection) {
  const tableNames = await db.tableNames()

  if (tableNames.includes('notes')) {
    return await db.openTable('notes')
  }

  // Создаём таблицу с пустой записью-шаблоном
  const table = await db.createTable('notes', [
    {
      id: '__init__',
      filePath: '',
      relativePath: '',
      title: '',
      content: '',
      createdAt: 0,
      modifiedAt: 0,
      vector: Array(1024).fill(0)
    }
  ])

  // Удаляем инициализирующую запись
  await table.delete("id = '__init__'")

  return table
}
