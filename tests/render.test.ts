import { describe, expect, it } from 'vitest'
import { cardMeta, renderSearch } from '../src/render.ts'
import type { SearchOutcome } from '../src/core/outcome.ts'

const base: SearchOutcome = {
  query: 'neon alley',
  modalities: ['image'],
  intent: 'commercial-product',
  count: 2,
  references: [
    { id: 'openverse:1', modality: 'image', source: 'openverse', canonicalUrl: 'https://o/1', license: 'CC-BY', licenseVersion: '4.0', title: 'Neon alley', useVerdict: { decision: 'allowed-with-attribution', reason: 'attribution required', confidence: 'high' }, attribution: '"Neon alley" by A (CC BY 4.0)', description: 'x'.repeat(300), tags: ['neon', 'alley'] },
    { id: 'gutendex:2', modality: 'text', source: 'gutendex', canonicalUrl: 'https://g/2', license: 'PD', excerpt: 'It was a bright cold day in April, and the clocks were striking thirteen. '.repeat(5), useVerdict: { decision: 'allowed', reason: '', confidence: 'high' } },
  ],
  nextCursor: 'abc',
  sources: [{ id: 'openverse', status: 'fulfilled', returned: 5 }, { id: 'met', status: 'failed', reason: undefined }, { id: 'nailbook', status: 'skipped', reason: 'declined' }],
  warnings: ['met: upstream 503'],
}

describe('renderSearch', () => {
  it('lists every reference with source, license, decision and url', () => {
    const text = renderSearch(base)
    const lines = text.split('\n')
    expect(lines[0]).toBe('2 reference(s) for "neon alley" — intent: commercial-product')
    expect(lines[1]).toBe('1. Neon alley — openverse — CC-BY 4.0 — allowed-with-attribution — https://o/1')
    expect(lines[2]).toBe('   credit: "Neon alley" by A (CC BY 4.0)')
    expect(lines[3]).toBe('2. (untitled) — gutendex — PD — allowed — https://g/2')
    expect(lines[4].startsWith('   excerpt: It was a bright cold day')).toBe(true)
    expect(lines[4].length).toBeLessThanOrEqual('   excerpt: '.length + 160)
    expect(text).toContain('warning: met: upstream 503')
    expect(text).toContain('more: pass cursor "abc" to continue')
  })
  it('names the m:ss duration of audio and video references after their source', () => {
    const references: SearchOutcome['references'] = [
      { id: 'freesound:1', modality: 'audio', source: 'freesound', canonicalUrl: 'https://f/1', license: 'CC0-1.0', title: 'Rain', durationSec: 65.4 },
      { id: 'pexels-video:2', modality: 'video', source: 'pexels-video', canonicalUrl: 'https://p/2', license: 'Pexels', title: 'Surf', durationSec: 3725 },
      { id: 'jamendo:3', modality: 'audio', source: 'jamendo', canonicalUrl: 'https://j/3', license: 'CC-BY', title: 'Song' },
      { id: 'met:4', modality: 'image', source: 'met', canonicalUrl: 'https://m/4', license: 'PD', title: 'Vase', durationSec: 9 },
    ]
    const lines = renderSearch({ ...base, intent: undefined, count: 4, references, nextCursor: undefined, warnings: [] }).split('\n')
    expect(lines.slice(1, 5)).toEqual([
      '1. Rain — freesound — 1:05 — CC0-1.0 — https://f/1',
      '2. Surf — pexels-video — 1:02:05 — Pexels — https://p/2',
      '3. Song — jamendo — CC-BY — https://j/3',
      '4. Vase — met — PD — https://m/4',
    ])
  })
  it('collapses whitespace in titles and credit lines so each reference stays one line', () => {
    const tile = { ...base.references[0], title: 'Neon\n  alley ', attribution: '"Neon\nalley" by A\t(CC BY 4.0)\n' }
    const lines = renderSearch({ ...base, count: 1, references: [tile] }).split('\n')
    expect(lines[1]).toBe('1. Neon alley — openverse — CC-BY 4.0 — allowed-with-attribution — https://o/1')
    expect(lines[2]).toBe('   credit: "Neon alley" by A (CC BY 4.0)')
    expect(lines[3]).toBe('warning: met: upstream 503')
    expect(renderSearch({ ...base, count: 1, references: [{ ...tile, title: ' \n ' }] }).split('\n')[1]).toMatch(/^1\. \(untitled\) — /)
  })
  it('renders the empty note and omits the intent suffix when absent', () => {
    const text = renderSearch({ ...base, intent: undefined, count: 0, references: [], nextCursor: undefined, warnings: [], note: 'No results' })
    expect(text.split('\n')[0]).toBe('0 reference(s) for "neon alley"')
    expect(text).toContain('No results')
    expect(text).not.toContain('intent:')
    expect(text).not.toContain('more:')
  })
  it('ends with a meta line cut to 2000 code points only when the value carries meta', () => {
    const lines = renderSearch({ ...base, meta: { passes: 1, sources: [] } }).split('\n')
    expect(lines[lines.length - 1].startsWith('meta: {"passes":1')).toBe(true)
    expect(renderSearch(base).split('\n').some(l => l.startsWith('meta:'))).toBe(false)
    const long = renderSearch({ ...base, meta: { blob: '𝄞'.repeat(3000) } }).split('\n')
    const last = long[long.length - 1]
    expect(last.startsWith('meta: {"blob":"')).toBe(true)
    expect(Array.from(last).length).toBeLessThanOrEqual('meta: '.length + 2000)
    expect(last.endsWith('…')).toBe(true)
  })
})

describe('cardMeta', () => {
  it('drops meta and tags and cuts descriptions at 200 code points', () => {
    const meta = cardMeta({ ...base, meta: { passes: 1 } })
    expect('meta' in meta).toBe(false)
    expect(meta.references[0].tags).toBeUndefined()
    expect(Array.from(meta.references[0].description ?? '').length).toBe(200)
    expect(meta.references[1].excerpt).toBe(base.references[1].excerpt)
  })
  it('cuts excerpts at 600 code points and leaves the canonical value untouched', () => {
    const long = 'é𝄞'.repeat(500)
    const value: SearchOutcome = { ...base, references: [base.references[0], { ...base.references[1], excerpt: long }] }
    const meta = cardMeta(value)
    expect(Array.from(meta.references[1].excerpt ?? '').length).toBe(600)
    expect(meta.references[1].excerpt?.endsWith('…')).toBe(true)
    expect(value.references[1].excerpt).toBe(long)
    expect(Array.from(value.references[1].excerpt ?? '').length).toBe(1000)
  })
  it('contains no undefined-valued properties', () => {
    const meta = cardMeta(base)
    const walk = (v: unknown, path: string): void => {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`))
      else if (typeof v === 'object' && v !== null) {
        for (const [k, x] of Object.entries(v)) {
          expect(x, `${path}.${k}`).not.toBeUndefined()
          walk(x, `${path}.${k}`)
        }
      }
    }
    walk(meta, 'meta')
  })
})
