import { describe, expect, it } from 'vitest'
import { SEARCH_CONTROL_KEYS, buildSearchControlsSchema, type SearchControls } from '@refkit/core'
import { assertSupportedJsonSchema, valueSchemaSpecToJsonSchema, type InferValue } from '@deepseek-ai/dsh-tools'
import { CONTROLS_PARAMETER, flattenControlKeys } from '../src/tools/controls.ts'

describe('CONTROLS_PARAMETER mirrors core SearchControls', () => {
  it('flattened keys equal SEARCH_CONTROL_KEYS', () => {
    expect(flattenControlKeys(CONTROLS_PARAMETER).sort()).toEqual([...SEARCH_CONTROL_KEYS].sort())
  })
  it('top-level keys equal the core zod schema shape', () => {
    // buildSearchControlsSchema() is declared to return the widened `z.ZodType<SearchControls>`
    // (no `.shape`), even though it builds a `z.object(...)` at runtime — see task-3-report.md.
    const schema = buildSearchControlsSchema() as unknown as { shape: Record<string, unknown> }
    const shape = Object.keys(schema.shape).sort()
    expect(Object.keys(CONTROLS_PARAMETER.properties ?? {}).sort()).toEqual(shape)
  })
  it('compiles to a JSON schema within the dsh enforced subset', () => {
    expect(() => assertSupportedJsonSchema(valueSchemaSpecToJsonSchema(CONTROLS_PARAMETER))).not.toThrow()
  })
  it('infers a value assignable to SearchControls in both directions (compile-time)', () => {
    type Inferred = InferValue<typeof CONTROLS_PARAMETER>
    const a: SearchControls = {} as Inferred
    const b: Inferred = {} as SearchControls
    expect([a, b]).toHaveLength(2)
  })
})
