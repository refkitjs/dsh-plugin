import { describe, expect, it, vi } from 'vitest'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { RefkitClient, RefkitOptions } from '@refkit/core'
import { Config, GUIDANCE, apply, applyWith, inject, name, type ConfigValues } from '../src/index.ts'

type Listener = (...args: unknown[]) => void

interface FakeServices {
  settings?: { configure: (policy: { auto?: boolean }, owner?: unknown) => () => void }
  systemPrompt?: { section: (s: { name: string; order: number; text: string }) => () => void }
}

/** A Cordis-shaped context: optional-service inject children, and `on`/`emit` for Loader events. */
function fakeContext(services: FakeServices = {}) {
  const registered: ToolDefinition[] = []
  const listeners = new Map<string, Listener[]>()
  const ctx = {
    inject(deps: string[], cb: (scope: unknown) => void) {
      if (deps.every(d => d in services)) cb({ ...services, effect: (fn: () => unknown) => fn() })
    },
    effect: () => () => {},
    on(event: string, fn: Listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), fn])
      return () => {}
    },
    tools: { register: (def: ToolDefinition) => { registered.push(def); return () => {} } },
  }
  const emit = (event: string, ...args: unknown[]): void => {
    for (const fn of listeners.get(event) ?? []) fn(...args)
  }
  return { ctx, registered, emit }
}

/** Live references whose `.get()` reads whatever `get()` returns now, like the Loader's committed values. */
function liveConfig(get: () => ConfigValues): Config {
  const fields = Object.keys(Config({})) as (keyof ConfigValues)[]
  return Object.fromEntries(fields.map(field => [field, { get: () => get()[field] }])) as unknown as Config
}

describe('plugin entry', () => {
  it('declares the Cordis name and required services', () => {
    expect(name).toBe('refkit')
    expect(inject).toEqual(['tools'])
  })
  it('registers both tools with no optional services mounted', () => {
    const { ctx, registered } = fakeContext()
    apply(ctx as never, Config({}))
    expect(registered.map(d => d.name).sort()).toEqual(['refkit_rights', 'refkit_search'])
  })
  it('builds the client lazily and rebuilds it on a live settings edit without re-registering', () => {
    const { ctx, registered, emit } = fakeContext()
    let current: ConfigValues = {}
    const createClient = vi.fn((opts: RefkitOptions) => ({ providers: opts.providers }) as unknown as RefkitClient)
    const handles = applyWith(ctx as never, liveConfig(() => current), { createClient, env: {} })
    const providerIds = (call: number) => createClient.mock.calls[call][0].providers.map(p => p.id)
    // lazy: nothing is built until a tool asks for the client
    expect(createClient).not.toHaveBeenCalled()
    handles.getClient()
    handles.getClient()
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(providerIds(0)).not.toContain('pexels')
    // the Loader commits new values into the same references, then notifies the fiber
    current = { pexelsApiKey: 'k', limit: 7 }
    expect(handles.getConfig().limit).toBe(12)
    emit('loader/volatile-update', [['pexelsApiKey'], ['limit']])
    expect(handles.getConfig().limit).toBe(7)
    handles.getClient()
    expect(createClient).toHaveBeenCalledTimes(2)
    expect(providerIds(1)).toContain('pexels')
    expect(providerIds(1)).toContain('pexels-video')
    // no re-apply: the tools were registered once
    expect(registered.map(d => d.name).sort()).toEqual(['refkit_rights', 'refkit_search'])
  })
  it('opts out of an auto-generated settings page when the settings service exists', () => {
    const configure = vi.fn((_policy: { auto?: boolean }, _owner?: unknown) => () => {})
    const { ctx } = fakeContext({ settings: { configure } })
    apply(ctx as never, Config({}))
    expect(configure).toHaveBeenCalledTimes(1)
    expect(configure.mock.calls[0][0]).toEqual({ auto: false })
  })
  it('registers a system-prompt section when the service exists', () => {
    const sections: { name: string; order: number; text: string }[] = []
    const { ctx } = fakeContext({ systemPrompt: { section: (s) => { sections.push(s); return () => {} } } })
    apply(ctx as never, Config({}))
    expect(sections).toEqual([{ name: 'tool:refkit', order: 115, text: GUIDANCE }])
  })
  it('guidance names both tools and the intent parameter', () => {
    expect(GUIDANCE).toContain('refkit_search')
    expect(GUIDANCE).toContain('refkit_rights')
    expect(GUIDANCE).toContain('intent')
  })
})
