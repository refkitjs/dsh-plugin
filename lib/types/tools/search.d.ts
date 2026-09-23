/**
 * The refkit_search tool: parameter and output schemas in dsh's DSL, the
 * execution that maps core's SearchResult onto the canonical SearchOutcome,
 * and the defineTool wrapper. All ranking and rights logic stays in
 * @refkit/core; this file only shapes inputs and outputs.
 * @module @refkit/dsh-plugin/tools/search
 */
import { type InferArgs, type ToolDefinition } from '@deepseek-ai/dsh-tools';
import { type Attribution, type ProviderSearchStatus, type Reference, type RefkitClient, type Verdict } from '@refkit/core';
import { type ResolvedConfig } from '../config.ts';
import { type RefTile, type SearchOutcome, type SourceStatus } from '../core/outcome.ts';
export declare const SEARCH_TOOL_NAME = "refkit_search";
export interface SearchDeps {
    client(): RefkitClient;
    config(): ResolvedConfig;
}
export declare const SEARCH_PARAMETERS: {
    readonly query: {
        readonly type: "string";
        readonly required: true;
        readonly description: "What to search for, e.g. \"cyberpunk alley at night\". Translate to concise English keywords unless the source is language-specific.";
    };
    readonly modalities: {
        readonly type: "array";
        readonly items: {
            readonly type: "string";
            readonly enum: readonly ["image", "video", "audio", "text"];
        };
        readonly description: "Default [\"image\"]. text = passages/poems/books; audio = sounds/music; video = clips.";
    };
    readonly intent: {
        readonly type: "string";
        readonly enum: readonly ["internal-moodboard", "commercial-product", "ai-generation-input", "redistribution"];
        readonly description: "Annotate every result with a use-verdict (allowed / allowed-with-attribution / denied / needs-review) and a credit line for this intended use. No filtering.";
    };
    readonly gateFor: {
        readonly type: "string";
        readonly enum: readonly ["internal-moodboard", "commercial-product", "ai-generation-input", "redistribution"];
        readonly description: "Return only results whose license allows this intended use (also annotates). Prefer over intent when the user needs usable material only.";
    };
    readonly sources: {
        readonly type: "array";
        readonly items: {
            readonly type: "string";
        };
        readonly description: "Restrict to provider ids (see the tool description). Omit to search every enabled source.";
    };
    readonly limit: {
        readonly type: "integer";
        readonly description: "Results to return, 1..30. Default from configuration.";
    };
    readonly cursor: {
        readonly type: "string";
        readonly description: "Opaque continuation from a previous result's nextCursor.";
    };
    readonly controls: {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly description: "Provider-neutral search controls; each source applies the ones it supports and the rest are reported as ignored.";
        readonly properties: {
            readonly orientation: {
                readonly type: "string";
                readonly enum: readonly ["landscape", "portrait", "square"];
            };
            readonly color: {
                readonly type: "string";
                readonly description: "dominant colour name or hex";
            };
            readonly language: {
                readonly type: "string";
                readonly description: "BCP-47 tag, e.g. en-US";
            };
            readonly sort: {
                readonly type: "string";
                readonly enum: readonly ["relevance", "latest", "popular", "interesting"];
            };
            readonly safety: {
                readonly type: "string";
                readonly enum: readonly ["strict", "moderate", "off"];
            };
            readonly license: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly properties: {
                    readonly commercial: {
                        readonly type: "boolean";
                        readonly description: "only licenses allowing commercial use";
                    };
                    readonly modification: {
                        readonly type: "boolean";
                        readonly description: "only licenses allowing derivatives";
                    };
                    readonly allowUnknown: {
                        readonly type: "boolean";
                    };
                };
            };
            readonly media: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly properties: {
                    readonly kind: {
                        readonly type: "string";
                        readonly description: "photo, illustration, vector, icon, artwork, texture, hdri, 3d-model, film, animation, ...";
                    };
                    readonly size: {
                        readonly type: "string";
                        readonly enum: readonly ["small", "medium", "large"];
                    };
                    readonly minWidth: {
                        readonly type: "integer";
                    };
                    readonly minHeight: {
                        readonly type: "integer";
                    };
                    readonly duration: {
                        readonly type: "string";
                        readonly enum: readonly ["short", "medium", "long"];
                    };
                };
            };
            readonly creator: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly properties: {
                    readonly id: {
                        readonly type: "string";
                    };
                    readonly name: {
                        readonly type: "string";
                    };
                };
            };
            readonly text: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly properties: {
                    readonly copyright: {
                        readonly type: "string";
                        readonly enum: readonly ["public-domain", "copyrighted", "any"];
                    };
                };
            };
            readonly page: {
                readonly type: "integer";
                readonly description: "provider-local page (1-based)";
            };
        };
    };
    readonly minRelevance: {
        readonly type: "number";
        readonly description: "Drop results the ranker scored below this (0..1) after reranking. A result matching no query term lands around 0.3 under the default weights, so 0.5 keeps only real matches. Off by default.";
    };
    readonly explain: {
        readonly type: "boolean";
        readonly description: "Include core's full search metadata (per-source status, applied/ignored controls, gate and threshold counts) under meta.";
    };
};
export type SearchArgs = InferArgs<typeof SEARCH_PARAMETERS>;
export declare const SEARCH_OUTPUT: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly query: {
            readonly type: "string";
            readonly required: true;
        };
        readonly modalities: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
                readonly enum: readonly ["image", "video", "audio", "text"];
            };
            readonly required: true;
        };
        readonly intent: {
            readonly type: "string";
        };
        readonly count: {
            readonly type: "integer";
            readonly required: true;
        };
        readonly references: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly properties: {
                    readonly id: {
                        readonly type: "string";
                        readonly required: true;
                    };
                    readonly modality: {
                        readonly type: "string";
                        readonly enum: readonly ["image", "video", "audio", "text"];
                        readonly required: true;
                    };
                    readonly provider: {
                        readonly type: "string";
                        readonly required: true;
                    };
                    readonly canonicalUrl: {
                        readonly type: "string";
                        readonly required: true;
                    };
                    readonly license: {
                        readonly type: "string";
                        readonly required: true;
                    };
                    readonly title: {
                        readonly type: "string";
                    };
                    readonly kind: {
                        readonly type: "string";
                    };
                    readonly licenseVersion: {
                        readonly type: "string";
                    };
                    readonly author: {
                        readonly type: "string";
                    };
                    readonly thumbnail: {
                        readonly type: "string";
                    };
                    readonly preview: {
                        readonly type: "string";
                    };
                    readonly width: {
                        readonly type: "number";
                    };
                    readonly height: {
                        readonly type: "number";
                    };
                    readonly description: {
                        readonly type: "string";
                    };
                    readonly excerpt: {
                        readonly type: "string";
                    };
                    readonly tags: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "string";
                        };
                    };
                    readonly useVerdict: {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly properties: {
                            readonly decision: {
                                readonly type: "string";
                                readonly enum: readonly ["allowed", "allowed-with-attribution", "denied", "needs-review"];
                                readonly required: true;
                            };
                            readonly reason: {
                                readonly type: "string";
                                readonly required: true;
                            };
                            readonly confidence: {
                                readonly type: "string";
                                readonly enum: readonly ["high", "low"];
                                readonly required: true;
                            };
                        };
                    };
                    readonly attribution: {
                        readonly type: "string";
                    };
                };
            };
            readonly required: true;
        };
        readonly nextCursor: {
            readonly type: "string";
        };
        readonly sources: {
            readonly type: "array";
            readonly required: true;
            readonly items: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly properties: {
                    readonly id: {
                        readonly type: "string";
                        readonly required: true;
                    };
                    readonly status: {
                        readonly type: "string";
                        readonly enum: readonly ["fulfilled", "failed", "skipped"];
                        readonly required: true;
                    };
                    readonly reason: {
                        readonly type: "string";
                    };
                    readonly returned: {
                        readonly type: "integer";
                    };
                };
            };
        };
        readonly warnings: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
            readonly required: true;
        };
        readonly note: {
            readonly type: "string";
        };
        readonly meta: {
            readonly type: "json";
        };
    };
};
/** Project one core Reference (plus optional assessment) onto a tile with no undefined keys. */
export declare function toTile(ref: Reference, assessment?: {
    verdict: Verdict;
    attribution: Attribution;
}): RefTile;
/** Compact projection of core's per-provider status. */
export declare function toSourceStatus(status: ProviderSearchStatus): SourceStatus;
/** Execute one search against the current client and shape the canonical value. */
export declare function runSearch(args: SearchArgs, deps: SearchDeps, signal?: AbortSignal): Promise<SearchOutcome>;
/** The registered definition. */
export declare function createSearchTool(deps: SearchDeps): ToolDefinition;
//# sourceMappingURL=search.d.ts.map