/** UI strings for the card and the settings page. One object so a locale swap is one file. */
export declare const COPY: {
    readonly searching: "Searching refkit sources…";
    readonly refsFor: (count: number, query: string) => string;
    readonly intent: (intent: string) => string;
    readonly more: "more available — ask for the next page";
    readonly failed: (n: number) => string;
    readonly skipped: (n: number) => string;
    readonly open: "Open";
    readonly copyCredit: "Copy credit";
    readonly copied: "Copied";
    readonly copyFailed: "Select and copy:";
    readonly empty: "No results. Try broader terms, another modality, or fewer controls.";
    readonly legend: "Verdict:";
    readonly untitled: "(untitled)";
    readonly settings: {
        readonly summary: (configured: number, total: number) => string;
        readonly unavailable: "refkit is not running, so it cannot be configured right now.";
        readonly readOnly: "This deployment stores settings read-only.";
        readonly saveFailed: "The deployment did not accept these values; they were left for you to correct.";
        readonly save: "Save";
        readonly saving: "Saving…";
        readonly overridden: "Overridden";
        readonly reset: "Reset to default";
        readonly keysHeading: "API keys";
        readonly keysNote: "Each key enables the sources named beside it; keyless sources need none. Keys are stored in plain text in this profile’s cordis.patch.yml (file mode 0600) and apply on the next search.";
        readonly keyHint: (env: readonly string[]) => string;
        readonly keySet: "Set";
        readonly keyUnset: "Not set";
        readonly remove: "Remove";
        readonly removeLabel: (label: string) => string;
        readonly removing: "Removing…";
        readonly removeBlocked: "Save your other edits first: removing a key writes immediately.";
        readonly removeFailed: "Not removed; try again.";
        readonly searchHeading: "Search";
        readonly limit: "Results per call";
        readonly limitHint: "Also caps per-item detail fetches for met, rijksmuseum and polyhaven.";
        readonly poolFactor: "Fusion pool factor";
        readonly poolFactorHint: "Rank-fusion pool multiplier.";
        readonly deadlineMs: "Search deadline (ms)";
        readonly deadlineMsHint: "Whole-search deadline.";
        readonly timeoutMs: "Per-source timeout (ms)";
        readonly timeoutMsHint: "How long one source may take.";
        readonly range: (hint: string, bounds: {
            min: number;
            max: number;
            default: number;
        }) => string;
        readonly invalidRange: (bounds: {
            min: number;
            max: number;
        }) => string;
        readonly sources: "Sources";
        readonly sourcesHint: "Comma-separated provider ids. A keyed source also needs its key.";
        readonly sourcesPlaceholder: "empty = all enabled sources";
        readonly sourcesHelp: "Source ids";
        readonly sourcesInvalid: "Unknown source id. Use the ids listed under the info button.";
        readonly userAgent: "User-Agent";
        readonly userAgentHint: "Sent with provider requests. Blank uses refkit-dsh-plugin/<version>.";
        readonly rerank: "Lexical rerank";
        readonly rerankHint: "Rerank fused results over title, description, tags and excerpt.";
        readonly sourceConfidence: "Source confidence";
        readonly sourceConfidenceHint: "Down-weight sources whose batch never mentions the query.";
    };
};
//# sourceMappingURL=copy.d.ts.map