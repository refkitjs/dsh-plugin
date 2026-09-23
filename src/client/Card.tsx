/**
 * Keyed tool.call.toolview entry for refkit_search. Parses the settled block's
 * presentation metadata into a SearchOutcome and renders a thumbnail grid:
 * license chip on every tile, a coloured use-verdict badge when the call
 * carried an intent, and a one-click credit copy. Every failure path degrades
 * to plain text — the chat row never breaks.
 * @module @refkit/dsh-plugin/client/Card
 */

import { useState, type ReactNode } from 'react'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolCallOwnerProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { narrowOutcome, type RefTile, type SearchOutcome } from '../core/outcome.ts'
import { aspectRatio, licenseLabel, summarizeSources, verdictBadge } from './badges.ts'
import { COPY } from './copy.ts'
import { ensureStyle } from './styles.ts'

ensureStyle()

function textOf(block: ToolCallBlock): string {
  if (!('kind' in block)) return ''
  const parts: string[] = []
  for (const item of block.content) {
    if (item.type === 'text' && typeof (item as { text?: unknown }).text === 'string') parts.push((item as { text: string }).text)
  }
  return parts.join('\n')
}

function outcomeOf(block: ToolCallBlock): SearchOutcome | null {
  if (!('kind' in block)) return null
  const fromMeta = narrowOutcome(block.meta)
  if (fromMeta !== null) return fromMeta
  const text = textOf(block).trim()
  if (text.length === 0 || text[0] !== '{') return null
  try { return narrowOutcome(JSON.parse(text)) } catch { return null }
}

function RunningGrid(): ReactNode {
  return (
    <div className="rk-root">
      <div className="rk-head"><span className="rk-head-meta">{COPY.searching}</span></div>
      <div className="rk-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="rk-skeleton" />)}</div>
    </div>
  )
}

function CreditButton({ text }: { text: string }): ReactNode {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copy = (): void => {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    if (!clipboard) { setState('failed'); return }
    clipboard.writeText(text).then(() => setState('copied'), () => setState('failed'))
  }
  if (state === 'failed') return <span className="rk-credit">{COPY.copyFailed} {text}</span>
  return <button type="button" className="rk-btn" onClick={copy}>{state === 'copied' ? COPY.copied : COPY.copyCredit}</button>
}

function Tile({ tile }: { tile: RefTile }): ReactNode {
  const image = tile.thumbnail ?? tile.preview
  const badge = tile.useVerdict ? verdictBadge(tile.useVerdict.decision) : null
  let media: ReactNode
  if (tile.modality === 'image' && image) {
    media = <img src={image} alt={tile.title ?? ''} loading="lazy" referrerPolicy="no-referrer" />
  } else if (tile.modality === 'text') {
    media = <div className="rk-media-text">{tile.excerpt ?? tile.description ?? tile.title ?? COPY.untitled}</div>
  } else {
    media = <div className="rk-media-glyph" aria-label={tile.modality}>{tile.modality === 'audio' ? '♪' : tile.modality === 'video' ? '▶' : '▦'}</div>
  }
  return (
    <div className="rk-tile">
      <div className="rk-media" style={{ aspectRatio: aspectRatio(tile) }}>
        {media}
        {badge && <span className={badge.className} title={tile.useVerdict?.reason}>{badge.label}</span>}
        <div className="rk-chips">
          <span className="rk-chip" title={tile.provider}>{tile.provider}</span>
          <span className="rk-chip" title={tile.license}>{licenseLabel(tile)}</span>
        </div>
      </div>
      <div className="rk-body">
        <div className="rk-title" title={tile.title}>{tile.title ?? COPY.untitled}</div>
        <div className="rk-actions">
          <a className="rk-btn" href={tile.canonicalUrl} target="_blank" rel="noopener noreferrer">{COPY.open}</a>
          {tile.attribution && <CreditButton text={tile.attribution} />}
        </div>
      </div>
    </div>
  )
}

function Header({ outcome }: { outcome: SearchOutcome }): ReactNode {
  const { fulfilled, failed, skipped } = summarizeSources(outcome.sources)
  return (
    <>
      <div className="rk-head">
        <span className="rk-head-title">{COPY.refsFor(outcome.count, outcome.query)}</span>
        {outcome.intent && <span className="rk-head-meta">{COPY.intent(outcome.intent)}</span>}
        {fulfilled.map(s => <span key={s.id} className="rk-chip">{s.id}{s.returned !== undefined ? ` ${s.returned}` : ''}</span>)}
        {failed.length > 0 && <span className="rk-chip rk-chip-muted" title={failed.map(s => s.id).join(', ')}>{COPY.failed(failed.length)}</span>}
        {skipped.length > 0 && <span className="rk-chip rk-chip-muted" title={skipped.map(s => `${s.id}${s.reason ? ` (${s.reason})` : ''}`).join(', ')}>{COPY.skipped(skipped.length)}</span>}
        {outcome.nextCursor && <span className="rk-head-meta">{COPY.more}</span>}
      </div>
      {outcome.intent && (
        <div className="rk-legend">
          <span>{COPY.legend}</span>
          {(['allowed', 'allowed-with-attribution', 'denied', 'needs-review'] as const).map(d => {
            const b = verdictBadge(d)
            return <span key={d} className={b.className} style={{ position: 'static' }}>{b.label}</span>
          })}
        </div>
      )}
    </>
  )
}

/** The slot component: dispatch by block lifecycle, degrade safely. */
export function RefkitCard(props: ToolCallOwnerProps): ReactNode {
  const block: ToolCallBlock = props.block
  if (!('kind' in block)) return <RunningGrid />
  if (block.isError) {
    const text = textOf(block)
    return <div className="rk-error">{text.length > 0 ? text : `${block.error?.name ?? 'Error'}: ${block.error?.code ?? 'unknown'}`}</div>
  }
  const outcome = outcomeOf(block)
  if (outcome === null) {
    const text = textOf(block)
    return <div className="rk-plain">{text.length > 0 ? text : JSON.stringify(block.content, null, 2)}</div>
  }
  return (
    <div className="rk-root">
      <Header outcome={outcome} />
      {outcome.references.length === 0
        ? <div className="rk-head-meta">{outcome.note ?? COPY.empty}</div>
        : <div className="rk-grid">{outcome.references.map(tile => <Tile key={tile.id} tile={tile} />)}</div>}
    </div>
  )
}

export default RefkitCard
