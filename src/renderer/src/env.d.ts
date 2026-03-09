/// <reference types="vite/client" />


import type { ElectronAPI } from '@electron-toolkit/preload'
import type { VaultFile } from '../../preload/../types/vault'

declare global {
    interface Window {
        electron: ElectronAPI
        vault: {
            selectFolder: () => Promise<string | null>
            getSavedPath: () => Promise<string | null>
            loadFiles: (vaultPath: string) => Promise<VaultFile[]>
        }
    }
}

export { }