/**
 * The refkit_search tool: parameter and output schemas in dsh's DSL, the
 * execution that maps core's SearchResult onto the canonical SearchOutcome,
 * and the defineTool wrapper. All ranking and rights logic stays in
 * @refkit/core; this file only shapes inputs and outputs.
 * @module @refkit/dsh-plugin/tools/search
 */

import { defineTool, type GenericCallView, type GenericResultView, type InferArgs, type InferValue, type ParameterSchemaSpec, type ToolDefinition, type ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import { INTENTS, type Attribution, type Intent, type ProviderError, type ProviderSearchStatus, type Reference, type RefkitClient, type SearchInput, type Verdict } from '@refkit/core'
import { KEYLESS_IDS, PROVIDER_IDS, PROVIDER_REGISTRY, type ResolvedConfig } from '../config.ts'
import { DECISIONS, MODALITIES, SOURCE_STATUSES, defined, narrowOutcome, trunc, type Json, type RefTile, type SearchOutcome, type SourceStatus } from '../core/outcome.ts'
import { cardMeta, renderSearch } from '../render.ts'
import { CONTROLS_PARAMETER } from './controls.ts'

export const SEARCH_TOOL_NAME = 'refkit_search'
const MAX_LIMIT = 30
const ERROR_CHARS = 200
const WARNING_CHARS = ERROR_CHARS + 60

export interface SearchDeps {
  client(): RefkitClient
  config(): ResolvedConfig
}

export const SEARCH_PARAMETERS = {
  query: { type: 'string', required: true, description: 'What to search for, e.g. "cyberpunk alley at night". Translate to concise English keywords unless the source is language-specific.' },
  modalities: { type: 'array', items: { type: 'string', enum: MODALITIES }, description: 'Default ["image"]. text = passages/poems/books; audio = sounds/music; video = clips.' },
  intent: { type: 'string', enum: INTENTS, description: 'Annotate every result with a use-verdict (allowed / allowed-with-attribution / denied / needs-review) and a credit line for this intended use. No filtering.' },
  gateFor: { type: 'string', enum: INTENTS, description: 'Return only results whose license allows this intended use (also annotates). Prefer over intent when the user needs usable material only.' },
  sources: { type: 'array', items: { type: 'string' }, description: 'Restrict to provider ids (see the tool description). Omit to search every enabled source.' },
  limit: { type: 'integer', description: 'Results to return, 1..30. Default from configuration (12).' },
  cursor: { type: 'string', description: 'Opaque continuation from a previous result\'s nextCursor.' },
  controls: CONTROLS_PARAMETER,
  minRelevance: { type: 'number', description: 'Drop results the ranker scored below this (0..1) after reranking. A result matching no query term lands around 0.3 under the default weights, so 0.5 keeps only real matches. Off by default.' },
  explain: { type: 'boolean', description: 'Include core\'s full search metadata (per-source status, applied/ignored controls, gate and threshold counts) under meta.' },
} as const satisfies ParameterSchemaSpec

export type SearchArgs = InferArgs<typeof SEARCH_PARAMETERS>

const tileSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true },
    modality: { type: 'string', enum: MODALITIES, required: true },
    provider: { type: 'string', required: true },
    canonicalUrl: { type: 'string', required: true },
    license: { type: 'string', required: true },
    title: { type: 'string' },
    kind: { type: 'string' },
    licenseVersion: { type: 'string' },
    author: { type: 'string' },
    thumbnail: { type: 'string' },
    preview: { type: 'string' },
    width: { type: 'number' },
    height: { type: 'number' },
    description: { type: 'string' },
    excerpt: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    useVerdict: {
      type: 'object',
      additionalProperties: false,
      properties: {
        decision: { type: 'string', enum: DECISIONS, required: true },
        reason: { type: 'string', required: true },
        confidence: { type: 'string', enum: ['high', 'low'], required: true },
      },
    },
    attribution: { type: 'string' },
  },
} as const satisfies ValueSchemaSpec

export const SEARCH_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: { type: 'string', required: true },
    modalities: { type: 'array', items: { type: 'string', enum: MODALITIES }, required: true },
    intent: { type: 'string' },
    count: { type: 'integer', required: true },
    references: { type: 'array', items: tileSchema, required: true },
    nextCursor: { type: 'string' },
    sources: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          status: { type: 'string', enum: SOURCE_STATUSES, required: true },
          reason: { type: 'string' },
          returned: { type: 'integer' },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' }, required: true },
    note: { type: 'string' },
    meta: { type: 'json' },
  },
} as const satisfies ValueSchemaSpec

// The DSL-inferred output and the hand-written SearchOutcome must agree in both directions.
type InferredOutcome = InferValue<typeof SEARCH_OUTPUT>
const _outcomeCheckA: InferredOutcome = {} as SearchOutcome
const _outcomeCheckB: SearchOutcome = {} as InferredOutcome
void _outcomeCheckA
void _outcomeCheckB

const SOURCE_LIST = PROVIDER_REGISTRY
  .map(e => `${e.id} (${e.modalities.join('/')}${e.key ? ', needs key' : ''})`)
  .join(', ')

const DESCRIPTION =
  'Search license-normalized creative references (images, video, audio, text passages) across up to 23 sources and return them ranked, deduplicated, and each tagged with its license and canonical source link. '
  + 'Use for reference pictures, moodboards, textures/HDRIs, public-domain artworks, sound effects, music, poems and book passages — not for web pages. '
  + 'Pass `intent` when the user has said how the material will be used so every result carries a use-verdict and a ready credit line; pass `gateFor` to return only usable results. '
  + 'Results are references, not rights clearance. '
  + `Sources: ${SOURCE_LIST}. Keyed sources are inactive until their key is set under Settings -> Plugins -> refkit.`

function message(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return trunc(raw, ERROR_CHARS)
}

/** Project one core Reference (plus optional assessment) onto a tile with no undefined keys. */
export function toTile(ref: Reference, assessment?: { verdict: Verdict; attribution: Attribution }): RefTile {
  const tile = defined({
    id: ref.id,
    modality: ref.modality,
    provider: ref.source.providerId,
    canonicalUrl: ref.canonicalUrl,
    license: ref.rights.license,
    title: ref.title,
    kind: ref.kind,
    licenseVersion: ref.rights.licenseVersion,
    author: ref.rights.author,
    thumbnail: ref.thumbnail?.url,
    preview: ref.preview?.url,
    width: ref.visual?.width,
    height: ref.visual?.height,
    description: ref.description,
    excerpt: ref.text?.excerpt,
    tags: ref.tags && ref.tags.length > 0 ? ref.tags : undefined,
  }) as RefTile
  if (assessment) {
    const { verdict, attribution } = assessment
    tile.useVerdict = { decision: verdict.decision, reason: verdict.reasons.join('; '), confidence: verdict.confidence }
    // A denied use gets no credit line: crediting cannot make it usable.
    if (verdict.decision !== 'denied' && attribution.required && attribution.text) tile.attribution = attribution.text
  }
  return tile
}

/** Compact projection of core's per-provider status. */
export function toSourceStatus(status: ProviderSearchStatus): SourceStatus {
  return defined({
    id: status.providerId,
    status: status.status,
    reason: status.reason,
    returned: status.returned,
  }) as SourceStatus
}

function sourcesError(err: unknown, requested: readonly string[], enabled: readonly string[]): Error {
  const unconfigured = requested.filter(id => PROVIDER_IDS.includes(id) && !enabled.includes(id) && !KEYLESS_IDS.includes(id))
  const hint = unconfigured.length > 0
    ? ` ${unconfigured.join(', ')}: configure its key under Settings -> Plugins -> refkit.`
    : ''
  return new Error(`${message(err)} Enabled source ids: ${enabled.join(', ') || '(none)'}.${hint}`)
}

/** Execute one search against the current client and shape the canonical value. */
export async function runSearch(args: SearchArgs, deps: SearchDeps, signal?: AbortSignal): Promise<SearchOutcome> {
  const query = args.query.trim()
  if (query.length === 0) throw new Error('refkit_search: query must be a non-empty string')
  const cfg = deps.config()
  const client = deps.client()
  const modalities = args.modalities && args.modalities.length > 0 ? [...args.modalities] : (['image'] as SearchOutcome['modalities'])
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(args.limit ?? cfg.limit)))
  const intent: Intent | undefined = args.intent ?? args.gateFor

  // Core's AggregateError carries raw errors without provider ids; the
  // onProviderError callback is the only place the id and the error meet.
  // It also fires for per-item schema rejects, which precede a run's own
  // failure, so the last error per provider is the one that failed it.
  const failures = new Map<string, unknown>()
  const input: SearchInput = defined({
    query,
    modalities,
    sources: args.sources,
    controls: args.controls,
    limit,
    cursor: args.cursor,
    poolFactor: cfg.poolFactor,
    deadlineMs: cfg.deadlineMs,
    minRelevance: args.minRelevance,
    gateFor: args.gateFor,
    signal,
    onProviderError: (e: ProviderError) => { failures.set(e.providerId, e.error) },
  })

  let result
  try {
    result = await client.searchWithMeta(input)
  } catch (err) {
    if (err instanceof AggregateError) {
      const parts = failures.size > 0
        ? [...failures].map(([providerId, error]) => `${providerId}: ${message(error)}`)
        : err.errors.map((e: unknown, i: number) => `#${i + 1}: ${message(e)}`)
      throw new Error(`all ${err.errors.length} sources failed: ${parts.join('; ')}`)
    }
    if (args.sources && args.sources.length > 0) {
      throw sourcesError(err, args.sources, client.providers.map(p => p.id))
    }
    throw err
  }

  const references = result.references.map(ref =>
    intent
      ? toTile(ref, { verdict: client.evaluateUse(ref, intent), attribution: client.buildAttribution(ref) })
      : toTile(ref),
  )
  const outcome: SearchOutcome = {
    query,
    modalities,
    count: references.length,
    references,
    sources: result.meta.providers.map(toSourceStatus),
    // Core only counts failed sources in its warnings; name each one here.
    warnings: [
      ...result.meta.providers
        .filter(p => p.status === 'failed')
        .map(p => trunc(`${p.providerId}: ${message(p.error ?? 'unknown error')}`, WARNING_CHARS)),
      ...result.meta.warnings.map(w => trunc(w, WARNING_CHARS)),
    ],
  }
  if (intent) outcome.intent = intent
  if (result.meta.nextCursor) outcome.nextCursor = result.meta.nextCursor
  if (references.length === 0) outcome.note = 'No results; try broader terms, another modality, or fewer controls.'
  if (args.explain) outcome.meta = JSON.parse(JSON.stringify(result.meta)) as Json
  return outcome
}

function presentCall(args: SearchArgs): GenericCallView {
  return { card: 'generic', title: 'refkit search', kind: 'search', rawInput: defined({ query: args.query, modalities: args.modalities, intent: args.intent ?? args.gateFor }) }
}

/** The registered definition; `timeoutMs` is fixed from the configuration at registration time. */
export function createSearchTool(deps: SearchDeps): ToolDefinition {
  return defineTool({
    name: SEARCH_TOOL_NAME,
    description: DESCRIPTION,
    parameters: SEARCH_PARAMETERS,
    output: {
      schema: SEARCH_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: renderSearch(value) }],
      presentationMeta: (_args, value) => cardMeta(value) as unknown as Json,
    },
    timeoutMs: deps.config().deadlineMs + 5000,
    isConcurrencySafe: () => true,
    presentCall,
    presentResult: (_args, result): GenericResultView => {
      const meta = narrowOutcome(result.meta)
      return { card: 'generic', title: meta ? `${meta.count} refs for "${meta.query}"` : 'refkit search', content: result.content }
    },
    execute: (args, exec) => runSearch(args, deps, exec.signal),
  })
}
