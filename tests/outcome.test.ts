import { describe, expect, it } from 'vitest'
import { narrowOutcome, narrowTile, trunc, type SearchOutcome } from '../src/core/outcome.ts'

const tile = {
  id: 'openverse:abc',
  modality: 'image',
  source: 'openverse',
  canonicalUrl: 'https://openverse.org/image/abc',
  license: 'CC-BY',
  title: 'Neon alley',
  thumbnail: 'https://cdn.example/abc_t.jpg',
  width: 1200,
  height: 800,
  useVerdict: { decision: 'allowed-with-attribution', reason: 'attribution required', confidence: 'high' },
  attribution: '"Neon alley" by X, CC-BY 4.0',
}

const outcome: SearchOutcome = {
  query: 'neon alley',
  modalities: ['image'],
  intent: 'commercial-product',
  count: 1,
  references: [tile as never],
  sources: [{ id: 'openverse', status: 'fulfilled', returned: 1 }],
  warnings: [],
}

describe('narrowTile', () => {
  it('accepts a complete tile and keeps only known optional fields', () => {
    const parsed = narrowTile({ ...tile, bogus: 1 })
    expect(parsed).toEqual(tile)
  })
  it('rejects a tile missing a required field or with a non-http url', () => {
    expect(narrowTile({ ...tile, canonicalUrl: undefined })).toBeNull()
    expect(narrowTile({ ...tile, canonicalUrl: 'javascript:alert(1)' })).toBeNull()
    expect(narrowTile({ ...tile, modality: 'hologram' })).toBeNull()
  })
  it('narrows a tile persisted by 0.2.0, which names its source `provider`', () => {
    const { source, ...rest } = tile
    expect(narrowTile({ ...rest, provider: source })).toEqual(tile)
  })
  it('prefers `source` when a tile carries both keys, and rejects one with neither', () => {
    expect(narrowTile({ ...tile, provider: 'stale' })).toEqual(tile)
    const { source: _source, ...sourceless } = tile
    expect(narrowTile(sourceless)).toBeNull()
    expect(narrowTile({ ...sourceless, provider: '' })).toBeNull()
  })
  it('keeps a positive finite durationSec and drops anything else', () => {
    expect(narrowTile({ ...tile, durationSec: 65.4 })?.durationSec).toBe(65.4)
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, '65', null]) {
      const parsed = narrowTile({ ...tile, durationSec: bad })
      expect(parsed, String(bad)).not.toBeNull()
      expect(parsed, String(bad)).not.toHaveProperty('durationSec')
    }
  })
  it('drops a malformed useVerdict instead of failing the tile', () => {
    const parsed = narrowTile({ ...tile, useVerdict: { decision: 'maybe' } })
    expect(parsed).not.toBeNull()
    expect(parsed?.useVerdict).toBeUndefined()
  })
})

describe('narrowOutcome', () => {
  it('round-trips a full outcome', () => {
    expect(narrowOutcome(outcome)).toEqual(outcome)
  })
  it('drops malformed tiles and keeps the rest', () => {
    const parsed = narrowOutcome({ ...outcome, references: [tile, { id: 'x' }] })
    expect(parsed?.references).toHaveLength(1)
  })
  it('returns null for the wrong shape', () => {
    expect(narrowOutcome(null)).toBeNull()
    expect(narrowOutcome({ query: 1 })).toBeNull()
    expect(narrowOutcome({ ...outcome, sources: 'nope' })).toBeNull()
  })
  it('accepts a card outcome (no meta) and an outcome carrying meta', () => {
    expect(narrowOutcome({ ...outcome, meta: { passes: 1 } })?.meta).toEqual({ passes: 1 })
  })
})

describe('trunc', () => {
  it('cuts by code point and appends an ellipsis', () => {
    expect(trunc('abcdef', 4)).toBe('abc…')
    expect(trunc('ab', 4)).toBe('ab')
    expect(trunc('😀😀😀', 2)).toBe('😀…')
  })
})
