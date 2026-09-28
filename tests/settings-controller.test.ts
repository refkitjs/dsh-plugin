import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * dsh's REAL SettingsFormModel. `@deepseek-ai/dsh-client-ui-primitives` ships
 * only its browser build (lib/index.js), whose imports (react-dom, clsx, shiki,
 * @deepseek-ai/dsh-client-store, …) the platform supplies and this dev tree
 * does not install, so vitest cannot load the module as a whole. The mock
 * evaluates the build's own form-model region verbatim, with a minimal
 * createSnapshotStore standing in for the one import that region uses.
 */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const { readFileSync } = await import('node:fs')
  const { createRequire } = await import('node:module')
  const built = createRequire(import.meta.url).resolve('@deepseek-ai/dsh-client-ui-primitives')
  const source = readFileSync(built, 'utf8')
  const start = source.indexOf('//#region lib/types/settings-form/form-model.js')
  const end = source.indexOf('//#endregion', start)
  if (start < 0 || end < 0) throw new Error('form-model region not found in the primitives build')
  const createSnapshotStore = <T>(initial: T) => {
    let snapshot = initial
    const listeners = new Set<() => void>()
    return {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
      set: (next: T) => { snapshot = next; for (const listener of [...listeners]) listener() },
    }
  }
  const load = new Function('createSnapshotStore', `${source.slice(start, end)}\nreturn { SettingsFormModel, settingsNumberField, settingsTextField }`)
  return load(createSnapshotStore) as Record<string, unknown>
})

const { createSettingsController } = await import('../src/client/settings-controller.ts')
type Controller = ReturnType<typeof createSettingsController>
type Face = Controller['face']

const KEYS = ['unsplashAccessKey', 'pexelsApiKey', 'pixabayKey', 'flickrApiKey', 'smithsonianApiKey', 'braveToken', 'freesoundToken', 'jamendoClientId', 'europeanaApiKey', 'openverseToken']
const DEFAULTS = { sources: [], limit: 12, poolFactor: 2, deadlineMs: 15000, timeoutMs: 10000, rerank: true, sourceConfidence: true }

interface Op { op: 'set' | 'unset'; path: readonly string[]; value?: unknown }

/**
 * A Host namespace behind a ConfigForm-shaped form and the describe mirror:
 * a revision counter that refuses a write fenced on a stale revision, and
 * writes folded into both snapshots before `mutate` resolves (as ui-settings'
 * ConfigFormController does through acceptView).
 */
function fakeHost(storedKeys: string[] = []) {
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

const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0))

describe('createSettingsController', () => {
  let host: ReturnType<typeof fakeHost>
  let controller: Controller
  let face: Face
  const state = () => face.hooks.refkitSettings.getSnapshot()

  beforeEach(() => {
    host = fakeHost(['braveToken', 'pexelsApiKey'])
    controller = createSettingsController(host.configForms)
    face = controller.face
  })

  it('reports stored keys from the mirror and blank drafts', () => {
    expect(state().configured).toEqual(['pexelsApiKey', 'braveToken'])
    expect(state().keys.pexelsApiKey!.text).toBe('')
    expect(state().fields.limit.text).toBe('12')
  })

  it('saves after Remove when a blank key draft was staged before it', async () => {
    face.edit('unsplashAccessKey', 'x')
    face.edit('unsplashAccessKey', '')
    expect(state().dirty).toBe(false)
    face.remove('braveToken')
    await settle()
    expect(state().configured).toEqual(['pexelsApiKey'])
    face.edit('limit', '20')
    face.save()
    await settle()
    expect(state().failed).toBe(false)
    expect(host.user.limit).toBe(20)
    expect(host.calls.at(-1)).toMatchObject({ ops: [{ op: 'set', path: ['limit'], value: 20 }], expected: 2, accepted: true })
  })

  it('saves after Remove when a switch was flipped twice before it', async () => {
    face.edit('rerank', 'off')
    face.edit('rerank', 'on')
    expect(state().dirty).toBe(false)
    face.remove('braveToken')
    await settle()
    face.edit('limit', '20')
    face.save()
    await settle()
    expect(state().failed).toBe(false)
    expect(host.user.limit).toBe(20)
  })

  it('ignores edits, resets and saves while a removal is in flight, then lands the removal', async () => {
    const release = host.holdWrites()
    face.remove('braveToken')
    expect(state().removing).toBe('braveToken')
    face.edit('poolFactor', '3')
    face.resetField('limit')
    face.save()
    expect(state().fields.poolFactor.text).toBe('2')
    expect(state().dirty).toBe(false)
    release()
    await settle()
    expect(host.calls.map(call => call.ops)).toEqual([[{ op: 'unset', path: ['braveToken'] }]])
    expect(state().removing).toBeNull()
    expect(state().configured).toEqual(['pexelsApiKey'])
    // Editing resumes once the removal settled, fenced on the new revision.
    face.edit('poolFactor', '3')
    face.save()
    await settle()
    expect(state().failed).toBe(false)
    expect(host.user.poolFactor).toBe(3)
  })

  it('never writes a blank key draft', async () => {
    face.edit('pexelsApiKey', '   ')
    face.edit('limit', '20')
    face.save()
    await settle()
    expect(host.calls).toHaveLength(1)
    expect(host.calls[0]!.ops).toEqual([{ op: 'set', path: ['limit'], value: 20 }])
    expect(host.stored.has('pexelsApiKey')).toBe(true)
  })

  it('writes a typed key through the form and reports it set, with the draft blank again', async () => {
    face.edit('unsplashAccessKey', ' uk-1 ')
    face.save()
    await settle()
    expect(host.calls[0]!.ops).toEqual([{ op: 'set', path: ['unsplashAccessKey'], value: 'uk-1' }])
    expect(state().configured).toEqual(['unsplashAccessKey', 'pexelsApiKey', 'braveToken'])
    expect(state().keys.unsplashAccessKey!.text).toBe('')
  })

  it('refuses Remove while edits are staged', async () => {
    face.edit('limit', '20')
    face.remove('braveToken')
    await settle()
    expect(host.calls).toHaveLength(0)
    expect(state().removing).toBeNull()
  })

  it('reports a refused removal, keeps the key, and unlocks the form', async () => {
    const form = (host.configForms as unknown as { get: () => { mutate: (...args: unknown[]) => Promise<boolean> } }).get()
    form.mutate = async () => false
    face.remove('braveToken')
    await settle()
    expect(state().removeFailed).toBe('braveToken')
    expect(state().removing).toBeNull()
    expect(state().configured).toEqual(['pexelsApiKey', 'braveToken'])
    face.edit('limit', '20')
    expect(state().dirty).toBe(true)
  })
})
