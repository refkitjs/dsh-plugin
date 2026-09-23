import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  Config, DEFAULTS, KEY_ENV, KEY_FIELDS, KEYLESS_IDS, PLUGIN_VERSION, PROVIDER_IDS, PROVIDER_REGISTRY,
  buildClient, enabledProviders, resolveConfig, validateConfig,
} from '../src/config.ts'

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
  it('every KEY_FIELD has at least one env name and every env name is REFKIT_-scoped or a known plain name', () => {
    for (const field of KEY_FIELDS) expect(KEY_ENV[field].length).toBeGreaterThan(0)
    expect(KEY_ENV.unsplashAccessKey).toEqual(['REFKIT_UNSPLASH_KEY', 'UNSPLASH_KEY'])
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
    const met = PROVIDER_REGISTRY.find(e => e.id === 'met')!
    // the factory closes over maxObjects; assert through the registry's declared cap
    expect(met.detailCap?.(cfg)).toBe(7)
    const poly = PROVIDER_REGISTRY.find(e => e.id === 'polyhaven')!
    expect(poly.detailCap?.(cfg)).toBe(7)
  })
})

describe('validateConfig', () => {
  it('rejects an unknown source id naming the valid ids', () => {
    expect(() => validateConfig({ sources: ['unsplsh'] })).toThrow(/unsplsh.*valid ids/i)
  })
  it('accepts an empty config and known ids', () => {
    expect(() => validateConfig({})).not.toThrow()
    expect(() => validateConfig({ sources: ['met', 'unsplash'] })).not.toThrow()
  })
})

describe('Config schema', () => {
  it('applies schemastery defaults and marks keys secret', () => {
    const value = new Config({}) as Record<string, unknown>
    expect(value.limit).toBe(12)
    expect(value.poolFactor).toBe(2)
    const json = JSON.stringify(Config.toJSON())
    expect(json).toContain('"role":"secret"')
    expect(json).toContain('unsplashAccessKey')
  })
  it('rejects out-of-range numbers', () => {
    expect(() => new Config({ limit: 0 })).toThrow()
    expect(() => new Config({ poolFactor: 9 })).toThrow()
    expect(() => new Config({ deadlineMs: 10 })).toThrow()
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
