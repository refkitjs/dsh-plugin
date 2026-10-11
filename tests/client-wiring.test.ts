import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConfigForm, ConfigForms, ConfigFormSnapshot, SettingsDescribeFace, SettingsMirrorSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { RefkitSettingsFace } from '../src/client/settings-controller.ts'

/** dsh's REAL SettingsFormModel behind the controller the page injects (see the helper). */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => (await import('./support/primitives-form-model.ts')).primitivesFormModel())

const client = await import('../src/client/index.tsx')
const { RefkitCard } = await import('../src/client/Card.tsx')
const { RefkitSettingsPage } = await import('../src/client/SettingsPage.tsx')

const TOOLVIEW = 'tool.call.toolview'
const ROW_CONFIG = 'plugins.row.config'

/** The registration options the fake registry records (the real one checks them against SlotMap). */
interface SlotOptions {
  name: string
  key?: string
  priority?: number
  registrant?: string
  inject?: () => unknown
}
interface Registration { options: SlotOptions; component: unknown }

/**
 * The renderer's slot registry, reduced to what the plugin calls. As
 * SlotRegistry.inject documents, the callback runs at once when the slot is
 * already declared and otherwise inside the declaring register() call
 * (`declare` here), where a throw would reach that other plugin's register.
 */
function fakeSlots(declared: readonly string[] = [TOOLVIEW, ROW_CONFIG]) {
  const declaredSlots = new Set(declared)
  const waiting = new Map<string, (() => void)[]>()
  const live = new Set<Registration>()
  let registerError: Error | undefined
  const face = {
    inject(key: string, callback: () => () => void): () => void {
      let dispose: (() => void) | undefined
      let ended = false
      const run = (): void => { if (!ended) dispose = callback() }
      if (declaredSlots.has(key)) run()
      else waiting.set(key, [...(waiting.get(key) ?? []), run])
      return () => { ended = true; dispose?.(); dispose = undefined }
    },
    register(options: SlotOptions, component: unknown): () => void {
      if (registerError) throw registerError
      const entry: Registration = { options, component }
      live.add(entry)
      return () => { live.delete(entry) }
    },
  }
  return {
    face,
    registrations: (name: string): Registration[] => [...live].filter(entry => entry.options.name === name),
    declare(key: string): void {
      declaredSlots.add(key)
      const runs = waiting.get(key) ?? []
      waiting.delete(key)
      for (const run of runs) run()
    },
    failRegister(error: Error): void { registerError = error },
  }
}

/**
 * The settings domain over one `refkit` namespace: a ConfigForm and the
 * describe mirror (both counting subscribers, which is how a released
 * controller shows), and whileServed driven by `serve` / `unserve` the way the
 * mirror's notification drives it.
 */
function fakeConfigForms(storedKeys: readonly string[] = []) {
  const formListeners = new Set<() => void>()
  const mirrorListeners = new Set<() => void>()
  const requested: string[] = []
  const writes: unknown[] = []
  const watches: { namespaces: readonly string[]; register: (served: ReadonlySet<string>) => () => void; live?: () => void; ended: boolean }[] = []
  const formSnapshot: ConfigFormSnapshot<Record<string, unknown>> = {
    status: 'ready', value: { limit: 12 }, base: { limit: 12 }, user: {}, revision: 1, writable: true, mode: 'host',
  }
  const mirrorSnapshot: SettingsMirrorSnapshot = {
    status: 'ready',
    error: null,
    view: {
      writable: true,
      hasDocument: true,
      namespaces: [{ ns: 'refkit', autoGenerate: false, schema: null, value: {}, applies: 'live', revision: 1, secrets: storedKeys.map(key => ({ path: [key], set: true })) }],
    },
  }
  const form: ConfigForm<Record<string, unknown>> = {
    getSnapshot: () => formSnapshot,
    subscribe: (listener) => { formListeners.add(listener); return () => { formListeners.delete(listener) } },
    mutate: async (ops) => { writes.push(structuredClone([...ops])); return true },
    set: async () => false,
    unset: async () => false,
  }
  const mirror: SettingsDescribeFace = {
    getSnapshot: () => mirrorSnapshot,
    subscribe: (listener) => { mirrorListeners.add(listener); return () => { mirrorListeners.delete(listener) } },
    ensure: async () => {},
    acceptView: () => {},
  }
  const service: Pick<ConfigForms, 'get' | 'describe' | 'whileServed'> = {
    get: <T>(entryId: string): ConfigForm<T> => { requested.push(entryId); return form as unknown as ConfigForm<T> },
    describe: () => mirror,
    whileServed: (namespaces, register) => {
      const watch: (typeof watches)[number] = { namespaces: [...namespaces], register, ended: false }
      watches.push(watch)
      return () => { watch.ended = true; watch.live?.(); watch.live = undefined }
    },
  }
  return {
    service,
    requested,
    writes,
    subscribers: (): number => formListeners.size + mirrorListeners.size,
    /** The Host starts serving `ns`: every open watch on it registers. */
    serve(ns: string): void {
      for (const watch of watches) if (!watch.ended && !watch.live && watch.namespaces.includes(ns)) watch.live = watch.register(new Set([ns]))
    },
    /** The Host stops serving every namespace: every live registration is disposed. */
    unserve(): void {
      for (const watch of watches) { watch.live?.(); watch.live = undefined }
    },
  }
}

interface Services {
  slots: ReturnType<typeof fakeSlots>['face']
  configForms?: ReturnType<typeof fakeConfigForms>['service']
}

/** One plugin fiber: the services it waited for, the error its body threw (if any), and its unload. */
interface Fiber { deps: readonly string[]; error?: unknown; unload(): void }

/**
 * A cordis context reduced to inject / effect: `inject` starts a child fiber
 * once every named service is provided (and never otherwise), and a throw in
 * its body fails that fiber instead of reaching the caller, as cordis'
 * asynchronous plugin start does; `effect` runs at once and hands back its
 * disposer, which the fiber's unload also runs.
 */
function fakeCordis(services: Services) {
  const fibers: Fiber[] = []
  const scope = (disposers: (() => void)[]) => ({
    ...services,
    inject(deps: readonly string[], body: (child: ClientContext) => void): void {
      if (!deps.every(name => services[name as keyof Services] !== undefined)) return
      const childDisposers: (() => void)[] = []
      const child: Fiber = { deps, unload: () => { for (const dispose of childDisposers.splice(0).reverse()) dispose() } }
      fibers.push(child)
      try { body(scope(childDisposers) as unknown as ClientContext) } catch (error) { child.error = error }
    },
    effect(execute: () => () => void, _label?: string): () => void {
      const dispose = execute()
      let done = false
      const run = (): void => { if (!done) { done = true; dispose() } }
      disposers.push(run)
      return run
    },
  })
  const root = scope([])
  return {
    /** Load the client plugin as cordis would: its apply runs once every name in its `inject` is provided. */
    load(): void { root.inject(client.inject, ctx => client.apply(ctx)) },
    fiber: (dep: string): Fiber | undefined => fibers.find(fiber => fiber.deps.includes(dep)),
    errors: (): unknown[] => fibers.filter(fiber => 'error' in fiber).map(fiber => fiber.error),
  }
}

function boot(options: { slots?: ReturnType<typeof fakeSlots>; settings?: ReturnType<typeof fakeConfigForms> | null } = {}) {
  const slots = options.slots ?? fakeSlots()
  const settings = options.settings === null ? undefined : (options.settings ?? fakeConfigForms(['braveToken']))
  const cordis = fakeCordis({ slots: slots.face, configForms: settings?.service })
  cordis.load()
  return { slots, settings, cordis }
}

const TOOLVIEW_OPTIONS = { name: TOOLVIEW, key: 'refkit_search', priority: 0, registrant: '@refkit/dsh-plugin' }
const PAGE_OPTIONS = { name: ROW_CONFIG, key: '@refkit/dsh-plugin#refkit', registrant: '@refkit/dsh-plugin' }

let warn: MockInstance<typeof console.warn>
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => { warn.mockRestore() })

describe('client apply', () => {
  it('registers RefkitCard as the refkit_search toolview', () => {
    const { slots, cordis } = boot()
    expect(cordis.errors()).toEqual([])
    const toolviews = slots.registrations(TOOLVIEW)
    expect(toolviews).toHaveLength(1)
    expect(toolviews[0]!.options).toEqual(TOOLVIEW_OPTIONS)
    expect(toolviews[0]!.component).toBe(RefkitCard)
    expect(warn).not.toHaveBeenCalled()
  })

  it('registers the settings page under the refkit row only while the refkit namespace is served', () => {
    const { slots, settings, cordis } = boot()
    expect(slots.registrations(ROW_CONFIG)).toEqual([])
    settings!.serve('another-plugin')
    expect(slots.registrations(ROW_CONFIG)).toEqual([])

    settings!.serve('refkit')
    const pages = slots.registrations(ROW_CONFIG)
    expect(pages).toHaveLength(1)
    expect(pages[0]!.options).toEqual({ ...PAGE_OPTIONS, inject: expect.any(Function) })
    expect(pages[0]!.component).toBe(RefkitSettingsPage)

    settings!.unserve()
    expect(slots.registrations(ROW_CONFIG)).toEqual([])
    settings!.serve('refkit')
    expect(slots.registrations(ROW_CONFIG)).toHaveLength(1)
    expect(cordis.errors()).toEqual([])
    expect(warn).not.toHaveBeenCalled()
  })

  it("injects the settings controller's face over the refkit form", async () => {
    const { slots, settings } = boot()
    settings!.serve('refkit')
    const inject = slots.registrations(ROW_CONFIG)[0]!.options.inject!
    const face = inject() as RefkitSettingsFace
    expect(inject()).toBe(face)
    expect(settings!.requested).toEqual(['refkit'])
    const state = face.hooks.refkitSettings.getSnapshot()
    expect(state.configured).toEqual(['braveToken'])
    expect(state.fields.limit.text).toBe('12')
    face.edit('limit', '20')
    face.save()
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    expect(settings!.writes).toEqual([[{ op: 'set', path: ['limit'], value: 20 }]])
  })

  it('unloading the settings fiber releases the controller, removes the page, and ends the watch', () => {
    const { slots, settings, cordis } = boot()
    settings!.serve('refkit')
    expect(settings!.subscribers()).toBeGreaterThan(0)
    expect(slots.registrations(ROW_CONFIG)).toHaveLength(1)

    cordis.fiber('configForms')!.unload()
    expect(settings!.subscribers()).toBe(0)
    expect(slots.registrations(ROW_CONFIG)).toEqual([])
    settings!.serve('refkit')
    expect(slots.registrations(ROW_CONFIG)).toEqual([])
    expect(slots.registrations(TOOLVIEW)).toHaveLength(1)
  })
})

describe('client apply degrades without throwing', () => {
  it('without the settings domain: the toolview still registers, the page never does, and nothing warns', () => {
    const { slots, cordis } = boot({ settings: null })
    expect(cordis.errors()).toEqual([])
    expect(slots.registrations(TOOLVIEW).map(entry => entry.options)).toEqual([TOOLVIEW_OPTIONS])
    expect(slots.registrations(ROW_CONFIG)).toEqual([])
    // A deployment without the settings domain is ordinary: the optional child just stays pending.
    expect(warn).not.toHaveBeenCalled()
  })

  it.each([
    ['already declared', [TOOLVIEW, ROW_CONFIG]],
    ['declared later by another plugin', []],
  ] as const)('slots.register throwing (slots %s) is logged, not thrown', (_when, declared) => {
    const slots = fakeSlots(declared)
    slots.failRegister(new Error('register refused'))
    const { settings, cordis } = boot({ slots })
    expect(() => settings!.serve('refkit')).not.toThrow()
    expect(() => slots.declare(TOOLVIEW)).not.toThrow()
    expect(() => slots.declare(ROW_CONFIG)).not.toThrow()
    expect(cordis.errors()).toEqual([])
    expect(slots.registrations(TOOLVIEW)).toEqual([])
    expect(slots.registrations(ROW_CONFIG)).toEqual([])
    expect(warn).toHaveBeenCalledWith('[refkit] toolview registration failed', expect.objectContaining({ message: 'register refused' }))
    expect(warn).toHaveBeenCalledWith('[refkit] settings page registration failed', expect.objectContaining({ message: 'register refused' }))
  })

  it('whileServed throwing is logged, releases the controller, and registers no page', () => {
    const settings = fakeConfigForms()
    settings.service.whileServed = () => { throw new Error('mirror gone') }
    const { slots, cordis } = boot({ settings })
    expect(cordis.errors()).toEqual([])
    expect(warn).toHaveBeenCalledWith('[refkit] settings page wiring failed', expect.objectContaining({ message: 'mirror gone' }))
    expect(settings.subscribers()).toBe(0)
    expect(slots.registrations(ROW_CONFIG)).toEqual([])
    expect(slots.registrations(TOOLVIEW)).toHaveLength(1)
  })

  it('a settings controller that cannot be built is logged and registers no page', () => {
    const settings = fakeConfigForms()
    settings.service.get = () => { throw new Error('no such namespace') }
    const { slots, cordis } = boot({ settings })
    expect(cordis.errors()).toEqual([])
    expect(warn).toHaveBeenCalledWith('[refkit] settings page wiring failed', expect.objectContaining({ message: 'no such namespace' }))
    settings.serve('refkit')
    expect(slots.registrations(ROW_CONFIG)).toEqual([])
    expect(slots.registrations(TOOLVIEW)).toHaveLength(1)
  })
})
