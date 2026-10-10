/**
 * Pure logic behind the refkit settings page: the field specs dsh's shared
 * SettingsFormModel stages through (booleans, the `sources` id list, bounded
 * whole numbers), the secret spec that writes a key through the form's own
 * `mutate`, the key-presence read over the describe mirror, and the static
 * tables the page labels itself with.
 *
 * DOM-free and free of `@deepseek-ai/*` value imports, so it unit-tests in
 * Node. It must not import `src/config.ts` either — that would pull the 19
 * provider packages into the browser bundle — so the tables below restate
 * what the page needs, and tests/settings-model.test.ts pins each one to its
 * source in `src/config.ts`.
 * @module @refkit/dsh-plugin/client/settings-model
 */

import type { SettingsFieldSpec, SettingsFieldWrite, SettingsFormPathOp, SettingsSecretSpec } from '@deepseek-ai/dsh-client-ui-primitives'
import { COPY } from './copy.ts'

/** The Host settings namespace: the plugin's row id in `cordis.patch.yml`. */
export const SETTINGS_NS = 'refkit'

/** Secret field → the providers it enables. Key order is the page's display order. */
export const KEY_LABELS: Readonly<Record<string, string>> = {
  unsplashAccessKey: 'Unsplash (images)',
  pexelsApiKey: 'Pexels (images, video)',
  pixabayKey: 'Pixabay (images, video)',
  flickrApiKey: 'Flickr (images)',
  smithsonianApiKey: 'Smithsonian (images)',
  braveToken: 'Brave Search (images)',
  freesoundToken: 'Freesound (audio)',
  jamendoClientId: 'Jamendo (audio)',
  europeanaApiKey: 'Europeana (images)',
  openverseToken: 'Openverse (optional; higher rate limits)',
}

/** The secret fields, in display order. */
export const KEY_FIELDS_CLIENT: readonly string[] = Object.keys(KEY_LABELS)

/** Environment fallbacks per key, first match wins (mirrors `KEY_ENV`). */
export const KEY_ENV_HINT: Readonly<Record<string, readonly string[]>> = {
  unsplashAccessKey: ['REFKIT_UNSPLASH_KEY', 'UNSPLASH_KEY'],
  pexelsApiKey: ['REFKIT_PEXELS_KEY', 'PEXELS_KEY'],
  pixabayKey: ['REFKIT_PIXABAY_KEY', 'PIXABAY_KEY'],
  flickrApiKey: ['REFKIT_FLICKR_KEY', 'FLICKR_KEY'],
  smithsonianApiKey: ['REFKIT_SMITHSONIAN_KEY', 'SI_KEY'],
  braveToken: ['REFKIT_BRAVE_KEY', 'BRAVE_TOKEN'],
  freesoundToken: ['REFKIT_FREESOUND_KEY', 'FREESOUND_TOKEN'],
  jamendoClientId: ['REFKIT_JAMENDO_CLIENT_ID', 'JAMENDO_CLIENT_ID'],
  europeanaApiKey: ['REFKIT_EUROPEANA_KEY', 'EUROPEANA_KEY'],
  openverseToken: ['REFKIT_OPENVERSE_TOKEN'],
}

/** Every provider id `sources` accepts (mirrors `PROVIDER_IDS`). */
export const SOURCE_IDS: readonly string[] = [
  'artic', 'brave', 'europeana', 'flickr', 'freesound', 'gutendex', 'internet-archive', 'jamendo',
  'met', 'nailbook', 'openverse', 'openverse-audio', 'pexels', 'pexels-video', 'pixabay', 'pixabay-video',
  'poetrydb', 'polyhaven', 'ambientcg', 'rijksmuseum', 'smithsonian', 'unsplash', 'wikimedia-commons',
]

/** Inclusive bounds and schema default of one whole-number field. */
export interface NumberBounds {
  min: number
  max: number
  default: number
}

/** The number fields' schema bounds and defaults (mirrors the `Config` schema). */
export const NUMBER_BOUNDS = {
  limit: { min: 1, max: 30, default: 12 },
  poolFactor: { min: 1, max: 4, default: 2 },
  deadlineMs: { min: 1000, max: 60000, default: 15000 },
  timeoutMs: { min: 1000, max: 60000, default: 10000 },
} as const satisfies Record<string, NumberBounds>

export type NumberField = keyof typeof NUMBER_BOUNDS

/**
 * A boolean field staged as `on` / `off` text, so a switch can drive the
 * shared text-staging model. A blank draft clears the field.
 * @param field - field name inside the namespace section.
 * @returns the field's conversion spec.
 */
export function settingsBooleanField(field: string): SettingsFieldSpec {
  return {
    field,
    format: (value) => (value === true ? 'on' : value === false ? 'off' : ''),
    parse: (text): SettingsFieldWrite | undefined => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      if (trimmed === 'on') return { kind: 'set', value: true }
      if (trimmed === 'off') return { kind: 'set', value: false }
      return undefined
    },
  }
}

/**
 * A provider-id list staged as comma-separated text. Ids are matched
 * case-insensitively and deduplicated in order; an unknown id makes the draft
 * invalid, which blocks the save. A blank draft clears the field (every
 * enabled source).
 * @param field - field name inside the namespace section.
 * @param ids - the ids the field accepts.
 * @returns the field's conversion spec.
 */
export function settingsSourcesField(field: string, ids: readonly string[]): SettingsFieldSpec {
  const known = new Set(ids)
  return {
    field,
    format: (value) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').join(', ') : ''),
    parse: (text): SettingsFieldWrite | undefined => {
      const tokens = text.split(/[\s,]+/).map(token => token.toLowerCase()).filter(token => token.length > 0)
      if (tokens.length === 0) return { kind: 'clear' }
      if (tokens.some(token => !known.has(token))) return undefined
      return { kind: 'set', value: [...new Set(tokens)] }
    },
  }
}

/**
 * A whole-number field that refuses a draft outside its bounds, so the page
 * marks the field instead of sending a write the Host would refuse. Formats
 * like the shared `settingsNumberField`; a blank draft clears the field.
 * @param field - field name inside the namespace section.
 * @param bounds - inclusive minimum and maximum.
 * @returns the field's conversion spec.
 */
export function settingsBoundedNumberField(field: string, bounds: Pick<NumberBounds, 'min' | 'max'>): SettingsFieldSpec {
  return {
    field,
    format: (value) => (typeof value === 'number' ? String(value) : ''),
    parse: (text): SettingsFieldWrite | undefined => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      const value = Number(trimmed)
      return Number.isSafeInteger(value) && value >= bounds.min && value <= bounds.max ? { kind: 'set', value } : undefined
    },
  }
}

/**
 * A write-only key control. The key lives in the `refkit` section itself, so
 * its staged text is written as one path op through the same form's `mutate`;
 * the model only calls this for a non-blank draft, so a blank field keeps the
 * stored key.
 * @param field - the secret field.
 * @param write - the form's mutate, bound by the caller.
 * @returns the secret spec.
 */
export function secretSpec(field: string, write: (ops: readonly SettingsFormPathOp[]) => Promise<boolean>): SettingsSecretSpec {
  return { field, write: (text) => write([{ op: 'set', path: [field], value: text }]) }
}

/** The part of a describe-mirror namespace view this module reads. */
export interface SecretPresenceView {
  readonly ns: string
  readonly secrets?: readonly { readonly path: readonly string[]; readonly set: boolean }[]
}

/**
 * The keys the Host reports as stored for one namespace, from the describe
 * mirror's presence markers (values never ride the wire).
 * @param namespaces - the mirror's namespaces; undefined before its first answer.
 * @param ns - the namespace to read.
 * @param fields - the secret fields, in the order to report them.
 * @returns the stored fields, in `fields` order.
 */
export function configuredKeys(namespaces: readonly SecretPresenceView[] | undefined, ns: string, fields: readonly string[]): string[] {
  const secrets = namespaces?.find(view => view.ns === ns)?.secrets ?? []
  const set = new Set(secrets.filter(secret => secret.set && secret.path.length === 1).map(secret => secret.path[0]))
  return fields.filter(field => set.has(field))
}

/**
 * The row's one-liner on the Plugins page.
 * @param configured - keys the Host holds.
 * @param total - keys the plugin accepts.
 * @returns the summary line.
 */
export function summaryText(configured: number, total: number): string {
  return COPY.settings.summary(configured, total)
}
