/**
 * Plugin configuration: the schemastery schema (doubles as the Settings ->
 * Plugins -> refkit card), environment fallbacks shared with @refkit/mcp's
 * CLI, the static registry of the 23 provider factories, and the
 * RefkitClient factory. Secrets are read here and nowhere else.
 * @module @refkit/dsh-plugin/config
 */
import z from '@deepseek-ai/schemastery';
import { type ReferenceProvider, type RefkitClient, type RefkitOptions } from '@refkit/core';
import type { Modality } from './core/outcome.ts';
/** Kept in sync with package.json by tests/config.test.ts. */
export declare const PLUGIN_VERSION = "0.1.0";
export declare const KEY_FIELDS: readonly ["unsplashAccessKey", "pexelsApiKey", "pixabayKey", "flickrApiKey", "smithsonianApiKey", "braveToken", "freesoundToken", "jamendoClientId", "europeanaApiKey", "openverseToken"];
export type KeyField = (typeof KEY_FIELDS)[number];
/** Environment names per key, first match wins. The nine keyed sources mirror @refkit/mcp's CLI. */
export declare const KEY_ENV: Record<KeyField, readonly string[]>;
/** Upper bound of the configurable whole-search deadline; the tool's timeout backstop derives from it. */
export declare const MAX_DEADLINE_MS = 60000;
export declare const DEFAULTS: {
    readonly limit: 12;
    readonly poolFactor: 2;
    readonly deadlineMs: 15000;
    readonly timeoutMs: 10000;
    readonly rerank: true;
    readonly sourceConfidence: true;
};
/** Deployment configuration; every field optional so an unconfigured mount loads silently. */
export interface Config {
    unsplashAccessKey?: string;
    pexelsApiKey?: string;
    pixabayKey?: string;
    flickrApiKey?: string;
    smithsonianApiKey?: string;
    braveToken?: string;
    freesoundToken?: string;
    jamendoClientId?: string;
    europeanaApiKey?: string;
    openverseToken?: string;
    /** Provider ids to enable; empty = every source whose key is present. */
    sources?: string[];
    limit?: number;
    poolFactor?: number;
    deadlineMs?: number;
    timeoutMs?: number;
    rerank?: boolean;
    sourceConfidence?: boolean;
    userAgent?: string;
}
/** Schemastery schema; also the `refkit` settings-section schema. */
export declare const Config: z<Config>;
export interface ResolvedConfig {
    keys: Record<KeyField, string | undefined>;
    sources: string[];
    limit: number;
    poolFactor: number;
    deadlineMs: number;
    timeoutMs: number;
    rerank: boolean;
    sourceConfidence: boolean;
    userAgent: string;
}
/** Resolve raw config plus environment into validated facts with defaults. */
export declare function resolveConfig(config: Config, env?: NodeJS.ProcessEnv): ResolvedConfig;
/** One provider factory the plugin can mount. */
export interface ProviderEntry {
    id: string;
    modalities: Modality[];
    /** The secret field that enables this entry; undefined = keyless. */
    key?: KeyField;
    make: (cfg: ResolvedConfig) => ReferenceProvider;
}
export declare const PROVIDER_REGISTRY: readonly ProviderEntry[];
export declare const PROVIDER_IDS: readonly string[];
export declare const KEYLESS_IDS: readonly string[];
/** Providers that are keyless or keyed-and-configured, intersected with the whitelist, in registry order. */
export declare function enabledProviders(cfg: ResolvedConfig): ReferenceProvider[];
/** Constraints the schema cannot express; throwing refuses the settings write. */
export declare function validateConfig(config: Config): void;
/** Build the RefkitClient for one resolved configuration. */
export declare function buildClient(cfg: ResolvedConfig, createClient?: (opts: RefkitOptions) => RefkitClient): RefkitClient;
//# sourceMappingURL=config.d.ts.map