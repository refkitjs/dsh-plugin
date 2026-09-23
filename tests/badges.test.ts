import { describe, expect, it } from 'vitest'
import { aspectRatio, licenseLabel, summarizeSources, verdictBadge } from '../src/client/badges.ts'

describe('verdictBadge', () => {
  it('maps every decision to a class and a label', () => {
    expect(verdictBadge('allowed')).toEqual({ className: 'rk-badge rk-badge-allowed', label: 'Allowed' })
    expect(verdictBadge('allowed-with-attribution')).toEqual({ className: 'rk-badge rk-badge-attribution', label: 'Credit required' })
    expect(verdictBadge('denied')).toEqual({ className: 'rk-badge rk-badge-denied', label: 'Not allowed' })
    expect(verdictBadge('needs-review')).toEqual({ className: 'rk-badge rk-badge-review', label: 'Needs review' })
  })
})

describe('licenseLabel', () => {
  it('appends the version and shortens long ids', () => {
    expect(licenseLabel({ license: 'CC-BY', licenseVersion: '4.0' })).toBe('CC-BY 4.0')
    expect(licenseLabel({ license: 'PD' })).toBe('PD')
    expect(licenseLabel({ license: 'acme-stock-standard-extended-license' })).toBe('acme-stock-standard-…')
  })
})

describe('summarizeSources', () => {
  it('buckets by status preserving order', () => {
    const s = summarizeSources([
      { id: 'a', status: 'fulfilled', returned: 3 }, { id: 'b', status: 'failed' }, { id: 'c', status: 'skipped', reason: 'declined' }, { id: 'd', status: 'fulfilled', returned: 0 },
    ])
    expect(s.fulfilled.map(x => x.id)).toEqual(['a', 'd'])
    expect(s.failed.map(x => x.id)).toEqual(['b'])
    expect(s.skipped.map(x => x.id)).toEqual(['c'])
  })
})

describe('aspectRatio', () => {
  it('uses width/height when known and 4/3 otherwise', () => {
    expect(aspectRatio({ width: 1600, height: 900 })).toBe('1600 / 900')
    expect(aspectRatio({})).toBe('4 / 3')
    expect(aspectRatio({ width: 0, height: 10 })).toBe('4 / 3')
  })
})
