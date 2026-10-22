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

  it('never says "provider" on the settings page (dsh uses the word for LLM providers)', () => {
    for (const [key, value] of Object.entries(COPY.settings)) {
      if (typeof value === 'string') expect(value, key).not.toMatch(/provider/i)
    }
    expect(COPY.settings.sourcesHint).toMatch(/source ids/)
    expect(COPY.settings.limitHint).toContain('polyhaven and polyhaven-hdri')
  })
})
