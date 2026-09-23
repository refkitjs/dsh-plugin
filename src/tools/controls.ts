/**
 * The dsh value-schema mirror of @refkit/core's SearchControls. Core owns the
 * registry (CONTROL_PATHS); this literal exists because dsh tools declare
 * parameters in their own DSL. tests/controls.test.ts pins the mirror to
 * SEARCH_CONTROL_KEYS so the two cannot drift.
 * @module @refkit/dsh-plugin/tools/controls
 */

import type { ObjectValueSchemaSpec } from '@deepseek-ai/dsh-tools'

export const CONTROLS_PARAMETER = {
  type: 'object',
  additionalProperties: false,
  description: 'Provider-neutral search controls; each source applies the ones it supports and the rest are reported as ignored.',
  properties: {
    orientation: { type: 'string', enum: ['landscape', 'portrait', 'square'] },
    color: { type: 'string', description: 'dominant colour name or hex' },
    language: { type: 'string', description: 'BCP-47 tag, e.g. en-US' },
    sort: { type: 'string', enum: ['relevance', 'latest', 'popular', 'interesting'] },
    safety: { type: 'string', enum: ['strict', 'moderate', 'off'] },
    license: {
      type: 'object',
      additionalProperties: false,
      properties: {
        commercial: { type: 'boolean', description: 'only licenses allowing commercial use' },
        modification: { type: 'boolean', description: 'only licenses allowing derivatives' },
        allowUnknown: { type: 'boolean' },
      },
    },
    media: {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { type: 'string', description: 'photo, illustration, vector, icon, artwork, texture, hdri, 3d-model, film, animation, ...' },
        size: { type: 'string', enum: ['small', 'medium', 'large'] },
        minWidth: { type: 'integer' },
        minHeight: { type: 'integer' },
        duration: { type: 'string', enum: ['short', 'medium', 'long'] },
      },
    },
    creator: {
      type: 'object',
      additionalProperties: false,
      properties: { id: { type: 'string' }, name: { type: 'string' } },
    },
    text: {
      type: 'object',
      additionalProperties: false,
      properties: { copyright: { type: 'string', enum: ['public-domain', 'copyrighted', 'any'] } },
    },
    page: { type: 'integer', description: 'provider-local page (1-based)' },
  },
} as const satisfies ObjectValueSchemaSpec

/** `group.field` for nested object properties, bare name for scalars. */
export function flattenControlKeys(spec: ObjectValueSchemaSpec): string[] {
  const out: string[] = []
  for (const [name, node] of Object.entries(spec.properties ?? {})) {
    if ('type' in node && node.type === 'object') {
      for (const field of Object.keys(node.properties ?? {})) out.push(`${name}.${field}`)
    } else {
      out.push(name)
    }
  }
  return out
}
