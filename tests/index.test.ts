import { describe, expect, it } from 'vitest'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { GUIDANCE, apply, applyWith, inject, name } from '../src/index.ts'

interface FakeSettings {
  installSection: (owner: unknown, ns: string, schema: unknown, entry: unknown, hooks: { setSource(c: () => unknown): void; onChange(): void; validate?: (v: unknown) => void }) => void
}

function fakeContext(services: { settings?: FakeSettings; systemPrompt?: { section: (s: { name: string; order: number; text: string }) => () => void } } = {}) {
  const registered: ToolDefinition[] = []
  const ctx = {
    inject(deps: string[], cb: (scope: unknown) => void) {
      if (deps.every(d => d in services)) cb({ ...services })
    },
    effect: () => () => {},
    tools: { register: (def: ToolDefinition) => { registered.push(def); return () => {} } },
  }
  return { ctx, registered }
}

describe('plugin entry', () => {
  it('declares the Cordis name and required services', () => {
    expect(name).toBe('refkit')
    expect(inject).toEqual(['tools'])
  })
  it('registers both tools with no optional services mounted', () => {
    const { ctx, registered } = fakeContext()
    apply(ctx as never, {})
    expect(registered.map(d => d.name).sort()).toEqual(['refkit_rights', 'refkit_search'])
  })
  it('installs the settings section under the refkit namespace and rebuilds the client on change', async () => {
    let hooks: Parameters<FakeSettings['installSection']>[4] | undefined
    let ns: string | undefined
    const settings: FakeSettings = { installSection: (_o, n, _s, _e, h) => { ns = n; hooks = h } }
    const { ctx } = fakeContext({ settings })
    const built: string[][] = []
    const handles = applyWith(ctx as never, {}, {
      createClient: (opts) => { built.push(opts.providers.map(p => p.id)); return { providers: opts.providers } as never },
      env: {},
    })
    expect(ns).toBe('refkit')
    // lazy: nothing is built until a tool asks for the client
    expect(built).toHaveLength(0)
    handles.getClient()
    handles.getClient()
    expect(built).toHaveLength(1)
    expect(built[0]).not.toContain('pexels')
    // a settings change swaps the source and drops the cached client
    let current: Record<string, unknown> = {}
    hooks!.setSource(() => current)
    expect(() => hooks!.validate?.({ sources: ['nope'] })).toThrow(/valid ids/)
    current = { pexelsApiKey: 'k', limit: 7 }
    hooks!.onChange()
    expect(handles.getConfig().limit).toBe(7)
    handles.getClient()
    expect(built).toHaveLength(2)
    expect(built[1]).toContain('pexels')
    expect(built[1]).toContain('pexels-video')
  })
  it('registers a system-prompt section when the service exists', () => {
    const sections: { name: string; order: number; text: string }[] = []
    const { ctx } = fakeContext({ systemPrompt: { section: (s) => { sections.push(s); return () => {} } } })
    apply(ctx as never, {})
    expect(sections).toEqual([{ name: 'tool:refkit', order: 115, text: GUIDANCE }])
    expect(GUIDANCE).toContain('refkit_search')
    expect(GUIDANCE).toContain('refkit_rights')
    expect(GUIDANCE).toContain('intent')
  })
  it('rejects an unknown sources id in the entry config at apply time', () => {
    const { ctx } = fakeContext()
    expect(() => apply(ctx as never, { sources: ['unsplsh'] })).toThrow(/valid ids/)
  })
})
