/**
 * Canonical result vocabulary shared by the host half (tool output, render,
 * presentation metadata) and the browser half (the card). No runtime
 * dependencies: plain data plus soft parsers, so a malformed or
 * version-drifted payload degrades to text instead of crashing a render.
 * @module @refkit/dsh-plugin/core
 */
export declare const MODALITIES: readonly ["image", "video", "audio", "text"];
export type Modality = (typeof MODALITIES)[number];
export declare const DECISIONS: readonly ["allowed", "allowed-with-attribution", "denied", "needs-review"];
export type Decision = (typeof DECISIONS)[number];
export declare const SOURCE_STATUSES: readonly ["fulfilled", "failed", "skipped"];
export type SourceStatusKind = (typeof SOURCE_STATUSES)[number];
/** Lossless JSON. */
export type Json = string | number | boolean | null | Json[] | {
    [key: string]: Json;
};
export interface VerdictSummary {
    decision: Decision;
    reason: string;
    confidence: 'high' | 'low';
}
/** One reference as the tool returns it and the card renders it. */
export interface RefTile {
    id: string;
    modality: Modality;
    /** The source id (e.g. `openverse-audio`); 0.2.0 tiles named it `provider`. */
    source: string;
    canonicalUrl: string;
    license: string;
    title?: string;
    kind?: string;
    licenseVersion?: string;
    author?: string;
    thumbnail?: string;
    preview?: string;
    /** The original's dimensions when known, else the preview rendition's (the aspect ratio is the same). */
    width?: number;
    height?: number;
    /** Audio and video length in seconds (a float). */
    durationSec?: number;
    description?: string;
    excerpt?: string;
    tags?: string[];
    useVerdict?: VerdictSummary;
    attribution?: string;
}
export interface SourceStatus {
    id: string;
    status: SourceStatusKind;
    reason?: string;
    returned?: number;
}
/** The canonical value of one refkit_search call. */
export interface SearchOutcome {
    query: string;
    modalities: Modality[];
    intent?: string;
    count: number;
    references: RefTile[];
    nextCursor?: string;
    sources: SourceStatus[];
    warnings: string[];
    note?: string;
    /** Core's full SearchMeta, only when the caller passed `explain`. */
    meta?: Json;
}
/** What the card receives: the outcome minus `meta`, descriptions cut, tags dropped. */
export type CardOutcome = Omit<SearchOutcome, 'meta'>;
/** Shallow copy of `obj` without its undefined-valued own properties (dsh snapshots values as lossless JSON). */
export declare function defined<T extends object>(obj: T): T;
/**
 * A duration as `m:ss`, or `h:mm:ss` from an hour on, rounded to the nearest second; a
 * sub-second clip reads `0:01`, never `0:00`. Undefined for a missing, non-finite or non-positive value.
 */
export declare function formatDuration(sec: number | undefined): string | undefined;
/** Cut `text` to `max` code points, appending an ellipsis when anything was removed. */
export declare function trunc(text: string, max: number): string;
/**
 * Soft-narrow one tile; null for anything unusable. Unknown keys are dropped. A tile persisted by
 * 0.2.0 names its source `provider`; it is read as `source` so old conversations still render.
 */
export declare function narrowTile(value: unknown): RefTile | null;
/** Soft-parse a canonical value or presentation metadata; null for the wrong shape. */
export declare function narrowOutcome(value: unknown): SearchOutcome | null;
//# sourceMappingURL=outcome.d.ts.map