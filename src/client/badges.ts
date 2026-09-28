/**
 * Pure presentation helpers for the card: verdict badge classes and labels,
 * license chip text, source bucketing, tile aspect ratio. No DOM, no React,
 * so they are unit-tested directly.
 * @module @refkit/dsh-plugin/client/badges
 */

import type { Decision, RefTile, SourceStatus } from '../core/outcome.ts'

const LICENSE_CHARS = 20

export function verdictBadge(decision: Decision): { className: string; label: string } {
  switch (decision) {
    case 'allowed': return { className: 'rk-badge rk-badge-allowed', label: 'Allowed' }
    case 'allowed-with-attribution': return { className: 'rk-badge rk-badge-attribution', label: 'Credit required' }
    case 'denied': return { className: 'rk-badge rk-badge-denied', label: 'Not allowed' }
    case 'needs-review': return { className: 'rk-badge rk-badge-review', label: 'Needs review' }
  }
}

export function licenseLabel(tile: Pick<RefTile, 'license' | 'licenseVersion'>): string {
  const base = tile.licenseVersion ? `${tile.license} ${tile.licenseVersion}` : tile.license
  const points = Array.from(base)
  return points.length > LICENSE_CHARS ? points.slice(0, LICENSE_CHARS).join('') + '…' : base
}

export function summarizeSources(sources: readonly SourceStatus[]): { fulfilled: SourceStatus[]; failed: SourceStatus[]; skipped: SourceStatus[] } {
  return {
    fulfilled: sources.filter(s => s.status === 'fulfilled'),
    failed: sources.filter(s => s.status === 'failed'),
    skipped: sources.filter(s => s.status === 'skipped'),
  }
}

/** CSS `aspect-ratio` value for a tile. */
export function aspectRatio(tile: Pick<RefTile, 'width' | 'height'>): string {
  return tile.width && tile.height && tile.width > 0 && tile.height > 0 ? `${tile.width} / ${tile.height}` : '4 / 3'
}
