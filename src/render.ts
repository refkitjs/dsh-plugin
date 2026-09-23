/**
 * Model-facing text for refkit_search and the bounded presentation metadata
 * the web card reads. Pure functions of the canonical value.
 * @module @refkit/dsh-plugin/render
 */

import { defined, trunc, type CardOutcome, type RefTile, type SearchOutcome } from './core/outcome.ts'

const EXCERPT_CHARS = 160
const DESCRIPTION_CHARS = 200

/** Collapse whitespace runs (newlines included) so upstream text cannot break the line layout. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function licenseLabel(tile: RefTile): string {
  return tile.licenseVersion ? `${tile.license} ${tile.licenseVersion}` : tile.license
}

/** One numbered line per reference plus credit/excerpt sub-lines, warnings and the cursor hint. */
export function renderSearch(value: SearchOutcome): string {
  const lines: string[] = []
  lines.push(`${value.count} reference(s) for "${value.query}"${value.intent ? ` — intent: ${value.intent}` : ''}`)
  value.references.forEach((tile, i) => {
    const decision = tile.useVerdict ? ` — ${tile.useVerdict.decision}` : ''
    lines.push(`${i + 1}. ${oneLine(tile.title ?? '') || '(untitled)'} — ${tile.provider} — ${licenseLabel(tile)}${decision} — ${tile.canonicalUrl}`)
    const credit = oneLine(tile.attribution ?? '')
    if (credit) lines.push(`   credit: ${credit}`)
    if (tile.modality === 'text' && tile.excerpt) lines.push(`   excerpt: ${trunc(oneLine(tile.excerpt), EXCERPT_CHARS)}`)
  })
  if (value.note) lines.push(value.note)
  for (const warning of value.warnings) lines.push(`warning: ${warning}`)
  if (value.nextCursor) lines.push(`more: pass cursor "${value.nextCursor}" to continue`)
  return lines.join('\n')
}

/** Bounded, replayable card data: no meta, no tags, descriptions cut, no undefined values. */
export function cardMeta(value: SearchOutcome): CardOutcome {
  const references = value.references.map((tile) => {
    const { tags: _tags, description, ...rest } = defined(tile)
    return description === undefined ? rest : { ...rest, description: trunc(description, DESCRIPTION_CHARS) }
  })
  const out: CardOutcome = {
    query: value.query,
    modalities: value.modalities,
    count: value.count,
    references,
    sources: value.sources.map(source => defined(source)),
    warnings: value.warnings,
  }
  if (value.intent !== undefined) out.intent = value.intent
  if (value.nextCursor !== undefined) out.nextCursor = value.nextCursor
  if (value.note !== undefined) out.note = value.note
  return out
}
