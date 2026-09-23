import { describe, expect, it } from 'vitest'
import { COPY } from '../src/client/copy.ts'

describe('COPY', () => {
  it('pluralises the reference count and quotes the query', () => {
    expect(COPY.refsFor(1, 'x')).toBe('1 reference for “x”')
    expect(COPY.refsFor(2, 'x')).toBe('2 references for “x”')
  })

  it('pluralises failed sources and counts skipped ones', () => {
    expect(COPY.failed(1)).toBe('1 source failed')
    expect(COPY.failed(3)).toBe('3 sources failed')
    expect(COPY.skipped(2)).toBe('2 skipped')
  })

  it('labels the intent', () => {
    expect(COPY.intent('commercial-product')).toBe('intent: commercial-product')
  })
})
