/**
 * Model-facing text for refkit_search and the bounded presentation metadata
 * the web card reads. Pure functions of the canonical value.
 * @module @refkit/dsh-plugin/render
 */
import { type CardOutcome, type SearchOutcome } from './core/outcome.ts';
/** One numbered line per reference plus credit/excerpt sub-lines, warnings and the cursor hint. */
export declare function renderSearch(value: SearchOutcome): string;
/** Bounded, replayable card data: no meta, no tags, descriptions cut, no undefined values. */
export declare function cardMeta(value: SearchOutcome): CardOutcome;
//# sourceMappingURL=render.d.ts.map