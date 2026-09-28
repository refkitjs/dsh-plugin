/**
 * Plugin configuration: the schemastery schema (every field volatile, so the
 * Host projects it as the `refkit` settings namespace and commits edits into
 * live references), environment fallbacks shared with @refkit/mcp's CLI, the
 * static registry of the 23 provider factories, and the RefkitClient factory.
 * Secrets are read here and nowhere else.
 * @module @refkit/dsh-plugin/config
 */
import type { Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type ReferenceProvider, type RefkitClient, type RefkitOptions } from '@refkit/core';
import type { Modality } from './core/outcome.ts';
/** Kept in sync with package.json by tests/config.test.ts. */
export declare const PLUGIN_VERSION = "0.2.0";
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
/** Plain settings values: what each reference's `.get()` returns. Every field optional so an unconfigured mount loads silently. */
export interface ConfigValues {
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
    sources?: readonly string[];
    limit?: number;
    poolFactor?: number;
    deadlineMs?: number;
    timeoutMs?: number;
    rerank?: boolean;
    sourceConfidence?: boolean;
    userAgent?: string;
}
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
/** Resolve plain settings values plus environment into validated facts with defaults. */
export declare function resolveConfig(config: ConfigValues, env?: NodeJS.ProcessEnv): ResolvedConfig;
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
/**
 * Schemastery schema. Every field is volatile: a settings edit commits into the
 * same references and emits `loader/volatile-update` instead of remounting the
 * plugin. An unknown `sources` id fails validation, so the Host refuses the write.
 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    unsplashAccessKey: z<string, string, "volatile">;
    pexelsApiKey: z<string, string, "volatile">;
    pixabayKey: z<string, string, "volatile">;
    flickrApiKey: z<string, string, "volatile">;
    smithsonianApiKey: z<string, string, "volatile">;
    braveToken: z<string, string, "volatile">;
    freesoundToken: z<string, string, "volatile">;
    jamendoClientId: z<string, string, "volatile">;
    europeanaApiKey: z<string, string, "volatile">;
    openverseToken: z<string, string, "volatile">;
    sources: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    limit: z<number, number, "volatile-defined">;
    poolFactor: z<number, number, "volatile-defined">;
    deadlineMs: z<number, number, "volatile-defined">;
    timeoutMs: z<number, number, "volatile-defined">;
    rerank: z<boolean, boolean, "volatile-defined">;
    sourceConfidence: z<boolean, boolean, "volatile-defined">;
    userAgent: z<string, string, "volatile">;
}>>, Schemastery.ObjectT<NoInfer<{
    unsplashAccessKey: z<string, string, "volatile">;
    pexelsApiKey: z<string, string, "volatile">;
    pixabayKey: z<string, string, "volatile">;
    flickrApiKey: z<string, string, "volatile">;
    smithsonianApiKey: z<string, string, "volatile">;
    braveToken: z<string, string, "volatile">;
    freesoundToken: z<string, string, "volatile">;
    jamendoClientId: z<string, string, "volatile">;
    europeanaApiKey: z<string, string, "volatile">;
    openverseToken: z<string, string, "volatile">;
    sources: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    limit: z<number, number, "volatile-defined">;
    poolFactor: z<number, number, "volatile-defined">;
    deadlineMs: z<number, number, "volatile-defined">;
    timeoutMs: z<number, number, "volatile-defined">;
    rerank: z<boolean, boolean, "volatile-defined">;
    sourceConfidence: z<boolean, boolean, "volatile-defined">;
    userAgent: z<string, string, "volatile">;
}>>, "plain">;
/** Config as `apply` receives it: every field a live Loader reference. */
export type Config = {
    readonly [K in keyof ConfigValues]-?: Volatile<ConfigValues[K]>;
};
/** One consistent snapshot; the Loader commits every reference before it emits the event. */
export declare function readConfig(config: Config): ConfigValues;
/** Providers that are keyless or keyed-and-configured, intersected with the whitelist, in registry order. */
export declare function enabledProviders(cfg: ResolvedConfig): ReferenceProvider[];
/** Build the RefkitClient for one resolved configuration. */
export declare function buildClient(cfg: ResolvedConfig, createClient?: (opts: RefkitOptions) => RefkitClient): RefkitClient;
//# sourceMappingURL=config.d.ts.map