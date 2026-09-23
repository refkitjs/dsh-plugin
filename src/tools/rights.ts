/**
 * The refkit_rights tool: a stateless use-gate check for one license id (or
 * a facts row) against an intended use, returning core's verdict and the
 * credit line. Lets the model re-check a result for a new intent without
 * searching again.
 * @module @refkit/dsh-plugin/tools/rights
 */

import { defineTool, type InferArgs, type InferValue, type ParameterSchemaSpec, type ToolDefinition, type ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import { INTENTS, buildAttribution, ccVersionFor, evaluateUse, licenseFactsSchema, type LicenseFacts, type RightsRecord } from '@refkit/core'
import { DECISIONS } from '../core/outcome.ts'

export const RIGHTS_TOOL_NAME = 'refkit_rights'

const TRI = { oneOf: [{ type: 'boolean' }, { type: 'string', const: 'unknown' }] } as const

export const RIGHTS_PARAMETERS = {
  license: { type: 'string', required: true, description: 'License id as returned by refkit_search (e.g. CC-BY, CC0-1.0, PD, unsplash). An unknown id without `facts` resolves to needs-review.' },
  intent: { type: 'string', enum: INTENTS, required: true, description: 'The intended use to evaluate.' },
  canonicalUrl: { type: 'string', required: true, description: 'Canonical source link, for the credit line and audit.' },
  licenseVersion: { type: 'string', description: 'CC version such as "4.0"; ignored for non-CC ids.' },
  author: { type: 'string' },
  title: { type: 'string' },
  editorialOnly: { type: 'boolean', description: 'Source marked editorial-only.' },
  jurisdiction: { type: 'string', description: 'Source-declared jurisdiction of a public-domain status.' },
  userJurisdiction: { type: 'string', description: 'Caller\'s jurisdiction; a mismatch defaults to needs-review.' },
  facts: {
    type: 'object',
    additionalProperties: false,
    description: 'Override the license table with source-declared facts (all five fields required when present).',
    properties: {
      commercialUse: TRI,
      derivatives: TRI,
      redistribution: TRI,
      attributionRequired: { type: 'boolean' },
      shareAlike: { type: 'boolean' },
    },
  },
} as const satisfies ParameterSchemaSpec

export type RightsArgs = InferArgs<typeof RIGHTS_PARAMETERS>

export const RIGHTS_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    decision: { type: 'string', enum: DECISIONS, required: true },
    reasons: { type: 'array', items: { type: 'string' }, required: true },
    confidence: { type: 'string', enum: ['high', 'low'], required: true },
    attribution: {
      type: 'object',
      additionalProperties: false,
      required: true,
      properties: {
        required: { type: 'boolean', required: true },
        text: { type: 'string' },
        html: { type: 'string' },
      },
    },
    disclaimer: { type: 'string', required: true },
  },
} as const satisfies ValueSchemaSpec

export type RightsOutcome = InferValue<typeof RIGHTS_OUTPUT>

/** Evaluate one license for one intent; pure and synchronous. */
export function runRights(args: RightsArgs): RightsOutcome {
  let facts: LicenseFacts | undefined
  if (args.facts !== undefined) {
    const parsed = licenseFactsSchema.safeParse(args.facts)
    if (!parsed.success) throw new Error(`refkit_rights: invalid facts — ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
    facts = parsed.data
  }
  const licenseVersion = ccVersionFor(args.license, args.licenseVersion)
  const rights: RightsRecord = {
    license: args.license,
    rehostPolicy: 'cache-allowed',
    raw: { sourceTerms: '', sourceUrl: args.canonicalUrl },
    ...(facts ? { facts } : {}),
    ...(licenseVersion ? { licenseVersion } : {}),
    ...(args.author ? { author: args.author } : {}),
    ...(args.jurisdiction ? { jurisdiction: args.jurisdiction } : {}),
    ...(args.editorialOnly !== undefined ? { editorialOnly: args.editorialOnly } : {}),
  }
  const verdict = evaluateUse(rights, args.intent, args.userJurisdiction ? { userJurisdiction: args.userJurisdiction } : undefined)
  const attribution = buildAttribution({
    license: args.license,
    canonicalUrl: args.canonicalUrl,
    ...(facts ? { facts } : {}),
    ...(licenseVersion ? { licenseVersion } : {}),
    ...(args.author ? { author: args.author } : {}),
    ...(args.title ? { title: args.title } : {}),
  })
  return {
    decision: verdict.decision,
    reasons: verdict.reasons,
    confidence: verdict.confidence,
    attribution: {
      required: attribution.required,
      // A denied use gets no credit line: crediting cannot make it usable (same rule as toTile in tools/search.ts).
      ...(verdict.decision !== 'denied' && attribution.text ? { text: attribution.text } : {}),
      ...(verdict.decision !== 'denied' && attribution.html ? { html: attribution.html } : {}),
    },
    disclaimer: verdict.disclaimer,
  }
}

/** Model-facing text: verdict line, credit line when required, disclaimer. */
export function renderRights(value: RightsOutcome): string {
  const lines = [`${value.decision} (${value.confidence}): ${value.reasons.join('; ') || 'license facts allow this use'}`]
  if (value.attribution.required && value.attribution.text) lines.push(`credit: ${value.attribution.text}`)
  lines.push(value.disclaimer)
  return lines.join('\n')
}

export function createRightsTool(): ToolDefinition {
  return defineTool({
    name: RIGHTS_TOOL_NAME,
    description:
      'Stateless license check: given a license id (or source-declared facts) and an intended use, return a conservative verdict '
      + '(allowed / allowed-with-attribution / denied / needs-review) with reasons, confidence and a ready credit line. '
      + 'Use it to re-check one refkit_search result for a different intent without searching again. Not legal advice.',
    parameters: RIGHTS_PARAMETERS,
    output: {
      schema: RIGHTS_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: renderRights(value) }],
    },
    timeoutMs: 5000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({ card: 'generic', title: 'refkit rights check', kind: 'other', rawInput: { license: args.license, intent: args.intent } }),
    presentResult: (_args, result) => ({ card: 'generic', content: result.content }),
    execute: async (args) => runRights(args),
  })
}
