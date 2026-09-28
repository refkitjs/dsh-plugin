import { describe, expect, it, vi } from 'vitest'
import { Config, KEY_ENV, KEY_FIELDS, PROVIDER_IDS } from '../src/config.ts'
import {
  KEY_ENV_HINT, KEY_LABELS, NUMBER_BOUNDS, SOURCE_IDS,
  configuredKeys, secretSpec, settingsBooleanField, settingsBoundedNumberField, settingsSourcesField, summaryText,
} from '../src/client/settings-model.ts'

describe('settingsBooleanField', () => {
  const spec = settingsBooleanField('rerank')

  it('names its field', () => {
    expect(spec.field).toBe('rerank')
  })

  it('formats a stored boolean as on/off and anything else as blank', () => {
    expect(spec.format(true)).toBe('on')
    expect(spec.format(false)).toBe('off')
    expect(spec.format(undefined)).toBe('')
  })

  it('parses on/off into a set, blank into a clear, and refuses anything else', () => {
    expect(spec.parse('on')).toEqual({ kind: 'set', value: true })
    expect(spec.parse('off')).toEqual({ kind: 'set', value: false })
    expect(spec.parse('')).toEqual({ kind: 'clear' })
    expect(spec.parse('maybe')).toBeUndefined()
  })
})

describe('settingsSourcesField', () => {
  const spec = settingsSourcesField('sources', SOURCE_IDS)

  it('formats a stored id list as comma-separated text', () => {
    expect(spec.format(['met', 'artic'])).toBe('met, artic')
    expect(spec.format([])).toBe('')
    expect(spec.format(undefined)).toBe('')
  })

  it('parses ids, tolerating stray spaces and empty items', () => {
    expect(spec.parse('met, artic')).toEqual({ kind: 'set', value: ['met', 'artic'] })
    expect(spec.parse(' met ,, artic ')).toEqual({ kind: 'set', value: ['met', 'artic'] })
  })

  it('clears on a blank draft', () => {
    expect(spec.parse('')).toEqual({ kind: 'clear' })
    expect(spec.parse(' , ')).toEqual({ kind: 'clear' })
  })

  it('refuses an unknown id, which blocks the save', () => {
    expect(spec.parse('met, unsplsh')).toBeUndefined()
  })

  it('collapses duplicates', () => {
    expect(spec.parse('met, met')).toEqual({ kind: 'set', value: ['met'] })
  })
})

describe('settingsBoundedNumberField', () => {
  const spec = settingsBoundedNumberField('limit', { min: 1, max: 30 })

  it('keeps the shared number formatting', () => {
    expect(spec.field).toBe('limit')
    expect(spec.format(12)).toBe('12')
    expect(spec.format(undefined)).toBe('')
  })

  it('accepts whole numbers inside the bounds and clears on blank', () => {
    expect(spec.parse('1')).toEqual({ kind: 'set', value: 1 })
    expect(spec.parse(' 30 ')).toEqual({ kind: 'set', value: 30 })
    expect(spec.parse('')).toEqual({ kind: 'clear' })
  })

  it('refuses fractions, out-of-range values and non-numbers', () => {
    expect(spec.parse('0')).toBeUndefined()
    expect(spec.parse('31')).toBeUndefined()
    expect(spec.parse('2.5')).toBeUndefined()
    expect(spec.parse('twelve')).toBeUndefined()
  })
})

describe('secretSpec', () => {
  it('writes the staged key as one set op on its own path and resolves to the write result', async () => {
    const write = vi.fn(async () => true)
    const spec = secretSpec('pexelsApiKey', write)
    expect(spec.field).toBe('pexelsApiKey')
    await expect(spec.write('k')).resolves.toBe(true)
    expect(write).toHaveBeenCalledWith([{ op: 'set', path: ['pexelsApiKey'], value: 'k' }])
  })

  it('passes a refusal through', async () => {
    const spec = secretSpec('braveToken', async () => false)
    await expect(spec.write('k')).resolves.toBe(false)
  })
})

describe('configuredKeys', () => {
  const namespaces = [
    { ns: 'other', secrets: [{ path: ['pexelsApiKey'], set: true }] },
    { ns: 'refkit', secrets: [
      { path: ['braveToken'], set: true },
      { path: ['pexelsApiKey'], set: true },
      { path: ['unsplashAccessKey'], set: false },
    ] },
  ]

  it('lists the set keys of the namespace, in field order', () => {
    expect(configuredKeys(namespaces, 'refkit', Object.keys(KEY_LABELS))).toEqual(['pexelsApiKey', 'braveToken'])
  })

  it('is empty before the mirror answers or when the namespace is absent', () => {
    expect(configuredKeys(undefined, 'refkit', Object.keys(KEY_LABELS))).toEqual([])
    expect(configuredKeys([{ ns: 'other', secrets: [] }], 'refkit', Object.keys(KEY_LABELS))).toEqual([])
  })
})

describe('summaryText', () => {
  it('counts configured keys', () => {
    expect(summaryText(3, 10)).toBe('License-aware reference search · 3 of 10 keys set')
  })
})

describe('static client tables mirror src/config.ts', () => {
  it('labels exactly the secret fields', () => {
    expect(Object.keys(KEY_LABELS).sort()).toEqual([...KEY_FIELDS].sort())
  })

  it('names the same environment fallbacks', () => {
    expect(KEY_ENV_HINT).toEqual(KEY_ENV)
  })

  it('lists exactly the provider ids', () => {
    expect([...SOURCE_IDS].sort()).toEqual([...PROVIDER_IDS].sort())
  })

  it('uses the schema bounds and defaults for the number fields', () => {
    for (const [field, bounds] of Object.entries(NUMBER_BOUNDS)) {
      const meta = (Config.dict as Record<string, { meta: { min?: number; max?: number; default?: unknown } }>)[field]!.meta
      expect({ field, ...bounds }).toEqual({ field, min: meta.min, max: meta.max, default: meta.default })
    }
    expect(Object.keys(NUMBER_BOUNDS).sort()).toEqual(['deadlineMs', 'limit', 'poolFactor', 'timeoutMs'])
  })
})
