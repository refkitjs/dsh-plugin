import { describe, expect, it } from 'vitest'
import { aspectRatio, formatDuration, licenseLabel, summarizeSources, verdictBadge } from '../src/client/badges.ts'

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

describe('formatDuration', () => {
  it('formats seconds as m:ss, and as h:mm:ss from an hour on', () => {
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(600)).toBe('10:00')
    expect(formatDuration(3599)).toBe('59:59')
    expect(formatDuration(3600)).toBe('1:00:00')
    expect(formatDuration(3725)).toBe('1:02:05')
  })
  it('rounds to the nearest second and shows a sub-second clip as 0:01, never 0:00', () => {
    expect(formatDuration(2.5)).toBe('0:03')
    expect(formatDuration(59.6)).toBe('1:00')
    expect(formatDuration(0.2)).toBe('0:01')
  })
  it('is undefined for a missing, non-finite or non-positive duration', () => {
    expect(formatDuration(undefined)).toBeUndefined()
    expect(formatDuration(0)).toBeUndefined()
    expect(formatDuration(-1)).toBeUndefined()
    expect(formatDuration(Number.NaN)).toBeUndefined()
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBeUndefined()
  })
})
