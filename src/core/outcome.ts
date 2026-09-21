/**
 * Canonical result vocabulary shared by the host half (tool output, render,
 * presentation metadata) and the browser half (the card). No runtime
 * dependencies: plain data plus soft parsers, so a malformed or
 * version-drifted payload degrades to text instead of crashing a render.
 * @module @refkit/dsh-plugin/core
 */

export const MODALITIES = ['image', 'video', 'audio', 'text'] as const
export type Modality = (typeof MODALITIES)[number]

export const DECISIONS = ['allowed', 'allowed-with-attribution', 'denied', 'needs-review'] as const
export type Decision = (typeof DECISIONS)[number]

export const SOURCE_STATUSES = ['fulfilled', 'failed', 'skipped'] as const
export type SourceStatusKind = (typeof SOURCE_STATUSES)[number]

/** Lossless JSON. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export interface VerdictSummary {
  decision: Decision
  reason: string
  confidence: 'high' | 'low'
}

/** One reference as the tool returns it and the card renders it. */
export interface RefTile {
  id: string
  modality: Modality
  provider: string
  canonicalUrl: string
  license: string
  title?: string
  kind?: string
  licenseVersion?: string
  author?: string
  thumbnail?: string
  preview?: string
  width?: number
  height?: number
  description?: string
  excerpt?: string
  tags?: string[]
  useVerdict?: VerdictSummary
  attribution?: string
}

export interface SourceStatus {
  id: string
  status: SourceStatusKind
  reason?: string
  returned?: number
}

/** The canonical value of one refkit_search call. */
export interface SearchOutcome {
  query: string
  modalities: Modality[]
  intent?: string
  count: number
  references: RefTile[]
  nextCursor?: string
  sources: SourceStatus[]
  warnings: string[]
  note?: string
  /** Core's full SearchMeta, only when the caller passed `explain`. */
  meta?: Json
}

/** What the card receives: the outcome minus `meta`, descriptions cut, tags dropped. */
export type CardOutcome = Omit<SearchOutcome, 'meta'>

const HTTP = /^https?:\/\//i

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** Cut `text` to `max` code points, appending an ellipsis when anything was removed. */
export function trunc(text: string, max: number): string {
  const points = Array.from(text)
  if (points.length <= max) return text
  return points.slice(0, Math.max(0, max - 1)).join('') + '…'
}

function narrowVerdict(v: unknown): VerdictSummary | undefined {
  if (typeof v !== 'object' || v === null) return undefined
  const r = v as Record<string, unknown>
  if (!DECISIONS.includes(r.decision as Decision)) return undefined
  if (r.confidence !== 'high' && r.confidence !== 'low') return undefined
  return { decision: r.decision as Decision, reason: str(r.reason) ?? '', confidence: r.confidence }
}

/** Soft-narrow one tile; null for anything unusable. Unknown keys are dropped. */
export function narrowTile(value: unknown): RefTile | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Record<string, unknown>
  const id = str(r.id)
  const provider = str(r.provider)
  const canonicalUrl = str(r.canonicalUrl)
  const license = str(r.license)
  if (id === undefined || provider === undefined || license === undefined) return null
  if (canonicalUrl === undefined || !HTTP.test(canonicalUrl)) return null
  if (!MODALITIES.includes(r.modality as Modality)) return null
  const tile: RefTile = { id, modality: r.modality as Modality, provider, canonicalUrl, license }
  for (const key of ['title', 'kind', 'licenseVersion', 'author', 'description', 'excerpt', 'attribution'] as const) {
    const s = str(r[key])
    if (s !== undefined) tile[key] = s
  }
  for (const key of ['thumbnail', 'preview'] as const) {
    const s = str(r[key])
    if (s !== undefined && HTTP.test(s)) tile[key] = s
  }
  for (const key of ['width', 'height'] as const) {
    const n = num(r[key])
    if (n !== undefined && n > 0) tile[key] = n
  }
  if (Array.isArray(r.tags)) {
    const tags = r.tags.filter((t): t is string => typeof t === 'string' && t.length > 0)
    if (tags.length > 0) tile.tags = tags
  }
  const verdict = narrowVerdict(r.useVerdict)
  if (verdict !== undefined) tile.useVerdict = verdict
  return tile
}

function narrowSource(v: unknown): SourceStatus | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  const id = str(r.id)
  if (id === undefined || !SOURCE_STATUSES.includes(r.status as SourceStatusKind)) return null
  const out: SourceStatus = { id, status: r.status as SourceStatusKind }
  const reason = str(r.reason)
  if (reason !== undefined) out.reason = reason
  const returned = num(r.returned)
  if (returned !== undefined) out.returned = returned
  return out
}

/** Soft-parse a canonical value or presentation metadata; null for the wrong shape. */
export function narrowOutcome(value: unknown): SearchOutcome | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Record<string, unknown>
  const query = typeof r.query === 'string' ? r.query : undefined
  if (query === undefined || typeof r.count !== 'number') return null
  if (!Array.isArray(r.modalities) || !Array.isArray(r.references) || !Array.isArray(r.sources)) return null
  if (!Array.isArray(r.warnings)) return null
  const modalities = r.modalities.filter((m): m is Modality => MODALITIES.includes(m as Modality))
  const references = r.references.map(narrowTile).filter((t): t is RefTile => t !== null)
  const sources = r.sources.map(narrowSource).filter((s): s is SourceStatus => s !== null)
  const warnings = r.warnings.filter((w): w is string => typeof w === 'string')
  const out: SearchOutcome = { query, modalities, count: r.count, references, sources, warnings }
  const intent = str(r.intent)
  if (intent !== undefined) out.intent = intent
  const nextCursor = str(r.nextCursor)
  if (nextCursor !== undefined) out.nextCursor = nextCursor
  const note = str(r.note)
  if (note !== undefined) out.note = note
  if (r.meta !== undefined) out.meta = r.meta as Json
  return out
}
