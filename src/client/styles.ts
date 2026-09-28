/**
 * Card and settings-page stylesheet, injected once as <style data-refkit-css>
 * the first time either module evaluates. Classes are prefixed rk-; colours read the shell's
 * alias tokens with neutral fallbacks and adapt to prefers-color-scheme.
 * @module @refkit/dsh-plugin/client/styles
 */

export const CSS = `
.rk-root { font-family: inherit; color: var(--dsw-alias-label-primary, inherit); }
.rk-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; margin: 2px 0 10px; }
.rk-head-title { font-size: 13px; font-weight: 600; }
.rk-head-meta { font-size: 12px; color: var(--dsw-alias-label-secondary, #656d76); }
.rk-chip { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; line-height: 16px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.14)); color: var(--dsw-alias-label-secondary, #656d76); background: var(--dsw-alias-bg-base, rgba(127,127,127,.08)); }
.rk-chip-muted { opacity: .65; }
.rk-legend { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 11px; color: var(--dsw-alias-label-secondary, #656d76); margin: 0 0 10px; }
.rk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.rk-tile { position: relative; display: flex; flex-direction: column; border-radius: 10px; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); background: var(--dsw-alias-bg-base, rgba(127,127,127,.06)); }
.rk-media { position: relative; width: 100%; background: var(--dsw-alias-bg-base, rgba(127,127,127,.12)); overflow: hidden; }
.rk-media img { display: block; width: 100%; height: 100%; object-fit: cover; }
.rk-media-text { padding: 10px; font-size: 12px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; }
.rk-media-glyph { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 28px; color: var(--dsw-alias-label-tertiary, #8c959f); }
.rk-badge { position: absolute; top: 6px; left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 600; line-height: 16px; color: #fff; }
.rk-badge-allowed { background: #1a7f37; }
.rk-badge-attribution { background: #0969da; }
.rk-badge-denied { background: #cf222e; }
.rk-badge-review { background: #bf8700; }
.rk-chips { position: absolute; right: 6px; bottom: 6px; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; max-width: calc(100% - 12px); }
.rk-chips .rk-chip { background: rgba(0,0,0,.62); color: #fff; border-color: rgba(255,255,255,.25); backdrop-filter: blur(3px); }
.rk-body { padding: 7px 8px 8px; display: flex; flex-direction: column; gap: 6px; }
.rk-title { font-size: 12px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rk-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.rk-btn { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.16)); background: var(--dsw-alias-bg-base, transparent); color: inherit; font-size: 11px; line-height: 16px; cursor: pointer; text-decoration: none; }
.rk-btn:hover { border-color: var(--dsw-alias-border-l1, rgba(0,0,0,.3)); }
.rk-credit { font-size: 11px; line-height: 1.35; color: var(--dsw-alias-label-secondary, #656d76); user-select: all; word-break: break-word; }
.rk-skeleton { aspect-ratio: 4 / 3; border-radius: 10px; background: linear-gradient(90deg, rgba(127,127,127,.10), rgba(127,127,127,.22), rgba(127,127,127,.10)); background-size: 200% 100%; animation: rk-shimmer 1.2s linear infinite; }
@keyframes rk-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.rk-error { padding: 8px 10px; border-radius: 8px; font-size: 12px; color: #cf222e; background: rgba(207,34,46,.08); white-space: pre-wrap; }
.rk-plain { font-size: 12px; white-space: pre-wrap; }
.rk-set-group { display: flex; flex-direction: column; gap: 14px; margin: 0 0 22px; }
.rk-set-heading { margin: 0; font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); }
.rk-set-note { margin: -6px 0 0; font-size: 12px; line-height: 1.45; color: var(--dsw-alias-label-secondary, #656d76); }
.rk-set-key-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: -6px; }
.rk-set-error { font-size: 12px; color: #cf222e; }
.rk-set-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.rk-set-toggle-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rk-set-toggle-label { font-size: 13px; color: var(--dsw-alias-label-primary, inherit); }
.rk-set-toggle-hint { font-size: 12px; color: var(--dsw-alias-label-secondary, #656d76); }
.rk-set-toggle-side { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.rk-set-ids { margin: 0; font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.6; }
@media (prefers-color-scheme: dark) {
  .rk-root { color: var(--dsw-alias-label-primary, inherit); }
  .rk-head-meta, .rk-legend, .rk-credit, .rk-set-note, .rk-set-toggle-hint { color: var(--dsw-alias-label-secondary, #9198a1); }
  .rk-tile { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.12)); background: var(--dsw-alias-bg-base, rgba(255,255,255,.04)); }
  .rk-chip { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.14)); color: var(--dsw-alias-label-secondary, #9198a1); }
  .rk-btn { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.16)); }
}
`

/** Inject the stylesheet once per page load; idempotent by data attribute. */
export function ensureStyle(): void {
  if (typeof document === 'undefined') return
  const head = document.head ?? document.documentElement
  if (head.querySelector('style[data-refkit-css]') !== null) return
  const tag = document.createElement('style')
  tag.setAttribute('data-refkit-css', '1')
  tag.textContent = CSS
  head.appendChild(tag)
}
