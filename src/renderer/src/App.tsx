import { useState, useEffect } from 'react'
import { IndexingProgress } from '../../types/index.d'

function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [files, setFiles] = useState<string[]>([])
  const [progress, setProgress] = useState<IndexingProgress>({
    total: 0,
    processed: 0,
    status: 'idle'
  })

  useEffect(() => {
    window.vault.getSavedPath().then(async (savedPath) => {
      if (savedPath) {
        setVaultPath(savedPath)
        const vaultFiles = await window.vault.loadFiles(savedPath)
        setFiles(vaultFiles.map((f) => f.relativePath))
      }
    })

    window.indexing.onProgress((p) => {
      setProgress(p)
    })
  }, [])

  const handleSelectFolder = async () => {
    const selected = await window.vault.selectFolder()
    if (selected) {
      setVaultPath(selected)
      const vaultFiles = await window.vault.loadFiles(selected)
      setFiles(vaultFiles.map((f) => f.relativePath))
    }
  }

  const handleStartIndexing = async () => {
    if (!vaultPath) return
    const vaultFiles = await window.vault.loadFiles(vaultPath)
    await window.indexing.start(vaultPath, vaultFiles)
  }

  const progressPercent =
    progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Nore</h1>
          <p className="text-gray-400 text-sm mt-1">Your second brain, finally thinking back.</p>
        </div>

        {/* Vault connection */}
        <div className="bg-gray-900 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Vault</h2>
          {vaultPath ? (
            <p className="text-sm text-gray-400 font-mono bg-gray-800 px-3 py-2 rounded-lg truncate">
              {vaultPath}
            </p>
          ) : (
            <p className="text-sm text-gray-500">No vault connected</p>
          )}
          <button
            onClick={handleSelectFolder}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-sm rounded-lg transition-colors"
          >
            {vaultPath ? 'Change folder' : 'Select folder'}
          </button>
        </div>

        {/* Indexing */}
        {vaultPath && (
          <div className="bg-gray-900 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Indexing</h2>

            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>{files.length} notes found</span>
              {progress.status === 'done' && (
                <span className="text-green-400">✓ Index up to date</span>
              )}
              {progress.status === 'error' && (
                <span className="text-red-400">✗ {progress.error}</span>
              )}
            </div>

            {/* Progress bar */}
            {progress.status === 'indexing' && (
              <div className="space-y-2">
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {progress.processed} / {progress.total} notes indexed ({progressPercent}%)
                </p>
              </div>
            )}

            <button
              onClick={handleStartIndexing}
              disabled={progress.status === 'indexing'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-sm rounded-lg transition-colors"
            >
              {progress.status === 'indexing' ? 'Indexing...' : 'Start indexing'}
            </button>
          </div>
        )}

        {/* Search — временный для теста */}
        {progress.status === 'done' && (
          <SearchTest />
        )}

      </div>
    </div>
  )
}

function SearchTest() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ title: string; relativePath: string }[]>([])

  const handleSearch = async () => {
    if (!query.trim()) return
    const res = await window.search.query(query)
    setResults(res.map((r) => ({ title: r.title, relativePath: r.relativePath })))
  }

  return (
    <div className="bg-gray-900 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Search test</h2>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Ask anything..."
          className="flex-1 bg-gray-800 text-sm px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-gray-100 placeholder-gray-500"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-sm rounded-lg transition-colors"
        >
          Search
        </button>
      </div>
      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r, i) => (
            <li key={i} className="text-sm bg-gray-800 px-3 py-2 rounded-lg">
              <p className="text-white font-medium">{r.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">{r.relativePath}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App