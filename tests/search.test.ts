import { describe, expect, it } from 'vitest'
import {
  SourceSelectionError, createRefkit, defineProvider, isSourceSelectionError,
  type EmittedAudioReference, type EmittedImageReference, type EmittedReference, type EmittedVideoReference, type LicenseId, type Modality, type RefkitClient,
} from '@refkit/core'
import { assertSupportedJsonSchema, parameterSchemaSpecToJsonSchema, valueSchemaSpecToJsonSchema } from '@deepseek-ai/dsh-tools'
import { resolveConfig } from '../src/config.ts'
import { SEARCH_OUTPUT, SEARCH_PARAMETERS, SEARCH_TOOL_NAME, createSearchTool, runSearch, type SearchDeps } from '../src/tools/search.ts'
import { narrowOutcome, type SearchOutcome } from '../src/core/outcome.ts'
import { cardMeta, renderSearch } from '../src/render.ts'

const emit = (url: string, license: LicenseId, extra: Partial<EmittedImageReference> = {}): EmittedImageReference => ({
  modality: 'image',
  title: `title ${url}`,
  sourceUrl: url,
  rights: { license, author: 'Ada', rehostPolicy: 'cache-allowed', raw: { sourceTerms: 't', sourceUrl: url } },
  thumbnail: { url: `${url}/t.jpg` },
  visual: { width: 800, height: 600 },
  ...extra,
})

const provider = (id: string, refs: EmittedReference[], modalities: Modality[] = ['image']) =>
  defineProvider({ id, modalities, search: async () => refs })
const failing = (id: string) =>
  defineProvider({ id, modalities: ['image'], search: async () => { throw new Error('boom ' + 'x'.repeat(300)) } })

function deps(providers: ReturnType<typeof defineProvider>[], config = resolveConfig({}, {})): SearchDeps {
  const client = createRefkit({ providers, rerank: false, sourceConfidence: false, userAgent: false })
  return { client: () => client, config: () => config }
}

/** A client whose search always throws `err`, standing in for one built with another copy of core. */
function throwingDeps(err: unknown, enabled: string[] = ['a']): SearchDeps {
  const client = { providers: enabled.map(id => ({ id })), searchWithMeta: async () => { throw err } } as unknown as RefkitClient
  const config = resolveConfig({}, {})
  return { client: () => client, config: () => config }
}

const rightsFor = (url: string): EmittedReference['rights'] => ({ license: 'CC0-1.0', author: 'Ada', rehostPolicy: 'cache-allowed', raw: { sourceTerms: 't', sourceUrl: url } })

const audioRef: EmittedAudioReference = {
  modality: 'audio',
  title: 'rain on a tin roof',
  sourceUrl: 'https://snd.example/1',
  rights: rightsFor('https://snd.example/1'),
  thumbnail: { url: 'https://snd.example/1/art.jpg' },
  preview: { url: 'https://snd.example/1.mp3', mediaType: 'audio/mpeg' },
  audio: { durationSec: 65.4, bitrateKbps: 128 },
}

const videoRef: EmittedVideoReference = {
  modality: 'video',
  title: 'surf at dawn',
  sourceUrl: 'https://vid.example/1',
  rights: rightsFor('https://vid.example/1'),
  thumbnail: { url: 'https://vid.example/1/poster.jpg' },
  preview: { url: 'https://vid.example/1.mp4', mediaType: 'video/mp4', width: 640, height: 360 },
  video: { durationSec: 12 },
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
    expect(def.description).toMatch(/Plugins \(sidebar\) → refkit → Components → refkit/)
  })
  it('the description counts 24 sources and lists polyhaven-hdri', () => {
    const def = createSearchTool(deps([provider('a', [emit('https://a/1', 'CC0-1.0')])]))
    expect(def.description).toContain('across up to 24 sources')
    expect(def.description).toContain('polyhaven-hdri (image)')
  })
  it('the sources parameter speaks of source ids, never provider ids', () => {
    expect(SEARCH_PARAMETERS.sources.description).toMatch(/source ids/)
    expect(SEARCH_PARAMETERS.sources.description).not.toMatch(/provider/i)
  })
  it('the tile schema requires source (not provider) and carries durationSec', () => {
    const tile = (valueSchemaSpecToJsonSchema(SEARCH_OUTPUT) as { properties: { references: { items: { required: string[]; properties: Record<string, unknown> } } } }).properties.references.items
    expect(tile.required).toContain('source')
    expect(tile.properties).not.toHaveProperty('provider')
    expect(tile.properties.durationSec).toEqual({ type: 'number' })
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
    expect(tile).toMatchObject({ source: 'a', canonicalUrl: 'https://a/1', license: 'CC-BY', licenseVersion: '4.0', author: 'Ada', thumbnail: 'https://a/1/t.jpg', width: 800, height: 600, title: 'title https://a/1' })
    expect(tile).not.toHaveProperty('provider')
    expect(tile).not.toHaveProperty('durationSec')
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
  it('maps a selection miss thrown by another copy of core (a structural look-alike) to the same hint', async () => {
    const lookalike = Object.assign(new Error('refkit.search: no configured source matches id(s) nope'), {
      name: 'SourceSelectionError', code: 'no-matching-source', requested: ['nope'], unknown: ['nope'], modalities: ['image'],
    })
    expect(lookalike).not.toBeInstanceOf(SourceSelectionError)
    await expect(runSearch({ query: 'x', sources: ['nope'] }, throwingDeps(lookalike))).rejects.toThrow(/nope.*Enabled source ids: a/)
  })
  it('rethrows an unscoped selection miss (no-source-for-query) as-is, without the hint', async () => {
    const err = await runSearch({ query: 'x', modalities: ['audio'] }, deps([provider('a', [])])).catch((e: unknown) => e)
    expect(isSourceSelectionError(err)).toBe(true)
    expect((err as SourceSelectionError).code).toBe('no-source-for-query')
    expect((err as Error).message).not.toContain('Enabled source ids')
  })
  it('gives no hint for a no-source-for-query error even when sources is set', async () => {
    const miss = new SourceSelectionError({ code: 'no-source-for-query', requested: ['a'], unknown: [], modalities: ['image'] })
    const err = await runSearch({ query: 'x', sources: ['a'] }, throwingDeps(miss)).catch((e: unknown) => e)
    expect(err).toBe(miss)
  })
  it('rethrows a non-selection error unchanged when sources is set', async () => {
    const err = await runSearch({ query: 'x', sources: ['a'], cursor: 'not-a-cursor' }, deps([provider('a', [])])).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toMatch(/invalid cursor/)
    expect((err as Error).message).not.toContain('Enabled source ids')
  })
  it('names the settings location for a known but unconfigured keyed source', async () => {
    await expect(runSearch({ query: 'x', sources: ['unsplash'] }, deps([provider('a', [])]))).rejects.toThrow(/Plugins \(sidebar\) → refkit → Components → refkit/)
  })
  it('names the sources setting for a known source excluded by the allowlist', async () => {
    const keyless = await runSearch({ query: 'x', sources: ['met'] }, deps([provider('a', [])], resolveConfig({ sources: ['a'] }, {}))).catch((e: Error) => e)
    expect((keyless as Error).message).toMatch(/met: excluded by the sources setting under Plugins \(sidebar\) → refkit → Components → refkit/)
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
    // The pass-through follows core 0.10's names: sources[].sourceId, not providers[].providerId.
    expect((explained.meta as { sources: { sourceId: string }[] }).sources.map(s => s.sourceId)).toEqual(['a'])
    expect(explained.meta).not.toHaveProperty('providers')
    expect(JSON.parse(JSON.stringify(explained))).toEqual(explained)
  })
})

describe('tiles by modality', () => {
  it('projects durationSec for audio and video', async () => {
    const out = await runSearch({ query: 'x', modalities: ['audio', 'video'] }, deps([provider('snd', [audioRef], ['audio']), provider('vid', [videoRef], ['video'])]))
    const bySource = Object.fromEntries(out.references.map(t => [t.source, t]))
    expect(bySource.snd).toMatchObject({ modality: 'audio', durationSec: 65.4, thumbnail: 'https://snd.example/1/art.jpg', preview: 'https://snd.example/1.mp3' })
    expect(bySource.vid).toMatchObject({ modality: 'video', durationSec: 12, thumbnail: 'https://vid.example/1/poster.jpg', preview: 'https://vid.example/1.mp4' })
    expect(narrowOutcome(cardMeta(out))?.references.map(t => t.durationSec).sort()).toEqual([12, 65.4])
  })
  it('takes width and height from the preview when visual is unset, and from visual when both are known', async () => {
    const imageWithPreviewOnly = emit('https://a/1', 'CC0-1.0', { visual: undefined, preview: { url: 'https://a/1/p.jpg', mediaType: 'image/jpeg', width: 1024, height: 768 } })
    const videoWithVisual: EmittedVideoReference = { ...videoRef, sourceUrl: 'https://vid.example/2', visual: { width: 1920, height: 1080 } }
    const out = await runSearch({ query: 'x', modalities: ['image', 'video', 'audio'] }, deps([
      provider('img', [imageWithPreviewOnly]),
      provider('vid', [videoRef, videoWithVisual], ['video']),
      provider('snd', [audioRef], ['audio']),
    ]))
    const byUrl = Object.fromEntries(out.references.map(t => [t.canonicalUrl, t]))
    expect(byUrl['https://a/1']).toMatchObject({ width: 1024, height: 768 })
    expect(byUrl['https://vid.example/1']).toMatchObject({ width: 640, height: 360 })
    expect(byUrl['https://vid.example/2']).toMatchObject({ width: 1920, height: 1080 })
    expect(byUrl['https://snd.example/1']).not.toHaveProperty('width')
    expect(byUrl['https://snd.example/1']).not.toHaveProperty('height')
  })
})
