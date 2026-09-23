/**
 * @refkit/dsh-plugin host half. Registers the refkit_search and refkit_rights
 * tools, the `refkit` settings section (BYOK keys, limits) and a short
 * system-prompt hint. The RefkitClient is rebuilt lazily whenever the
 * settings change, so a key typed into the card is live on the next call.
 * @module @refkit/dsh-plugin
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { createRefkit, type RefkitClient, type RefkitOptions } from '@refkit/core'
import { Config, buildClient, resolveConfig, validateConfig, type ResolvedConfig } from './config.ts'
import { createRightsTool } from './tools/rights.ts'
import { createSearchTool } from './tools/search.ts'

export const name = 'refkit'
export const inject = ['tools']

export { Config } from './config.ts'
export type { Config as RefkitPluginConfig, ResolvedConfig } from './config.ts'
export { PROVIDER_IDS, KEYLESS_IDS, PROVIDER_REGISTRY, resolveConfig, buildClient, PLUGIN_VERSION } from './config.ts'
export { createSearchTool, runSearch, SEARCH_TOOL_NAME } from './tools/search.ts'
export type { SearchArgs, SearchDeps } from './tools/search.ts'
export { createRightsTool, runRights, RIGHTS_TOOL_NAME } from './tools/rights.ts'
export type { RightsArgs, RightsOutcome } from './tools/rights.ts'
export { renderSearch, cardMeta } from './render.ts'
export { narrowOutcome, narrowTile } from './core/outcome.ts'
export type { SearchOutcome, CardOutcome, RefTile, SourceStatus, VerdictSummary } from './core/outcome.ts'

/** Model-facing guidance; registered as prompt section `tool:refkit`. */
export const GUIDANCE =
  'Use refkit_search when the user wants reference material for creative work — reference images, textures, artworks, sound effects, music, poems or book passages — rather than web pages. '
  + 'Pass `intent` when the user has said how the material will be used, and `gateFor` when only usable results should come back; cite each result\'s canonicalUrl and repeat its credit line whenever a result requires attribution. '
  + 'Use refkit_rights to re-check one license for a different intent without searching again.'

export interface ApplyDeps {
  createClient: (opts: RefkitOptions) => RefkitClient
  /** Environment consulted for key fallbacks; defaults to `process.env`. Tests pass `{}` so a developer's keys cannot leak in. */
  env?: NodeJS.ProcessEnv
}

export interface PluginHandles {
  getClient(): RefkitClient
  getConfig(): ResolvedConfig
}

/** Register everything; `deps` exists so tests can observe client construction. Returns the live handles the tools close over. */
export function applyWith(ctx: Context, config: Config, deps: ApplyDeps): PluginHandles {
  validateConfig(config)
  const env = deps.env ?? process.env
  let source: () => Config = () => config
  let resolved: ResolvedConfig = resolveConfig(source(), env)
  let client: RefkitClient | null = null
  const rebuild = (): void => {
    resolved = resolveConfig(source(), env)
    client = null
  }
  const getConfig = (): ResolvedConfig => resolved
  const getClient = (): RefkitClient => (client ??= buildClient(resolved, deps.createClient))

  ctx.inject(['settings'], (scope) => {
    scope.settings.installSection(ctx, 'refkit', Config, config, {
      setSource: (current) => { source = current as () => Config; rebuild() },
      onChange: rebuild,
      validate: (value) => validateConfig(value as Config),
    })
  })

  ctx.inject(['systemPrompt'], (scope) => {
    scope.systemPrompt.section({ name: 'tool:refkit', order: 115, text: GUIDANCE })
  })

  ctx.tools.register(createSearchTool({ client: getClient, config: getConfig }))
  ctx.tools.register(createRightsTool())
  return { getClient, getConfig }
}

/** Cordis entry point. */
export function apply(ctx: Context, config: Config = {}): void {
  applyWith(ctx, config, { createClient: createRefkit })
}
