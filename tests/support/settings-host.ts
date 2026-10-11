/** The fake refkit settings Host shared by the settings-controller test files. */
import type { createSettingsController } from '../../src/client/settings-controller.ts'

/** The ten key fields of the refkit namespace, as the Host's secret markers name them. */
const KEYS = ['unsplashAccessKey', 'pexelsApiKey', 'pixabayKey', 'flickrApiKey', 'smithsonianApiKey', 'braveToken', 'freesoundToken', 'jamendoClientId', 'europeanaApiKey', 'openverseToken']
const DEFAULTS = { sources: [], limit: 12, poolFactor: 2, deadlineMs: 15000, timeoutMs: 10000, rerank: true, sourceConfidence: true }

interface Op { op: 'set' | 'unset'; path: readonly string[]; value?: unknown }

/**
 * A Host namespace behind a ConfigForm-shaped form and the describe mirror:
 * a revision counter that refuses a write fenced on a stale revision, and
 * writes folded into both snapshots before `mutate` resolves (as ui-settings'
 * ConfigFormController does through acceptView).
 */
export function fakeHost(storedKeys: string[] = []) {
  let revision = 1
  const user: Record<string, unknown> = {}
  const stored = new Set(storedKeys)
  const calls: { ops: Op[]; expected: number | undefined; revision: number; accepted: boolean }[] = []
  const formListeners = new Set<() => void>()
  const mirrorListeners = new Set<() => void>()
  let hold: Promise<void> | undefined

  const namespace = () => ({ ns: 'refkit', revision, secrets: KEYS.map(key => ({ path: [key], set: stored.has(key) })) })
  const formSnapshot = () => ({ status: 'ready' as const, value: { ...DEFAULTS, ...user }, base: { ...DEFAULTS }, user: { ...user }, revision, writable: true, mode: 'host' as const })
  let formSnap = formSnapshot()
  let mirrorSnap = { status: 'ready' as const, view: { namespaces: [namespace()], writable: true, hasDocument: true }, error: null }
  const commit = (): void => {
    formSnap = formSnapshot()
    mirrorSnap = { ...mirrorSnap, view: { ...mirrorSnap.view, namespaces: [namespace()] } }
    for (const listener of [...formListeners]) listener()
    for (const listener of [...mirrorListeners]) listener()
  }

  const form = {
    getSnapshot: () => formSnap,
    subscribe: (listener: () => void) => { formListeners.add(listener); return () => { formListeners.delete(listener) } },
    mutate: async (ops: readonly Op[], expected?: number): Promise<boolean> => {
      if (hold) await hold
      const accepted = expected === undefined || expected === revision
      calls.push({ ops: structuredClone([...ops]), expected, revision, accepted })
      if (!accepted) return false
      for (const op of ops) {
        const [field] = op.path
        if (KEYS.includes(field!)) { if (op.op === 'set') stored.add(field!); else stored.delete(field!) }
        else if (op.op === 'set') user[field!] = op.value
        else delete user[field!]
      }
      revision += 1
      commit()
      return true
    },
    set: async () => false,
    unset: async () => false,
  }
  const mirror = {
    getSnapshot: () => mirrorSnap,
    subscribe: (listener: () => void) => { mirrorListeners.add(listener); return () => { mirrorListeners.delete(listener) } },
    ensure: async () => {},
    acceptView: () => {},
  }
  const configForms = { get: () => form, describe: () => mirror } as unknown as Parameters<typeof createSettingsController>[0]
  const holdWrites = (): (() => void) => {
    let release!: () => void
    hold = new Promise<void>((resolve) => { release = resolve })
    return () => { hold = undefined; release() }
  }
  return { configForms, calls, user, stored, holdWrites, revision: () => revision }
}

/** Let pending writes and their settlements run. */
export const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0))
