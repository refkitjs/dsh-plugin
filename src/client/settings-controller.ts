/**
 * The refkit settings page's staged form over the `refkit` settings namespace.
 *
 * Mirrors dsh's own web-search page controller
 * (`@deepseek-ai/dsh-client-ui-settings-web-search`, WebSearchCardController):
 * one shared SettingsFormModel over `configForms.get(ns)`, a projection bound
 * as the page's `useRefkitSettings` hook, and the form's actions injected
 * beside it. The difference is where keys go: refkit's keys are fields of its
 * own section, so each staged key is written through the same form's
 * `mutate`, and whether one is stored comes from the describe mirror's
 * presence markers (a key's value never rides a response).
 * @module @refkit/dsh-plugin/client/settings-controller
 */

import type { ConfigForms } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  SettingsFormModel, settingsTextField,
  type SettingsFieldState, type SettingsFormActions, type SettingsFormPathOp, type SettingsFormScope, type SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import {
  KEY_FIELDS_CLIENT, NUMBER_BOUNDS, SETTINGS_NS, SOURCE_IDS,
  configuredKeys, secretSpec, settingsBooleanField, settingsBoundedNumberField, settingsSourcesField,
  type NumberField,
} from './settings-model.ts'

export const NUMBER_FIELDS: readonly NumberField[] = ['limit', 'poolFactor', 'deadlineMs', 'timeoutMs']
export const TOGGLE_FIELDS = ['rerank', 'sourceConfidence'] as const
export type ToggleField = (typeof TOGGLE_FIELDS)[number]
export type SearchField = NumberField | ToggleField | 'sources' | 'userAgent'
const SEARCH_FIELDS: readonly SearchField[] = [...NUMBER_FIELDS, 'sources', 'userAgent', ...TOGGLE_FIELDS]

/** What the page renders. */
export interface RefkitSettingsState extends SettingsFormShell {
  /** The staged search fields. */
  fields: Readonly<Record<SearchField, SettingsFieldState>>
  /** The staged key drafts; blank on every load. */
  keys: Readonly<Record<string, SettingsFieldState>>
  /** Keys the Host reports as stored, in display order. */
  configured: readonly string[]
  /** The key whose removal is crossing the wire. */
  removing: string | null
  /** The key whose last removal the Host did not accept. */
  removeFailed: string | null
}

/** The face the page's slot registration injects. */
export interface RefkitSettingsFace extends SettingsFormActions {
  hooks: {
    /** Page snapshot, bound by the renderer as `useRefkitSettings`. */
    refkitSettings: HostObservable<RefkitSettingsState>
  }
  /** Unset one stored key now, outside the staged save. */
  remove: (field: string) => void
}

export interface RefkitSettingsController {
  readonly face: RefkitSettingsFace
  /** Release the form and mirror subscriptions. */
  dispose(): void
}

/** The published projection plus the replace the controller needs. */
type ProjectionStore = HostObservable<RefkitSettingsState> & { set(next: RefkitSettingsState): void }

/**
 * Bind the `refkit` namespace's shared form and stage the page's edits over it.
 * @param configForms - the settings domain service (`ctx.configForms`).
 * @returns the page face and its disposer.
 */
export function createSettingsController(configForms: Pick<ConfigForms, 'get' | 'describe'>): RefkitSettingsController {
  // ConfigForm satisfies the model's scope face; `mutate` takes the wire op type,
  // so writes go through the scope-typed view.
  const scope: SettingsFormScope<Record<string, unknown>> = configForms.get<Record<string, unknown>>(SETTINGS_NS)
  const describe = configForms.describe()
  const write = (ops: readonly SettingsFormPathOp[]): Promise<boolean> => scope.mutate(ops)
  const model = new SettingsFormModel(scope, [
    ...NUMBER_FIELDS.map(field => settingsBoundedNumberField(field, NUMBER_BOUNDS[field])),
    settingsSourcesField('sources', SOURCE_IDS),
    settingsTextField('userAgent'),
    ...TOGGLE_FIELDS.map(field => settingsBooleanField(field)),
  ], KEY_FIELDS_CLIENT.map(field => secretSpec(field, write)))

  const readConfigured = (): readonly string[] => configuredKeys(describe.getSnapshot().view?.namespaces, SETTINGS_NS, KEY_FIELDS_CLIENT)
  let configured = readConfigured()
  let removing: string | null = null
  let removeFailed: string | null = null
  let disposed = false

  const project = (): RefkitSettingsState => ({
    ...model.shell(),
    fields: Object.fromEntries(SEARCH_FIELDS.map(field => [field, model.field(field)])) as Record<SearchField, SettingsFieldState>,
    keys: Object.fromEntries(KEY_FIELDS_CLIENT.map(field => [field, model.field(field)])),
    configured,
    removing,
    removeFailed,
  })
  const store: ProjectionStore = model.bind(project)
  const publish = (): void => { if (!disposed) store.set(project()) }

  // A key write or removal changes the namespace revision, so the form's own
  // subscription republishes too; this one also catches a marker that moved
  // without a section change reaching this form.
  const offDescribe = describe.subscribe(() => {
    const next = readConfigured()
    if (next.length === configured.length && next.every((field, i) => field === configured[i])) return
    configured = next
    publish()
  })

  const actions = model.actions()
  const remove = (field: string): void => {
    const shell = model.shell()
    // A removal is its own write: with drafts staged it would move the revision
    // their save is fenced on, so the page offers it only on a clean form.
    if (disposed || removing !== null || !KEY_FIELDS_CLIENT.includes(field) || !shell.available || !shell.writable || shell.dirty || shell.saving) return
    removing = field
    removeFailed = null
    publish()
    const settle = (accepted: boolean): void => {
      removing = null
      removeFailed = accepted ? null : field
      publish()
    }
    write([{ op: 'unset', path: [field] }]).then(settle, (error: unknown) => {
      console.warn('[refkit] removing the stored key failed', field, error)
      settle(false)
    })
  }

  const face: RefkitSettingsFace = {
    hooks: { refkitSettings: store },
    ...actions,
    discard: () => {
      const stale = removeFailed !== null
      removeFailed = null
      actions.discard()
      if (stale) publish()
    },
    remove,
  }

  return {
    face,
    dispose: () => {
      if (disposed) return
      disposed = true
      offDescribe()
      model.dispose()
    },
  }
}
