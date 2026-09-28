/**
 * The refkit_rights tool: a stateless use-gate check for one license id (or
 * a facts row) against an intended use, returning core's verdict and the
 * credit line. Lets the model re-check a result for a new intent without
 * searching again.
 * @module @refkit/dsh-plugin/tools/rights
 */
import { type InferArgs, type InferValue, type ToolDefinition } from '@deepseek-ai/dsh-tools';
export declare const RIGHTS_TOOL_NAME = "refkit_rights";
export declare const RIGHTS_PARAMETERS: {
    readonly license: {
        readonly type: "string";
        readonly required: true;
        readonly description: "License id as returned by refkit_search (e.g. CC-BY, CC0-1.0, PD, unsplash). An unknown id without `facts` resolves to needs-review.";
    };
    readonly intent: {
        readonly type: "string";
        readonly enum: readonly ["internal-moodboard", "commercial-product", "ai-generation-input", "redistribution"];
        readonly required: true;
        readonly description: "The intended use to evaluate.";
    };
    readonly canonicalUrl: {
        readonly type: "string";
        readonly required: true;
        readonly description: "Canonical source link, for the credit line and audit.";
    };
    readonly licenseVersion: {
        readonly type: "string";
        readonly description: "CC version such as \"4.0\"; ignored for non-CC ids.";
    };
    readonly author: {
        readonly type: "string";
    };
    readonly title: {
        readonly type: "string";
    };
    readonly editorialOnly: {
        readonly type: "boolean";
        readonly description: "Source marked editorial-only.";
    };
    readonly jurisdiction: {
        readonly type: "string";
        readonly description: "Source-declared jurisdiction of a public-domain status.";
    };
    readonly userJurisdiction: {
        readonly type: "string";
        readonly description: "Caller's jurisdiction; a mismatch defaults to needs-review.";
    };
    readonly facts: {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly description: "Override the license table with source-declared facts (all five fields required when present).";
        readonly properties: {
            readonly commercialUse: {
                readonly oneOf: readonly [{
                    readonly type: "boolean";
                }, {
                    readonly type: "string";
                    readonly const: "unknown";
                }];
            };
            readonly derivatives: {
                readonly oneOf: readonly [{
                    readonly type: "boolean";
                }, {
                    readonly type: "string";
                    readonly const: "unknown";
                }];
            };
            readonly redistribution: {
                readonly oneOf: readonly [{
                    readonly type: "boolean";
                }, {
                    readonly type: "string";
                    readonly const: "unknown";
                }];
            };
            readonly attributionRequired: {
                readonly type: "boolean";
            };
            readonly shareAlike: {
                readonly type: "boolean";
            };
        };
    };
};
export type RightsArgs = InferArgs<typeof RIGHTS_PARAMETERS>;
export declare const RIGHTS_OUTPUT: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly decision: {
            readonly type: "string";
            readonly enum: readonly ["allowed", "allowed-with-attribution", "denied", "needs-review"];
            readonly required: true;
        };
        readonly reasons: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
            readonly required: true;
        };
        readonly confidence: {
            readonly type: "string";
            readonly enum: readonly ["high", "low"];
            readonly required: true;
        };
        readonly attribution: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: true;
            readonly properties: {
                readonly required: {
                    readonly type: "boolean";
                    readonly required: true;
                };
                readonly text: {
                    readonly type: "string";
                };
                readonly html: {
                    readonly type: "string";
                };
            };
        };
        readonly disclaimer: {
            readonly type: "string";
            readonly required: true;
        };
    };
};
export type RightsOutcome = InferValue<typeof RIGHTS_OUTPUT>;
/** Evaluate one license for one intent; pure and synchronous. */
export declare function runRights(args: RightsArgs): RightsOutcome;
/** Model-facing text: verdict line, credit line when required, disclaimer. */
export declare function renderRights(value: RightsOutcome): string;
export declare function createRightsTool(): ToolDefinition;
//# sourceMappingURL=rights.d.ts.map