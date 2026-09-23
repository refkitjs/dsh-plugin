/**
 * The dsh value-schema mirror of @refkit/core's SearchControls. Core owns the
 * registry (CONTROL_PATHS); this literal exists because dsh tools declare
 * parameters in their own DSL. tests/controls.test.ts pins the mirror to
 * SEARCH_CONTROL_KEYS so the two cannot drift.
 * @module @refkit/dsh-plugin/tools/controls
 */
import type { ObjectValueSchemaSpec } from '@deepseek-ai/dsh-tools';
export declare const CONTROLS_PARAMETER: {
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
/** `group.field` for nested object properties, bare name for scalars. */
export declare function flattenControlKeys(spec: ObjectValueSchemaSpec): string[];
//# sourceMappingURL=controls.d.ts.map