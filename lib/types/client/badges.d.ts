/**
 * Pure presentation helpers for the card: verdict badge classes and labels,
 * license chip text, source bucketing, tile aspect ratio. No DOM, no React,
 * so they are unit-tested directly.
 * @module @refkit/dsh-plugin/client/badges
 */
import type { Decision, RefTile, SourceStatus } from '../core/outcome.ts';
export declare function verdictBadge(decision: Decision): {
    className: string;
    label: string;
};
export declare function licenseLabel(tile: Pick<RefTile, 'license' | 'licenseVersion'>): string;
export declare function summarizeSources(sources: readonly SourceStatus[]): {
    fulfilled: SourceStatus[];
    failed: SourceStatus[];
    skipped: SourceStatus[];
};
/** CSS `aspect-ratio` value for a tile. */
export declare function aspectRatio(tile: Pick<RefTile, 'width' | 'height'>): string;
//# sourceMappingURL=badges.d.ts.map