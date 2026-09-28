import { describe, expect, it } from 'vitest'
import { createRefkit, defineProvider, type EmittedReference, type LicenseId } from '@refkit/core'
import { assertSupportedJsonSchema, parameterSchemaSpecToJsonSchema, valueSchemaSpecToJsonSchema } from '@deepseek-ai/dsh-tools'
import { resolveConfig } from '../src/config.ts'
import { SEARCH_OUTPUT, SEARCH_PARAMETERS, SEARCH_TOOL_NAME, createSearchTool, runSearch, type SearchDeps } from '../src/tools/search.ts'
import { narrowOutcome, type SearchOutcome } from '../src/core/outcome.ts'
import { cardMeta, renderSearch } from '../src/render.ts'

const emit = (url: string, license: LicenseId, extra: Partial<EmittedReference> = {}): EmittedReference => ({
  modality: 'image',
  title: `title ${url}`,
  sourceUrl: url,
  rights: { license, author: 'Ada', rehostPolicy: 'cache-allowed', raw: { sourceTerms: 't', sourceUrl: url } },
  thumbnail: { url: `${url}/t.jpg` },
  visual: { width: 800, height: 600 },
  ...extra,
})

const provider = (id: string, refs: EmittedReference[]) =>
  defineProvider({ id, modalities: ['image'], search: async () => refs })
const failing = (id: string) =>
  defineProvider({ id, modalities: ['image'], search: async () => { throw new Error('boom ' + 'x'.repeat(300)) } })

function deps(providers: ReturnType<typeof defineProvider>[], config = resolveConfig({}, {})): SearchDeps {
  const client = createRefkit({ providers, rerank: false, sourceConfidence: false, userAgent: false })
  return { client: () => client, config: () => config }
}

describe('schemas', () => {
  it('compile within the dsh enforced subset', () => {
    expect(() => assertSupportedJsonSchema(parameterSchemaSpecToJsonSchema(SEARCH_PARAMETERS))).not.toThrow()
    expect(() => assertSupportedJsonSchema(valueSchemaSpecToJsonSchema(SEARCH_OUTPUT))).not.toThrow()
  })
  it('defineTool accepts the definition', () => {
    const def = createSearchTool(deps([provider('a', [emit('https://a/1', 'CC0-1.0')])]))
    expect(def.name).toBe(SEARCH_TOOL_NAME)
    expect(def.timeoutMs).toBe(65000)
  })
  it('the description points to the settings location', () => {
    const def = createSearchTool(deps([provider('a', [emit('https://a/1', 'CC0-1.0')])]))
    expect(def.description).toMatch(/Plugins \(sidebar\) → @refkit\/dsh-plugin → refkit → Configure/)
  })
})

/** The wiring surface under test, narrowed from ToolDefinition's JsonValue-typed, optional members. */
interface WiredSearchTool {
  output: {
    render(args: unknown, value: SearchOutcome): unknown
    presentationMeta(args: unknown, value: SearchOutcome): unknown
  }
  presentCall(args: unknown): unknown
  presentResult(args: unknown, result: { content: unknown[]; isError: boolean; meta: unknown }): { title?: string }
}

describe('tool wiring', () => {
  it('render, presentationMeta, presentCall and presentResult project the outcome', async () => {
    const d = deps([provider('a', [emit('https://a/1', 'CC-BY'), emit('https://a/2', 'CC0-1.0')])])
    const args = { query: 'lion', intent: 'commercial-product' } as const
    const out = await runSearch(args, d)
    const def = createSearchTool(d) as unknown as WiredSearchTool
    expect(def.output.render(args, out)).toEqual([{ type: 'text', text: renderSearch(out) }])
    expect(narrowOutcome(def.output.presentationMeta(args, out))).toEqual(cardMeta(out))
    expect(def.presentCall({ query: 'lion', intent: 'commercial-product' })).toEqual({ card: 'generic', title: 'refkit search', kind: 'search', rawInput: { query: 'lion', intent: 'commercial-product' } })
    expect(def.presentResult(args, { content: [], isError: false, meta: cardMeta(out) }).title).toBe(`${out.count} refs for "lion"`)
    expect(def.presentResult(args, { content: [], isError: false, meta: undefined }).title).toBe('refkit search')
  })
})

describe('runSearch', () => {
  it('returns tiles with provenance and license and no undefined keys', async () => {
    const out = await runSearch({ query: 'lion' }, deps([provider('a', [emit('https://a/1', 'CC-BY', { rights: { license: 'CC-BY', licenseVersion: '4.0', author: 'Ada', rehostPolicy: 'cache-allowed', raw: { sourceTerms: 't', sourceUrl: 'https://a/1' } } })])]))
    expect(out.query).toBe('lion')
    expect(out.modalities).toEqual(['image'])
    expect(out.count).toBe(1)
    const tile = out.references[0]
    expect(tile).toMatchObject({ provider: 'a', canonicalUrl: 'https://a/1', license: 'CC-BY', licenseVersion: '4.0', author: 'Ada', thumbnail: 'https://a/1/t.jpg', width: 800, height: 600, title: 'title https://a/1' })
    expect(tile.useVerdict).toBeUndefined()
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
    expect(out.sources).toEqual([{ id: 'a', status: 'fulfilled', returned: 1 }])
    expect(narrowOutcome(out)).toEqual(out)
  })
  it('annotates a verdict and credit line when intent is set, without filtering', async () => {
    const out = await runSearch({ query: 'lion', intent: 'commercial-product' }, deps([provider('a', [emit('https://a/1', 'CC-BY'), emit('https://a/2', 'CC-BY-NC')])]))
    expect(out.intent).toBe('commercial-product')
    expect(out.count).toBe(2)
    const byUrl = Object.fromEntries(out.references.map(r => [r.canonicalUrl, r]))
    expect(byUrl['https://a/1'].useVerdict?.decision).toBe('allowed-with-attribution')
    expect(byUrl['https://a/1'].attribution).toContain('Ada')
    expect(byUrl['https://a/2'].useVerdict?.decision).toBe('denied')
    expect(byUrl['https://a/2'].attribution).toBeUndefined()
  })
  it('gateFor filters to allowed results and still annotates', async () => {
    const out = await runSearch({ query: 'lion', gateFor: 'commercial-product' }, deps([provider('a', [emit('https://a/1', 'CC0-1.0'), emit('https://a/2', 'CC-BY-NC')])]))
    expect(out.references.map(r => r.canonicalUrl)).toEqual(['https://a/1'])
    expect(out.references[0].useVerdict?.decision).toBe('allowed')
  })
  it('defaults limit from config and clamps an oversized request', async () => {
    const many = Array.from({ length: 40 }, (_, i) => emit(`https://a/${i}`, 'CC0-1.0'))
    const d = deps([provider('a', many)], resolveConfig({ limit: 5 }, {}))
    expect((await runSearch({ query: 'x' }, d)).count).toBe(5)
    expect((await runSearch({ query: 'x', limit: 99 }, d)).count).toBe(30)
  })
  it('reports partial failure as a warning and a failed source, not an error', async () => {
    const out = await runSearch({ query: 'x' }, deps([provider('a', [emit('https://a/1', 'CC0-1.0')]), failing('b')]))
    expect(out.count).toBe(1)
    expect(out.sources.find(s => s.id === 'b')?.status).toBe('failed')
    expect(out.warnings.some(w => w.startsWith('b: '))).toBe(true)
    for (const w of out.warnings) expect(w.length).toBeLessThanOrEqual(260)
  })
  it('throws a bounded message when every source fails', async () => {
    await expect(runSearch({ query: 'x' }, deps([failing('a'), failing('b')]))).rejects.toThrow(/all 2 sources failed: a: boom/)
    await expect(runSearch({ query: 'x' }, deps([failing('a')]))).rejects.toSatisfy((e: Error) => e.message.length < 400)
  })
  it('maps an unknown sources id to an actionable error', async () => {
    await expect(runSearch({ query: 'x', sources: ['nope'] }, deps([provider('a', [])]))).rejects.toThrow(/nope.*Enabled source ids: a/)
  })
  it('rethrows a non-selection error unchanged when sources is set', async () => {
    const err = await runSearch({ query: 'x', sources: ['a'], cursor: 'not-a-cursor' }, deps([provider('a', [])])).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toMatch(/invalid cursor/)
    expect((err as Error).message).not.toContain('Enabled source ids')
  })
  it('names the settings location for a known but unconfigured keyed source', async () => {
    await expect(runSearch({ query: 'x', sources: ['unsplash'] }, deps([provider('a', [])]))).rejects.toThrow(/Plugins \(sidebar\) → @refkit\/dsh-plugin → refkit → Configure/)
  })
  it('names the sources setting for a known source excluded by the allowlist', async () => {
    const keyless = await runSearch({ query: 'x', sources: ['met'] }, deps([provider('a', [])], resolveConfig({ sources: ['a'] }, {}))).catch((e: Error) => e)
    expect((keyless as Error).message).toMatch(/met: excluded by the sources setting under Plugins \(sidebar\) → @refkit\/dsh-plugin → refkit → Configure/)
    expect((keyless as Error).message).not.toMatch(/configure its key/)
    const keyed = await runSearch({ query: 'x', sources: ['unsplash'] }, deps([provider('a', [])], resolveConfig({ sources: ['a'], unsplashAccessKey: 'sekrit-unsplash-key' }, {}))).catch((e: Error) => e)
    expect((keyed as Error).message).toMatch(/unsplash: excluded by the sources setting/)
    expect((keyed as Error).message).not.toMatch(/configure its key/)
    expect((keyed as Error).message).not.toContain('sekrit-unsplash-key')
  })
  it('treats an empty sources array exactly like an omitted one', async () => {
    const d = deps([provider('a', [emit('https://a/1', 'CC0-1.0')])])
    const omitted = await runSearch({ query: 'x' }, d)
    expect(await runSearch({ query: 'x', sources: [] }, d)).toEqual(omitted)
  })
  it('sets the note on an empty result and rejects a blank query', async () => {
    const out = await runSearch({ query: 'x' }, deps([provider('a', [])]))
    expect(out.count).toBe(0)
    expect(out.note).toMatch(/No results/)
    await expect(runSearch({ query: '   ' }, deps([provider('a', [])]))).rejects.toThrow(/non-empty/)
  })
  it('includes core meta only with explain', async () => {
    const d = deps([provider('a', [emit('https://a/1', 'CC0-1.0')])])
    expect((await runSearch({ query: 'x' }, d)).meta).toBeUndefined()
    const explained = await runSearch({ query: 'x', explain: true }, d)
    expect((explained.meta as { passes: number }).passes).toBe(1)
    expect(JSON.parse(JSON.stringify(explained))).toEqual(explained)
  })
})
