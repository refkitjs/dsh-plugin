/**
 * Model-facing text for refkit_search and the bounded presentation metadata
 * the web card reads. Pure functions of the canonical value.
 * @module @refkit/dsh-plugin/render
 */
import { type CardOutcome, type SearchOutcome } from './core/outcome.ts';
/**
 * One numbered line per reference plus credit/excerpt sub-lines, warnings, the
 * cursor hint and, with `explain`, a bounded `meta:` line — dsh sends the model
 * only this text, never the canonical value.
 */
export declare function renderSearch(value: SearchOutcome): string;
/** Bounded, replayable card data: no meta, no tags, descriptions and excerpts cut, no undefined values. */
export declare function cardMeta(value: SearchOutcome): CardOutcome;
//# sourceMappingURL=render.d.ts.map