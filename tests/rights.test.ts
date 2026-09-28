import { describe, expect, it } from 'vitest'
import { assertSupportedJsonSchema, parameterSchemaSpecToJsonSchema, valueSchemaSpecToJsonSchema } from '@deepseek-ai/dsh-tools'
import { RIGHTS_OUTPUT, RIGHTS_PARAMETERS, RIGHTS_TOOL_NAME, createRightsTool, renderRights, runRights } from '../src/tools/rights.ts'

const url = 'https://example.org/work/1'

describe('refkit_rights', () => {
  it('schemas compile and defineTool accepts the definition', () => {
    expect(() => assertSupportedJsonSchema(parameterSchemaSpecToJsonSchema(RIGHTS_PARAMETERS))).not.toThrow()
    expect(() => assertSupportedJsonSchema(valueSchemaSpecToJsonSchema(RIGHTS_OUTPUT))).not.toThrow()
    expect(createRightsTool().name).toBe(RIGHTS_TOOL_NAME)
  })
  it('a known permissive license with attribution', () => {
    const out = runRights({ license: 'CC-BY', licenseVersion: '4.0', author: 'Ada', title: 'Lion', canonicalUrl: url, intent: 'commercial-product' })
    expect(out.decision).toBe('allowed-with-attribution')
    expect(out.attribution.required).toBe(true)
    expect(out.attribution.text).toContain('Ada')
    expect(out.attribution.text).toContain('4.0')
    expect(out.disclaimer.length).toBeGreaterThan(10)
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
  })
  it('a non-commercial license is denied for commercial use and needs no credit line', () => {
    const out = runRights({ license: 'CC-BY-NC', canonicalUrl: url, intent: 'commercial-product' })
    expect(out.decision).toBe('denied')
    expect(out.attribution.required).toBe(true)
    expect(out.attribution.text).toBeUndefined()
  })
  it('an unknown id without facts is needs-review (strict deny by construction)', () => {
    const out = runRights({ license: 'acme-stock-standard', canonicalUrl: url, intent: 'internal-moodboard' })
    expect(out.decision).toBe('needs-review')
  })
  it('an unknown id with facts is judged on the facts', () => {
    const out = runRights({
      license: 'acme-stock-standard',
      canonicalUrl: url,
      intent: 'commercial-product',
      facts: { commercialUse: true, derivatives: true, redistribution: false, attributionRequired: false, shareAlike: false },
    })
    expect(out.decision).toBe('allowed')
    expect(out.attribution.required).toBe(false)
  })
  it('rejects incomplete facts with core\'s schema message', () => {
    expect(() => runRights({ license: 'x', canonicalUrl: url, intent: 'redistribution', facts: { commercialUse: true } as never })).toThrow(/facts/)
  })
  it('licenseVersion is dropped for non-CC ids and kept for CC families', () => {
    expect(runRights({ license: 'PD', licenseVersion: '4.0', canonicalUrl: url, intent: 'redistribution' }).attribution.text ?? '').not.toContain('4.0')
    expect(runRights({ license: 'CC-BY-SA', licenseVersion: '3.0', author: 'B', canonicalUrl: url, intent: 'redistribution' }).attribution.text).toContain('3.0')
  })
  it('renders decision, reasons, credit and disclaimer', () => {
    const text = renderRights(runRights({ license: 'CC-BY', author: 'Ada', canonicalUrl: url, intent: 'commercial-product' }))
    expect(text.split('\n')[0]).toMatch(/^allowed-with-attribution \(high\): /)
    expect(text).toContain('credit: ')
    expect(text).toContain('not legal advice')
  })
})
