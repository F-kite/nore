export interface NoteFile {
    path: string          // было filePath
    relativePath: string
    modifiedAt: number
    createdAt: number
    content: string       // контент уже есть
    name: string
}

export interface IndexingProgress {
    total: number
    processed: number
    status: 'idle' | 'indexing' | 'done' | 'error'
    error?: string
}