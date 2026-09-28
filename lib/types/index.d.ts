/**
 * @refkit/dsh-plugin host half. Registers the refkit_search and refkit_rights
 * tools, the `refkit` settings section (BYOK keys, limits) and a short
 * system-prompt hint. The RefkitClient is rebuilt lazily whenever the
 * settings change, so a key typed into the card is live on the next call.
 * @module @refkit/dsh-plugin
 */
import type { Context } from '@deepseek-ai/cordis';
import { type RefkitClient, type RefkitOptions } from '@refkit/core';
import { Config, type ResolvedConfig } from './config.ts';
export declare const name = "refkit";
export declare const inject: string[];
export { Config } from './config.ts';
export type { Config as RefkitPluginConfig, ResolvedConfig } from './config.ts';
export { PROVIDER_IDS, KEYLESS_IDS, PROVIDER_REGISTRY, resolveConfig, buildClient, PLUGIN_VERSION } from './config.ts';
export { createSearchTool, runSearch, SEARCH_TOOL_NAME } from './tools/search.ts';
export type { SearchArgs, SearchDeps } from './tools/search.ts';
export { createRightsTool, runRights, RIGHTS_TOOL_NAME } from './tools/rights.ts';
export type { RightsArgs, RightsOutcome } from './tools/rights.ts';
export { renderSearch, cardMeta } from './render.ts';
export { narrowOutcome, narrowTile } from './core/outcome.ts';
export type { SearchOutcome, CardOutcome, RefTile, SourceStatus, VerdictSummary } from './core/outcome.ts';
/** Model-facing guidance; registered as prompt section `tool:refkit`. */
export declare const GUIDANCE: string;
export interface ApplyDeps {
    createClient: (opts: RefkitOptions) => RefkitClient;
    /** Environment consulted for key fallbacks; defaults to `process.env`. Tests pass `{}` so a developer's keys cannot leak in. */
    env?: NodeJS.ProcessEnv;
}
export interface PluginHandles {
    getClient(): RefkitClient;
    getConfig(): ResolvedConfig;
}
/** Register everything; `deps` exists so tests can observe client construction. Returns the live handles the tools close over. */
export declare function applyWith(ctx: Context, config: Config, deps: ApplyDeps): PluginHandles;
/** Cordis entry point. */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map