/**
 * Browser half of @refkit/dsh-plugin: one keyed tool.call.toolview entry for
 * refkit_search. Every wiring step is logged, never thrown — the web shell
 * fails the whole boot when a plugin apply throws.
 * @module @refkit/dsh-plugin/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { RefkitCard } from './Card.tsx'

export const name = 'refkit-client'
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  try {
    ctx.inject(['slots'], (scope) => {
      try {
        scope.slots.inject('tool.call.toolview', () => {
          // May run later, inside the declaring register() call — guard it here too.
          try {
            return scope.slots.register(
              { name: 'tool.call.toolview', key: 'refkit_search', priority: 0, registrant: '@refkit/dsh-plugin' },
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
    })
  } catch (error) {
    console.warn('[refkit] client apply failed', error)
  }
}
