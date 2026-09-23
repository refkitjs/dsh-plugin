import { describe, expect, it } from 'vitest'
import { cardMeta, renderSearch } from '../src/render.ts'
import type { SearchOutcome } from '../src/core/outcome.ts'

const base: SearchOutcome = {
  query: 'neon alley',
  modalities: ['image'],
  intent: 'commercial-product',
  count: 2,
  references: [
    { id: 'openverse:1', modality: 'image', provider: 'openverse', canonicalUrl: 'https://o/1', license: 'CC-BY', licenseVersion: '4.0', title: 'Neon alley', useVerdict: { decision: 'allowed-with-attribution', reason: 'attribution required', confidence: 'high' }, attribution: '"Neon alley" by A (CC BY 4.0)', description: 'x'.repeat(300), tags: ['neon', 'alley'] },
    { id: 'gutendex:2', modality: 'text', provider: 'gutendex', canonicalUrl: 'https://g/2', license: 'PD', excerpt: 'It was a bright cold day in April, and the clocks were striking thirteen. '.repeat(5), useVerdict: { decision: 'allowed', reason: '', confidence: 'high' } },
  ],
  nextCursor: 'abc',
  sources: [{ id: 'openverse', status: 'fulfilled', returned: 5 }, { id: 'met', status: 'failed', reason: undefined }, { id: 'nailbook', status: 'skipped', reason: 'declined' }],
  warnings: ['met: upstream 503'],
}

describe('renderSearch', () => {
  it('lists every reference with provider, license, decision and url', () => {
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
  it('renders the empty note and omits the intent suffix when absent', () => {
    const text = renderSearch({ ...base, intent: undefined, count: 0, references: [], nextCursor: undefined, warnings: [], note: 'No results' })
    expect(text.split('\n')[0]).toBe('0 reference(s) for "neon alley"')
    expect(text).toContain('No results')
    expect(text).not.toContain('intent:')
    expect(text).not.toContain('more:')
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
