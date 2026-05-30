import { safeStorage } from 'electron'
import Store from 'electron-store'
import { randomUUID } from 'crypto'
import { is } from '@electron-toolkit/utils'

export type Plan = 'free' | 'pro'

export interface LicenseStatus {
  plan: Plan
  email?: string
  validUntil?: number
  queriesUsedThisMonth: number
  /** -1 means unlimited (Pro). FREE_QUERIES_LIMIT for free. */
  queriesLimit: number
  lastValidatedAt: number
}

interface LicenseData {
  machineId: string
  plan: Plan
  email: string
  encryptedKey: string
  validUntil: number
  lastValidatedAt: number
  queriesUsedThisMonth: number
  queriesMonthKey: string
}

export const FREE_QUERIES_LIMIT = 50
const VALIDATION_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

const store = new Store<{ license: LicenseData }>({
  name: 'license',
  defaults: {
    license: {
      machineId: randomUUID(),
      plan: 'free',
      email: '',
      encryptedKey: '',
      validUntil: 0,
      lastValidatedAt: 0,
      queriesUsedThisMonth: 0,
      queriesMonthKey: ''
    }
  }
})

type StatusChangeListener = (status: LicenseStatus) => void
let listeners: StatusChangeListener[] = []

// --- Encryption (same pattern as settings.ts) ---

function encrypt(text: string): string {
  if (!text) return ''
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(text).toString('base64')
  }
  return safeStorage.encryptString(text).toString('base64')
}

function decrypt(encoded: string): string {
  if (!encoded) return ''
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(encoded, 'base64').toString('utf-8')
  }
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  } catch {
    return ''
  }
}

// --- Helpers ---

function monthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getData(): LicenseData {
  return store.get('license')
}

function resetMonthIfNeeded(data: LicenseData): LicenseData {
  const current = monthKey()
  if (data.queriesMonthKey !== current) {
    return { ...data, queriesUsedThisMonth: 0, queriesMonthKey: current }
  }
  return data
}

function setData(data: LicenseData): void {
  store.set('license', data)
}

function emitChange(): void {
  const status = getStatus()
  listeners.forEach((fn) => fn(status))
}

// --- Public API ---

export function getStatus(): LicenseStatus {
  const data = resetMonthIfNeeded(getData())
  setData(data)
  return {
    plan: data.plan,
    email: data.email || undefined,
    validUntil: data.validUntil || undefined,
    queriesUsedThisMonth: data.queriesUsedThisMonth,
    queriesLimit: data.plan === 'pro' ? -1 : FREE_QUERIES_LIMIT,
    lastValidatedAt: data.lastValidatedAt
  }
}

export async function activate(email: string, key: string): Promise<LicenseStatus> {
  if (!email.trim() || !key.trim()) throw new Error('Email and license key are required.')

  const data = getData()
  const serverUrl = process.env.LICENSE_SERVER_URL

  if (!serverUrl) {
    // Dev mode: accept "DEV-PRO" or any "DEV-*" key for local testing
    if (is.dev && key.trim().startsWith('DEV-')) {
      const updated: LicenseData = {
        ...data,
        plan: 'pro',
        email: email.trim(),
        encryptedKey: encrypt(key.trim()),
        validUntil: Date.now() + 365 * 24 * 60 * 60 * 1000,
        lastValidatedAt: Date.now()
      }
      setData(updated)
      emitChange()
      return getStatus()
    }
    throw new Error('License server is not configured. Contact support to activate.')
  }

  const response = await fetch(`${serverUrl}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ email: email.trim(), key: key.trim(), machineId: data.machineId })
  })

  if (!response.ok) {
    let message = `Activation failed (${response.status})`
    try {
      const body = await response.json()
      if (typeof body.message === 'string') message = body.message
    } catch { /* ignore */ }
    throw new Error(message)
  }

  const result = (await response.json()) as { plan: Plan; validUntil: number }
  const updated: LicenseData = {
    ...data,
    plan: result.plan,
    email: email.trim(),
    encryptedKey: encrypt(key.trim()),
    validUntil: result.validUntil,
    lastValidatedAt: Date.now()
  }
  setData(updated)
  emitChange()
  return getStatus()
}

export function deactivate(): void {
  const data = getData()
  setData({
    ...data,
    plan: 'free',
    email: '',
    encryptedKey: '',
    validUntil: 0,
    lastValidatedAt: Date.now()
  })
  emitChange()
}

export function isQueryAllowed(): { allowed: boolean; reason?: string } {
  const status = getStatus()
  if (status.plan === 'pro') return { allowed: true }
  if (status.queriesUsedThisMonth >= FREE_QUERIES_LIMIT) {
    return {
      allowed: false,
      reason: `Monthly limit of ${FREE_QUERIES_LIMIT} free queries reached. Upgrade to Pro for unlimited access.`
    }
  }
  return { allowed: true }
}

export function incrementQueryCount(): void {
  const data = resetMonthIfNeeded(getData())
  setData({ ...data, queriesUsedThisMonth: data.queriesUsedThisMonth + 1 })
  emitChange()
}

export function onStatusChange(callback: StatusChangeListener): () => void {
  listeners.push(callback)
  return () => {
    listeners = listeners.filter((fn) => fn !== callback)
  }
}

/** Background re-validation with license server. Safe to call on startup. */
export async function validateInBackground(): Promise<void> {
  const data = getData()
  if (!data.email || !data.encryptedKey) return

  const serverUrl = process.env.LICENSE_SERVER_URL
  if (!serverUrl) return

  if (Date.now() - data.lastValidatedAt < VALIDATION_CACHE_TTL) return

  try {
    const key = decrypt(data.encryptedKey)
    const response = await fetch(`${serverUrl}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ email: data.email, key, machineId: data.machineId })
    })

    const now = Date.now()
    if (!response.ok) {
      // 403/404 → key revoked, downgrade
      if (response.status === 403 || response.status === 401) {
        setData({ ...data, plan: 'free', validUntil: 0, lastValidatedAt: now })
        emitChange()
      }
      return
    }

    const result = (await response.json()) as { plan: Plan; validUntil: number }
    setData({ ...data, plan: result.plan, validUntil: result.validUntil, lastValidatedAt: now })
    emitChange()
  } catch {
    // Server unreachable — keep current plan
    setData({ ...getData(), lastValidatedAt: Date.now() })
  }
}
