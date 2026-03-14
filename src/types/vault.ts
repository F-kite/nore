export interface VaultFile {
  name: string
  path: string
  relativePath: string
  content: string
  createdAt: number
  modifiedAt: number
}

export interface VaultStore {
  vaultPath: string
  lanceDbPath: string
}
