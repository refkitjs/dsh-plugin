/**
 * Card stylesheet, injected once as <style data-refkit-css> the first time the
 * card module evaluates. Classes are prefixed rk-; colours read the shell's
 * alias tokens with neutral fallbacks and adapt to prefers-color-scheme.
 * @module @refkit/dsh-plugin/client/styles
 */

export const CSS = `
.rk-root { font-family: inherit; color: var(--dsw-alias-text-l1, #1f2328); }
.rk-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; margin: 2px 0 10px; }
.rk-head-title { font-size: 13px; font-weight: 600; }
.rk-head-meta { font-size: 12px; color: var(--dsw-alias-text-l2, #656d76); }
.rk-chip { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; line-height: 16px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.14)); color: var(--dsw-alias-text-l2, #656d76); background: var(--dsw-alias-bg-l2, rgba(127,127,127,.08)); }
.rk-chip-muted { opacity: .65; }
.rk-legend { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 11px; color: var(--dsw-alias-text-l2, #656d76); margin: 0 0 10px; }
.rk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.rk-tile { position: relative; display: flex; flex-direction: column; border-radius: 10px; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); background: var(--dsw-alias-bg-l2, rgba(127,127,127,.06)); }
.rk-media { position: relative; width: 100%; background: var(--dsw-alias-bg-l3, rgba(127,127,127,.12)); overflow: hidden; }
.rk-media img { display: block; width: 100%; height: 100%; object-fit: cover; }
.rk-media-text { padding: 10px; font-size: 12px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; }
.rk-media-glyph { display: flex; align-items: center; justify-content: center; font-size: 28px; color: var(--dsw-alias-text-l3, #8c959f); }
.rk-badge { position: absolute; top: 6px; left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 600; line-height: 16px; color: #fff; }
.rk-badge-allowed { background: #1a7f37; }
.rk-badge-attribution { background: #0969da; }
.rk-badge-denied { background: #cf222e; }
.rk-badge-review { background: #bf8700; }
.rk-chips { position: absolute; right: 6px; bottom: 6px; display: flex; gap: 4px; }
.rk-chips .rk-chip { background: rgba(0,0,0,.62); color: #fff; border-color: rgba(255,255,255,.25); backdrop-filter: blur(3px); }
.rk-body { padding: 7px 8px 8px; display: flex; flex-direction: column; gap: 6px; }
.rk-title { font-size: 12px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rk-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.rk-btn { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.16)); background: var(--dsw-alias-bg-l1, transparent); color: inherit; font-size: 11px; line-height: 16px; cursor: pointer; text-decoration: none; }
.rk-btn:hover { border-color: var(--dsw-alias-border-l1, rgba(0,0,0,.3)); }
.rk-credit { font-size: 11px; line-height: 1.35; color: var(--dsw-alias-text-l2, #656d76); user-select: all; word-break: break-word; }
.rk-skeleton { aspect-ratio: 4 / 3; border-radius: 10px; background: linear-gradient(90deg, rgba(127,127,127,.10), rgba(127,127,127,.22), rgba(127,127,127,.10)); background-size: 200% 100%; animation: rk-shimmer 1.2s linear infinite; }
@keyframes rk-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.rk-error { padding: 8px 10px; border-radius: 8px; font-size: 12px; color: #cf222e; background: rgba(207,34,46,.08); white-space: pre-wrap; }
.rk-plain { font-size: 12px; white-space: pre-wrap; }
@media (prefers-color-scheme: dark) {
  .rk-root { color: var(--dsw-alias-text-l1, #e6edf3); }
  .rk-head-meta, .rk-legend, .rk-credit { color: var(--dsw-alias-text-l2, #9198a1); }
  .rk-tile { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.12)); background: var(--dsw-alias-bg-l2, rgba(255,255,255,.04)); }
  .rk-chip { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.14)); color: var(--dsw-alias-text-l2, #9198a1); }
  .rk-btn { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.16)); }
}
`

/** Inject the stylesheet once per page load; idempotent by data attribute. */
export function ensureStyle(): void {
  if (typeof document === 'undefined') return
  if (document.head.querySelector('style[data-refkit-css]') !== null) return
  const tag = document.createElement('style')
  tag.setAttribute('data-refkit-css', '1')
  tag.textContent = CSS
  document.head.appendChild(tag)
}
