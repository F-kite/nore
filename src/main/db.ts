import * as lancedb from '@lancedb/lancedb'
import { app } from 'electron'
import path from 'path'

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

export async function getDb(): Promise<lancedb.Connection> {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'lancedb')
    db = await lancedb.connect(dbPath)
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