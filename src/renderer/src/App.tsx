import { useState, useEffect } from 'react'

function App(): React.JSX.Element {
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [files, setFiles] = useState<string[]>([])

  useEffect(() => {
    // Проверяем есть ли сохранённый путь
    window.vault.getSavedPath().then(async (path) => {
      if (path) {
        setVaultPath(path)
        const vaultFolder = await window.vault.loadFiles(path)
        setFiles(vaultFolder.map((f) => f.relativePath))
      }
    })
  }, [])

  const handleSelectVault = async (): Promise<void> => {
    const path = await window.vault.selectFolder()
    if (path) {
      setVaultPath(path)
      const vaultFiles = await window.vault.loadFiles(path)
      setFiles(vaultFiles.map((f) => f.relativePath))
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Nore — IPC Test</h2>
      <button onClick={handleSelectVault}>Select Vault Folder</button>
      {vaultPath && <p>Vault: {vaultPath}</p>}
      {files.length > 0 && (
        <ul>
          {files.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App