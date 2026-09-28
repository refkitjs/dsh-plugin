/**
 * Plugin configuration: the schemastery schema (every field volatile, so the
 * Host projects it as the `refkit` settings namespace and commits edits into
 * live references), environment fallbacks shared with @refkit/mcp's CLI, the
 * static registry of the 23 provider factories, and the RefkitClient factory.
 * Secrets are read here and nowhere else.
 * @module @refkit/dsh-plugin/config
 */

import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { createRefkit, type ReferenceProvider, type RefkitClient, type RefkitOptions } from '@refkit/core'
import { artic } from '@refkit/provider-artic'
import { brave } from '@refkit/provider-brave'
import { europeana } from '@refkit/provider-europeana'
import { flickr } from '@refkit/provider-flickr'
import { freesound } from '@refkit/provider-freesound'
import { gutendex } from '@refkit/provider-gutendex'
import { internetArchive } from '@refkit/provider-internet-archive'
import { jamendo } from '@refkit/provider-jamendo'
import { met } from '@refkit/provider-met'
import { nailbook } from '@refkit/provider-nailbook'
import { openverse, openverseAudio } from '@refkit/provider-openverse'
import { pexels, pexelsVideo } from '@refkit/provider-pexels'
import { pixabay, pixabayVideo } from '@refkit/provider-pixabay'
import { poetrydb } from '@refkit/provider-poetrydb'
import { ambientcg, polyhaven } from '@refkit/provider-polyhaven'
import { rijksmuseum } from '@refkit/provider-rijksmuseum'
import { smithsonian } from '@refkit/provider-smithsonian'
import { unsplash } from '@refkit/provider-unsplash'
import { wikimediaCommons } from '@refkit/provider-wikimedia-commons'
import type { Modality } from './core/outcome.ts'

/** Kept in sync with package.json by tests/config.test.ts. */
export const PLUGIN_VERSION = '0.2.0'

export const KEY_FIELDS = [
  'unsplashAccessKey', 'pexelsApiKey', 'pixabayKey', 'flickrApiKey', 'smithsonianApiKey',
  'braveToken', 'freesoundToken', 'jamendoClientId', 'europeanaApiKey', 'openverseToken',
] as const
export type KeyField = (typeof KEY_FIELDS)[number]

/** Environment names per key, first match wins. The nine keyed sources mirror @refkit/mcp's CLI. */
export const KEY_ENV: Record<KeyField, readonly string[]> = {
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
}

/** Upper bound of the configurable whole-search deadline; the tool's timeout backstop derives from it. */
export const MAX_DEADLINE_MS = 60000

export const DEFAULTS = {
  limit: 12,
  poolFactor: 2,
  deadlineMs: 15000,
  timeoutMs: 10000,
  rerank: true,
  sourceConfidence: true,
} as const

/** Plain settings values: what each reference's `.get()` returns. Every field optional so an unconfigured mount loads silently. */
export interface ConfigValues {
  unsplashAccessKey?: string
  pexelsApiKey?: string
  pixabayKey?: string
  flickrApiKey?: string
  smithsonianApiKey?: string
  braveToken?: string
  freesoundToken?: string
  jamendoClientId?: string
  europeanaApiKey?: string
  openverseToken?: string
  /** Provider ids to enable; empty = every source whose key is present. */
  sources?: readonly string[]
  limit?: number
  poolFactor?: number
  deadlineMs?: number
  timeoutMs?: number
  rerank?: boolean
  sourceConfidence?: boolean
  userAgent?: string
}

export interface ResolvedConfig {
  keys: Record<KeyField, string | undefined>
  sources: string[]
  limit: number
  poolFactor: number
  deadlineMs: number
  timeoutMs: number
  rerank: boolean
  sourceConfidence: boolean
  userAgent: string
}

function nonEmpty(value: string | undefined): string | undefined {
  const t = (value ?? '').trim()
  return t.length > 0 ? t : undefined
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.floor(value as number) : fallback
  return Math.min(max, Math.max(min, n))
}

/** Resolve plain settings values plus environment into validated facts with defaults. */
export function resolveConfig(config: ConfigValues, env: NodeJS.ProcessEnv = process.env): ResolvedConfig {
  const keys = {} as Record<KeyField, string | undefined>
  for (const field of KEY_FIELDS) {
    let value = nonEmpty(config[field])
    if (value === undefined) {
      for (const name of KEY_ENV[field]) {
        value = nonEmpty(env[name])
        if (value !== undefined) break
      }
    }
    keys[field] = value
  }
  return {
    keys,
    sources: Array.isArray(config.sources) ? config.sources.filter(s => typeof s === 'string' && s.length > 0) : [],
    limit: clampInt(config.limit, DEFAULTS.limit, 1, 30),
    poolFactor: clampInt(config.poolFactor, DEFAULTS.poolFactor, 1, 4),
    deadlineMs: clampInt(config.deadlineMs, DEFAULTS.deadlineMs, 1000, MAX_DEADLINE_MS),
    timeoutMs: clampInt(config.timeoutMs, DEFAULTS.timeoutMs, 1000, 60000),
    rerank: config.rerank ?? DEFAULTS.rerank,
    sourceConfidence: config.sourceConfidence ?? DEFAULTS.sourceConfidence,
    userAgent: nonEmpty(config.userAgent) ?? `refkit-dsh-plugin/${PLUGIN_VERSION}`,
  }
}

/** One provider factory the plugin can mount. */
export interface ProviderEntry {
  id: string
  modalities: Modality[]
  /** The secret field that enables this entry; undefined = keyless. */
  key?: KeyField
  make: (cfg: ResolvedConfig) => ReferenceProvider
}

const k = (cfg: ResolvedConfig, field: KeyField): string => cfg.keys[field] ?? ''

export const PROVIDER_REGISTRY: readonly ProviderEntry[] = [
  { id: 'artic', modalities: ['image'], make: () => artic() },
  { id: 'brave', modalities: ['image'], key: 'braveToken', make: cfg => brave({ token: k(cfg, 'braveToken') }) },
  { id: 'europeana', modalities: ['image'], key: 'europeanaApiKey', make: cfg => europeana({ apiKey: k(cfg, 'europeanaApiKey') }) },
  { id: 'flickr', modalities: ['image'], key: 'flickrApiKey', make: cfg => flickr({ apiKey: k(cfg, 'flickrApiKey') }) },
  { id: 'freesound', modalities: ['audio'], key: 'freesoundToken', make: cfg => freesound({ apiKey: k(cfg, 'freesoundToken') }) },
  { id: 'gutendex', modalities: ['text'], make: () => gutendex() },
  { id: 'internet-archive', modalities: ['video', 'text'], make: () => internetArchive() },
  { id: 'jamendo', modalities: ['audio'], key: 'jamendoClientId', make: cfg => jamendo({ clientId: k(cfg, 'jamendoClientId') }) },
  { id: 'met', modalities: ['image'], make: cfg => met({ maxObjects: cfg.limit }) },
  { id: 'nailbook', modalities: ['image'], make: () => nailbook() },
  { id: 'openverse', modalities: ['image'], make: cfg => openverse(cfg.keys.openverseToken ? { token: cfg.keys.openverseToken } : {}) },
  { id: 'openverse-audio', modalities: ['audio'], make: cfg => openverseAudio(cfg.keys.openverseToken ? { token: cfg.keys.openverseToken } : {}) },
  { id: 'pexels', modalities: ['image'], key: 'pexelsApiKey', make: cfg => pexels({ apiKey: k(cfg, 'pexelsApiKey') }) },
  { id: 'pexels-video', modalities: ['video'], key: 'pexelsApiKey', make: cfg => pexelsVideo({ apiKey: k(cfg, 'pexelsApiKey') }) },
  { id: 'pixabay', modalities: ['image'], key: 'pixabayKey', make: cfg => pixabay({ key: k(cfg, 'pixabayKey') }) },
  { id: 'pixabay-video', modalities: ['video'], key: 'pixabayKey', make: cfg => pixabayVideo({ key: k(cfg, 'pixabayKey') }) },
  { id: 'poetrydb', modalities: ['text'], make: () => poetrydb() },
  { id: 'polyhaven', modalities: ['image'], make: cfg => polyhaven({ maxAssets: cfg.limit }) },
  { id: 'ambientcg', modalities: ['image'], make: cfg => ambientcg({ limit: cfg.limit }) },
  { id: 'rijksmuseum', modalities: ['image'], make: cfg => rijksmuseum({ maxObjects: cfg.limit }) },
  { id: 'smithsonian', modalities: ['image'], key: 'smithsonianApiKey', make: cfg => smithsonian({ apiKey: k(cfg, 'smithsonianApiKey') }) },
  { id: 'unsplash', modalities: ['image'], key: 'unsplashAccessKey', make: cfg => unsplash({ accessKey: k(cfg, 'unsplashAccessKey') }) },
  { id: 'wikimedia-commons', modalities: ['image'], make: () => wikimediaCommons({ thumbWidth: 500 }) },
]

export const PROVIDER_IDS: readonly string[] = PROVIDER_REGISTRY.map(e => e.id)
export const KEYLESS_IDS: readonly string[] = PROVIDER_REGISTRY.filter(e => e.key === undefined).map(e => e.id)

const secret = (text: string) => z.string().role('secret').description(text).volatile()

/**
 * Schemastery schema. Every field is volatile: a settings edit commits into the
 * same references and emits `loader/volatile-update` instead of remounting the
 * plugin. An unknown `sources` id fails validation, so the Host refuses the write.
 */
export const Config = z.object({
  unsplashAccessKey: secret('Unsplash access key (free at unsplash.com/developers). Empty disables unsplash. Env: REFKIT_UNSPLASH_KEY / UNSPLASH_KEY.'),
  pexelsApiKey: secret('Pexels API key (free at pexels.com/api). Enables pexels and pexels-video. Env: REFKIT_PEXELS_KEY / PEXELS_KEY.'),
  pixabayKey: secret('Pixabay API key (free at pixabay.com/api/docs). Enables pixabay and pixabay-video. Env: REFKIT_PIXABAY_KEY / PIXABAY_KEY.'),
  flickrApiKey: secret('Flickr API key. Env: REFKIT_FLICKR_KEY / FLICKR_KEY.'),
  smithsonianApiKey: secret('api.data.gov key for the Smithsonian Open Access API. Env: REFKIT_SMITHSONIAN_KEY / SI_KEY.'),
  braveToken: secret('Brave Search API token (web image discovery). Env: REFKIT_BRAVE_KEY / BRAVE_TOKEN.'),
  freesoundToken: secret('Freesound APIv2 token. Env: REFKIT_FREESOUND_KEY / FREESOUND_TOKEN.'),
  jamendoClientId: secret('Jamendo client id. Env: REFKIT_JAMENDO_CLIENT_ID / JAMENDO_CLIENT_ID.'),
  europeanaApiKey: secret('Europeana API key (free). Env: REFKIT_EUROPEANA_KEY / EUROPEANA_KEY.'),
  openverseToken: secret('Optional Openverse OAuth2 token; anonymous works with lower rate limits. Env: REFKIT_OPENVERSE_TOKEN.'),
  sources: z.array(z.union(PROVIDER_IDS)).default([]).description('Provider ids to enable (empty = every source whose key is present).').volatile(),
  limit: z.number().step(1).min(1).max(30).default(DEFAULTS.limit).description('Default results per call; also caps per-item detail fetches for met, rijksmuseum and polyhaven.').volatile(),
  poolFactor: z.number().step(1).min(1).max(4).default(DEFAULTS.poolFactor).description('Rank-fusion pool multiplier.').volatile(),
  deadlineMs: z.number().step(1).min(1000).max(MAX_DEADLINE_MS).default(DEFAULTS.deadlineMs).description('Whole-search deadline in ms.').volatile(),
  timeoutMs: z.number().step(1).min(1000).max(60000).default(DEFAULTS.timeoutMs).description('Per-source timeout in ms.').volatile(),
  rerank: z.boolean().default(DEFAULTS.rerank).description('Rerank fused results lexically over title, description, tags and excerpt.').volatile(),
  sourceConfidence: z.boolean().default(DEFAULTS.sourceConfidence).description('Down-weight sources whose batch never mentions the query.').volatile(),
  userAgent: z.string().description('User-Agent for provider requests. Default refkit-dsh-plugin/<version>.').volatile(),
})

/** Config as `apply` receives it: every field a live Loader reference. */
export type Config = { readonly [K in keyof ConfigValues]-?: Volatile<ConfigValues[K]> }

// The hand-written Config type and the schema output must agree.
const _schemaCheck: Config = {} as ReturnType<typeof Config>
void _schemaCheck

/**
 * The schema's declared field names. `z.object` passes unknown keys through, so a stray key in
 * the user's `cordis.patch.yml` entry reaches `apply`; reading only these keeps it ignored.
 */
const CONFIG_FIELDS = Object.keys(Config.dict ?? {}) as (keyof ConfigValues)[]

/** One consistent snapshot; the Loader commits every reference before it emits the event. */
export function readConfig(config: Config): ConfigValues {
  return Object.fromEntries(CONFIG_FIELDS.map((field) => {
    const ref = config[field] as Partial<Volatile<unknown>> | undefined
    return [field, typeof ref?.get === 'function' ? ref.get() : undefined]
  })) as ConfigValues
}

/** Providers that are keyless or keyed-and-configured, intersected with the whitelist, in registry order. */
export function enabledProviders(cfg: ResolvedConfig): ReferenceProvider[] {
  const allow = cfg.sources.length > 0 ? new Set(cfg.sources) : null
  return PROVIDER_REGISTRY
    .filter(e => (e.key === undefined || cfg.keys[e.key] !== undefined) && (allow === null || allow.has(e.id)))
    .map(e => e.make(cfg))
}

/** Build the RefkitClient for one resolved configuration. */
export function buildClient(cfg: ResolvedConfig, createClient: (opts: RefkitOptions) => RefkitClient = createRefkit): RefkitClient {
  const providers = enabledProviders(cfg)
  if (providers.length === 0) {
    throw new Error('refkit: no sources enabled — add a key under Plugins (sidebar) → @refkit/dsh-plugin → refkit → Configure or widen `sources`')
  }
  return createClient({
    providers,
    ...(cfg.rerank ? {} : { rerank: false as const }),
    sourceConfidence: cfg.sourceConfidence,
    resilience: { timeoutMs: cfg.timeoutMs },
    userAgent: cfg.userAgent,
  })
}
