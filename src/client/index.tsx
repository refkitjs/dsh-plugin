/**
 * Browser half of @refkit/dsh-plugin: one keyed tool.call.toolview entry for
 * refkit_search, and the refkit row's settings page on the Plugins page
 * (`plugins.row.config`). Every wiring step is logged, never thrown — the web
 * shell fails the whole boot when a plugin apply throws.
 * @module @refkit/dsh-plugin/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the ctx.configForms merge. The service is reached at runtime, never imported.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the Plugins page's SlotMap merge ('plugins.row.config').
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { RefkitCard } from './Card.tsx'
import { RefkitSettingsPage } from './SettingsPage.tsx'
import { createSettingsController, type RefkitSettingsController } from './settings-controller.ts'
import { SETTINGS_NS } from './settings-model.ts'

export const name = 'refkit-client'
export const inject = ['slots']

const REGISTRANT = '@refkit/dsh-plugin'

/** The refkit row's key on the Plugins page: `<package name>#<row id>` (row id = SETTINGS_NS). */
const ROW_CONFIG_KEY = '@refkit/dsh-plugin#refkit'

export function apply(ctx: ClientContext): void {
  try {
    ctx.inject(['slots'], (scope) => {
      registerToolview(scope)
      registerSettingsPage(scope)
    })
  } catch (error) {
    console.warn('[refkit] client apply failed', error)
  }
}

function registerToolview(scope: ClientContext): void {
  try {
    scope.slots.inject('tool.call.toolview', () => {
      // May run later, inside the declaring register() call — guard it here too.
      try {
        return scope.slots.register(
          { name: 'tool.call.toolview', key: 'refkit_search', priority: 0, registrant: REGISTRANT },
          RefkitCard,
        )
      } catch (error) {
        console.warn('[refkit] toolview registration failed', error)
        return () => {}
      }
    })
  } catch (error) {
    console.warn('[refkit] toolview registration failed', error)
  }
}

/**
 * The settings page, wired in an optional child: a required top-level
 * `configForms` inject would leave this entry pending — and fail the web boot —
 * wherever the settings domain is absent. As dsh's own settings pages do, the
 * page is registered only while the Host serves the `refkit` namespace.
 */
function registerSettingsPage(scope: ClientContext): void {
  try {
    scope.inject(['configForms'], (child) => {
      let controller: RefkitSettingsController | undefined
      try {
        const live = createSettingsController(child.configForms)
        controller = live
        child.effect(() => () => { live.dispose() }, 'refkit: settings form')
        child.effect(() => child.configForms.whileServed([SETTINGS_NS], () => mountSettingsPage(child, live)), 'refkit: settings page')
      } catch (error) {
        controller?.dispose()
        console.warn('[refkit] settings page wiring failed', error)
      }
    })
  } catch (error) {
    console.warn('[refkit] settings page wiring failed', error)
  }
}

/** Runs inside the settings mirror's notification, so it must never throw into it. */
function mountSettingsPage(child: ClientContext, controller: RefkitSettingsController): () => void {
  try {
    return child.slots.inject('plugins.row.config', () => {
      try {
        return child.slots.register(
          { name: 'plugins.row.config', key: ROW_CONFIG_KEY, registrant: REGISTRANT, inject: () => controller.face },
          RefkitSettingsPage,
        )
      } catch (error) {
        console.warn('[refkit] settings page registration failed', error)
        return () => {}
      }
    })
  } catch (error) {
    console.warn('[refkit] settings page registration failed', error)
    return () => {}
  }
}
