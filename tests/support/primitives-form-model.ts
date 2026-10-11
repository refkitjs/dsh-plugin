import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

/**
 * Module factory for `vi.mock('@deepseek-ai/dsh-client-ui-primitives', …)`
 * that yields dsh's REAL SettingsFormModel. The package ships only its browser
 * build (lib/index.js), whose imports (CSS modules, clsx, shiki,
 * @deepseek-ai/dsh-client-store, …) the platform supplies and this dev tree
 * does not install, so vitest cannot load the module as a whole. This
 * evaluates the build's own form-model region verbatim, with a minimal
 * createSnapshotStore standing in for the one import that region uses.
 *
 * vi.mock is hoisted above imports, so a test file reaches this through a
 * dynamic import inside its factory:
 * `vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => (await import('./support/primitives-form-model.ts')).primitivesFormModel())`.
 * @returns the mocked module's exports.
 */
export function primitivesFormModel(): Record<string, unknown> {
  const built = createRequire(import.meta.url).resolve('@deepseek-ai/dsh-client-ui-primitives')
  const source = readFileSync(built, 'utf8')
  const start = source.indexOf('//#region lib/types/settings-form/form-model.js')
  const end = source.indexOf('//#endregion', start)
  if (start < 0 || end < 0) throw new Error('form-model region not found in the primitives build')
  const createSnapshotStore = <T>(initial: T) => {
    let snapshot = initial
    const listeners = new Set<() => void>()
    return {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
      set: (next: T) => { snapshot = next; for (const listener of [...listeners]) listener() },
    }
  }
  const load = new Function('createSnapshotStore', `${source.slice(start, end)}\nreturn { SettingsFormModel, settingsNumberField, settingsTextField }`)
  return load(createSnapshotStore) as Record<string, unknown>
}
