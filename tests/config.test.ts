import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { met } from '@refkit/provider-met'
import { polyhaven } from '@refkit/provider-polyhaven'
import { rijksmuseum } from '@refkit/provider-rijksmuseum'
import {
  Config, DEFAULTS, KEY_ENV, KEY_FIELDS, KEYLESS_IDS, PLUGIN_VERSION, PROVIDER_IDS, PROVIDER_REGISTRY,
  buildClient, enabledProviders, readConfig, resolveConfig,
} from '../src/config.ts'

// The three N+1 sources' factories are wrapped in spies that still call the real
// factory, so the detail-fetch cap is asserted through the options the registry
// passes while every other test keeps building real providers.
vi.mock('@refkit/provider-met', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@refkit/provider-met')>()
  return { ...actual, met: vi.fn(actual.met) }
})
vi.mock('@refkit/provider-rijksmuseum', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@refkit/provider-rijksmuseum')>()
  return { ...actual, rijksmuseum: vi.fn(actual.rijksmuseum) }
})
vi.mock('@refkit/provider-polyhaven', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@refkit/provider-polyhaven')>()
  return { ...actual, polyhaven: vi.fn(actual.polyhaven) }
})

const EXPECTED_IDS = [
  'artic', 'brave', 'europeana', 'flickr', 'freesound', 'gutendex', 'internet-archive', 'jamendo', 'met',
  'nailbook', 'openverse', 'openverse-audio', 'pexels', 'pexels-video', 'pixabay', 'pixabay-video', 'poetrydb',
  'polyhaven', 'ambientcg', 'rijksmuseum', 'smithsonian', 'unsplash', 'wikimedia-commons',
].sort()

describe('provider registry', () => {
  it('pins the 23 factory ids from the 19 packages', () => {
    expect([...PROVIDER_IDS].sort()).toEqual(EXPECTED_IDS)
    expect(new Set(PROVIDER_IDS).size).toBe(23)
  })
  it('every entry builds a provider whose id matches', () => {
    const cfg = resolveConfig({ unsplashAccessKey: 'u', pexelsApiKey: 'p', pixabayKey: 'x', flickrApiKey: 'f', smithsonianApiKey: 's', braveToken: 'b', freesoundToken: 'fs', jamendoClientId: 'j', europeanaApiKey: 'e' }, {})
    for (const entry of PROVIDER_REGISTRY) {
      const provider = entry.make(cfg)
      expect(provider.id).toBe(entry.id)
      expect(provider.modalities).toEqual(entry.modalities)
    }
  })
  it('keyless ids are exactly the entries without a key field', () => {
    expect([...KEYLESS_IDS].sort()).toEqual(PROVIDER_REGISTRY.filter(e => e.key === undefined).map(e => e.id).sort())
    expect(KEYLESS_IDS).toContain('openverse')
    expect(KEYLESS_IDS).not.toContain('unsplash')
  })
})

describe('resolveConfig', () => {
  it('applies defaults with an empty config and no environment', () => {
    const cfg = resolveConfig({}, {})
    expect(cfg.limit).toBe(DEFAULTS.limit)
    expect(cfg.poolFactor).toBe(2)
    expect(cfg.deadlineMs).toBe(15000)
    expect(cfg.timeoutMs).toBe(10000)
    expect(cfg.rerank).toBe(true)
    expect(cfg.sourceConfidence).toBe(true)
    expect(cfg.sources).toEqual([])
    expect(cfg.userAgent).toBe(`refkit-dsh-plugin/${PLUGIN_VERSION}`)
    for (const field of KEY_FIELDS) expect(cfg.keys[field]).toBeUndefined()
  })
  it('reads each key from its environment names in order', () => {
    expect(resolveConfig({}, { UNSPLASH_KEY: 'plain' }).keys.unsplashAccessKey).toBe('plain')
    expect(resolveConfig({}, { UNSPLASH_KEY: 'plain', REFKIT_UNSPLASH_KEY: 'scoped' }).keys.unsplashAccessKey).toBe('scoped')
    expect(resolveConfig({}, { SI_KEY: 's' }).keys.smithsonianApiKey).toBe('s')
    expect(resolveConfig({}, { BRAVE_TOKEN: 'b' }).keys.braveToken).toBe('b')
    expect(resolveConfig({}, { FREESOUND_TOKEN: 'f' }).keys.freesoundToken).toBe('f')
    expect(resolveConfig({}, { JAMENDO_CLIENT_ID: 'j' }).keys.jamendoClientId).toBe('j')
    expect(resolveConfig({}, { REFKIT_OPENVERSE_TOKEN: 'o' }).keys.openverseToken).toBe('o')
  })
  it('a settings value beats the environment and blanks are ignored', () => {
    expect(resolveConfig({ unsplashAccessKey: 'settings' }, { REFKIT_UNSPLASH_KEY: 'env' }).keys.unsplashAccessKey).toBe('settings')
    expect(resolveConfig({ unsplashAccessKey: '   ' }, { REFKIT_UNSPLASH_KEY: 'env' }).keys.unsplashAccessKey).toBe('env')
  })
  it('pins the full environment fallback table, one row per KEY_FIELD', () => {
    expect(KEY_ENV).toEqual({
      unsplashAccessKey: ['REFKIT_UNSPLASH_KEY', 'UNSPLASH_KEY'],
      pexelsApiKey: ['REFKIT_PEXELS_KEY', 'PEXELS_KEY'],
      pixabayKey: ['REFKIT_PIXABAY_KEY', 'PIXABAY_KEY'],
      flickrApiKey: ['REFKIT_FLICKR_KEY', 'FLICKR_KEY'],
      smithsonianApiKey: ['REFKIT_SMITHSONIAN_KEY', 'SI_KEY'],
      braveToken: ['REFKIT_BRAVE_KEY', 'BRAVE_TOKEN'],
      freesoundToken: ['REFKIT_FREESOUND_KEY', 'FREESOUND_TOKEN'],
      jamendoClientId: ['REFKIT_JAMENDO_CLIENT_ID', 'JAMENDO_CLIENT_ID'],
      europeanaApiKey: ['REFKIT_EUROPEANA_KEY', 'EUROPEANA_KEY'],
      openverseToken: ['REFKIT_OPENVERSE_TOKEN'],
    })
    expect(Object.keys(KEY_ENV).sort()).toEqual([...KEY_FIELDS].sort())
  })
  it('clamps numeric settings into range and truncates fractions', () => {
    expect(resolveConfig({ limit: 99 }, {}).limit).toBe(30)
    expect(resolveConfig({ limit: 7.9 }, {}).limit).toBe(7)
    expect(resolveConfig({ poolFactor: 0 }, {}).poolFactor).toBe(1)
    expect(resolveConfig({ deadlineMs: 999 }, {}).deadlineMs).toBe(1000)
  })
})

describe('enabledProviders', () => {
  it('with no keys enables exactly the keyless sources', () => {
    const ids = enabledProviders(resolveConfig({}, {})).map(p => p.id).sort()
    expect(ids).toEqual([...KEYLESS_IDS].sort())
  })
  it('a key enables both factories of a dual package', () => {
    const ids = enabledProviders(resolveConfig({ pexelsApiKey: 'k' }, {})).map(p => p.id)
    expect(ids).toContain('pexels')
    expect(ids).toContain('pexels-video')
    expect(ids).not.toContain('unsplash')
  })
  it('sources whitelists within the enabled set and keeps registry order', () => {
    const ids = enabledProviders(resolveConfig({ sources: ['met', 'unsplash', 'artic'] }, {})).map(p => p.id)
    expect(ids).toEqual(['artic', 'met'])
  })
  it('museum detail fetches are capped at the configured limit', () => {
    const cfg = resolveConfig({ limit: 7 }, {})
    const make = (id: string) => PROVIDER_REGISTRY.find(e => e.id === id)!.make(cfg)
    make('met')
    expect(vi.mocked(met)).toHaveBeenLastCalledWith({ maxObjects: 7 })
    make('rijksmuseum')
    expect(vi.mocked(rijksmuseum)).toHaveBeenLastCalledWith({ maxObjects: 7 })
    make('polyhaven')
    expect(vi.mocked(polyhaven)).toHaveBeenLastCalledWith({ maxAssets: 7 })
  })
})

describe('sources schema', () => {
  it('rejects an unknown source id, naming the valid ids', () => {
    expect(() => Config({ sources: ['unsplsh'] })).toThrow(/unsplsh/)
    expect(() => Config({ sources: ['unsplsh'] })).toThrow(/wikimedia-commons/)
  })
  it('accepts known ids', () => {
    expect(() => Config({ sources: ['met', 'unsplash'] })).not.toThrow()
  })
})

describe('Config schema', () => {
  it('readConfig snapshots the defaults from an empty entry', () => {
    const values = readConfig(Config({}))
    expect(values).toMatchObject({ sources: [], limit: 12, poolFactor: 2, deadlineMs: 15000, timeoutMs: 10000, rerank: true, sourceConfidence: true })
    for (const field of KEY_FIELDS) expect(values[field], field).toBeUndefined()
  })
  it('readConfig reads only the declared fields; unknown keys pass the schema but are ignored', () => {
    const declared = [...KEY_FIELDS, 'sources', 'limit', 'poolFactor', 'deadlineMs', 'timeoutMs', 'rerank', 'sourceConfidence', 'userAgent']
    const values = readConfig(Config({ stray: 1 } as never))
    expect(Object.keys(values).sort()).toEqual(declared.sort())
    // defensive: a declared field without a reference reads as undefined
    expect(readConfig({ ...Config({}), limit: 5 } as never).limit).toBeUndefined()
  })
  it('exposes every field as a live reference', () => {
    const config = Config({})
    expect(Object.keys(config)).toHaveLength(18)
    expect(Object.values(config).every(r => typeof (r as { get?: unknown }).get === 'function')).toBe(true)
  })
  it('marks exactly the KEY_FIELDS secret and all 18 fields volatile in the serialized schema', () => {
    // toJSON() is a ref table: refs[uid] is the object node whose dict maps field -> ref id
    const json = Config.toJSON() as unknown as { uid: number; refs: Record<string, { dict?: Record<string, number>; meta?: { role?: string; volatile?: boolean } }> }
    const dict = json.refs[json.uid].dict!
    const metaOf = (field: string) => json.refs[dict[field]]?.meta
    for (const field of KEY_FIELDS) expect(metaOf(field)?.role, field).toBe('secret')
    const secretFields = Object.keys(dict).filter(field => metaOf(field)?.role === 'secret')
    expect(secretFields.sort()).toEqual([...KEY_FIELDS].sort())
    expect(Object.keys(dict)).toHaveLength(18)
    for (const field of Object.keys(dict)) expect(metaOf(field)?.volatile, field).toBe(true)
  })
  it('rejects out-of-range numbers', () => {
    expect(() => Config({ limit: 0 })).toThrow()
    expect(() => Config({ poolFactor: 9 })).toThrow()
    expect(() => Config({ deadlineMs: 10 })).toThrow()
  })
})

describe('buildClient', () => {
  it('wires the resolved config into createRefkit', () => {
    const cfg = resolveConfig({ pexelsApiKey: 'k', rerank: false, sourceConfidence: false }, {})
    let seen: Record<string, unknown> | undefined
    const client = buildClient(cfg, (opts) => { seen = opts as unknown as Record<string, unknown>; return { providers: opts.providers } as never })
    expect(client).toBeDefined()
    expect(seen?.rerank).toBe(false)
    expect(seen?.sourceConfidence).toBe(false)
    expect(seen?.resilience).toEqual({ timeoutMs: 10000 })
    expect(seen?.userAgent).toBe(`refkit-dsh-plugin/${PLUGIN_VERSION}`)
    expect((seen?.providers as { id: string }[]).map(p => p.id)).toContain('pexels')
  })
  it('leaves rerank undefined (core default) when enabled', () => {
    let seen: Record<string, unknown> | undefined
    buildClient(resolveConfig({}, {}), (opts) => { seen = opts as unknown as Record<string, unknown>; return {} as never })
    expect(seen && 'rerank' in seen).toBe(false)
  })
  it('throws a clear error when the whitelist leaves nothing enabled', () => {
    expect(() => buildClient(resolveConfig({ sources: ['unsplash'] }, {}))).toThrow(/no sources enabled/i)
  })
})

describe('PLUGIN_VERSION', () => {
  it('matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
    expect(PLUGIN_VERSION).toBe(pkg.version)
  })
})
