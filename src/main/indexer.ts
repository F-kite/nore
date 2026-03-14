import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { getDb, getNotesTable, NoteRecord } from './db'
import { generateEmbeddingsBatch } from './embeddings'
import type { IndexingProgress, NoteFile } from '../types/indexer'

const BATCH_SIZE = 20 // Voyage AI позволяет до 128 за раз, берём 20 для надёжности

let currentProgress: IndexingProgress = {
    total: 0,
    processed: 0,
    status: 'idle'
}

export function getProgress(): IndexingProgress {
    return { ...currentProgress }
}

function extractTitle(filePath: string, content: string): string {
    // Пробуем взять H1 заголовок из контента
    const h1Match = content.match(/^#\s+(.+)$/m)
    if (h1Match) return h1Match[1].trim()

    // Иначе — имя файла без расширения
    return path.basename(filePath, '.md')
}

function prepareTextForEmbedding(title: string, content: string): string {
    // Убираем frontmatter
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '')
    // Убираем markdown разметку грубо
    const plainText = withoutFrontmatter
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/\[\[(.+?)\]\]/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        .trim()

    // Заголовок в начало — улучшает качество embedding
    return `${title}\n\n${plainText}`.slice(0, 8000) // Voyage лимит токенов
}

export async function indexVault(
    vaultPath: string,
    files: NoteFile[],
    onProgress: (progress: IndexingProgress) => void
): Promise<void> {
    currentProgress = { total: files.length, processed: 0, status: 'indexing' }
    onProgress(currentProgress)

    try {
        const db = await getDb()
        const table = await getNotesTable(db)

        const existingRecords = await table
            .query()
            .select(['filePath', 'modifiedAt'])
            .toArray()

        const existingMap = new Map<string, number>()
        for (const record of existingRecords) {
            existingMap.set(record.filePath as string, record.modifiedAt as number)
        }

        const filesToIndex = files.filter((f) => {
            const existingModifiedAt = existingMap.get(f.path)
            if (!existingModifiedAt) return true
            return f.modifiedAt > existingModifiedAt
        })

        currentProgress.total = filesToIndex.length

        if (filesToIndex.length === 0) {
            currentProgress = { ...currentProgress, status: 'done' }
            onProgress(currentProgress)
            return
        }

        for (let i = 0; i < filesToIndex.length; i += BATCH_SIZE) {
            const batch = filesToIndex.slice(i, i + BATCH_SIZE)

            const batchData = batch.map((f) => {
                const title = extractTitle(f.path, f.content)
                const textForEmbedding = prepareTextForEmbedding(title, f.content)
                return { ...f, title, textForEmbedding }
            })

            const embeddings = await generateEmbeddingsBatch(
                batchData.map((b) => b.textForEmbedding)
            )

            const records: NoteRecord[] = batchData.map((b, idx) => ({
                id: uuidv4(),
                filePath: b.path,         // маппим path -> filePath для БД
                relativePath: b.relativePath,
                title: b.title,
                content: b.content,
                createdAt: b.createdAt,
                modifiedAt: b.modifiedAt,
                vector: embeddings[idx]
            }))

            for (const record of records) {
                if (existingMap.has(record.filePath)) {
                    await table.delete(`filePath = '${record.filePath}'`)
                }
            }

            await table.add(records)

            currentProgress.processed += batch.length
            onProgress({ ...currentProgress })
        }

        currentProgress = { ...currentProgress, status: 'done' }
        onProgress(currentProgress)
    } catch (error) {
        currentProgress = {
            ...currentProgress,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        }
        onProgress(currentProgress)
        throw error
    }
}

export async function searchNotes(
  query: string,
  limit = 10
): Promise<NoteRecord[]> {
  const { generateEmbedding } = await import('./embeddings')
  const db = await getDb()
  const table = await getNotesTable(db)

  const queryVector = await generateEmbedding(query)

  const results = await table
    .vectorSearch(queryVector)
    .limit(limit)
    .toArray()

  // Сериализуем в plain objects для IPC
  return results.map((r) => ({
    id: String(r.id ?? ''),
    filePath: String(r.filePath ?? ''),
    relativePath: String(r.relativePath ?? ''),
    title: String(r.title ?? ''),
    content: String(r.content ?? ''),
    createdAt: Number(r.createdAt ?? 0),
    modifiedAt: Number(r.modifiedAt ?? 0),
    _distance: typeof r._distance === 'number' ? r._distance : undefined,
    vector: []  // не передаём вектор в renderer — он большой и не нужен
  }))
}