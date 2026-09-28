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
import type { SettingsFieldSpec, SettingsFormPathOp, SettingsSecretSpec } from '@deepseek-ai/dsh-client-ui-primitives';
/** The Host settings namespace: the plugin's row id in `cordis.patch.yml`. */
export declare const SETTINGS_NS = "refkit";
/** Secret field → the providers it enables. Key order is the page's display order. */
export declare const KEY_LABELS: Readonly<Record<string, string>>;
/** The secret fields, in display order. */
export declare const KEY_FIELDS_CLIENT: readonly string[];
/** Environment fallbacks per key, first match wins (mirrors `KEY_ENV`). */
export declare const KEY_ENV_HINT: Readonly<Record<string, readonly string[]>>;
/** Every provider id `sources` accepts (mirrors `PROVIDER_IDS`). */
export declare const SOURCE_IDS: readonly string[];
/** Inclusive bounds and schema default of one whole-number field. */
export interface NumberBounds {
    min: number;
    max: number;
    default: number;
}
/** The number fields' schema bounds and defaults (mirrors the `Config` schema). */
export declare const NUMBER_BOUNDS: {
    readonly limit: {
        readonly min: 1;
        readonly max: 30;
        readonly default: 12;
    };
    readonly poolFactor: {
        readonly min: 1;
        readonly max: 4;
        readonly default: 2;
    };
    readonly deadlineMs: {
        readonly min: 1000;
        readonly max: 60000;
        readonly default: 15000;
    };
    readonly timeoutMs: {
        readonly min: 1000;
        readonly max: 60000;
        readonly default: 10000;
    };
};
export type NumberField = keyof typeof NUMBER_BOUNDS;
/**
 * A boolean field staged as `on` / `off` text, so a switch can drive the
 * shared text-staging model. A blank draft clears the field.
 * @param field - field name inside the namespace section.
 * @returns the field's conversion spec.
 */
export declare function settingsBooleanField(field: string): SettingsFieldSpec;
/**
 * A provider-id list staged as comma-separated text. Ids are matched
 * case-insensitively and deduplicated in order; an unknown id makes the draft
 * invalid, which blocks the save. A blank draft clears the field (every
 * enabled source).
 * @param field - field name inside the namespace section.
 * @param ids - the ids the field accepts.
 * @returns the field's conversion spec.
 */
export declare function settingsSourcesField(field: string, ids: readonly string[]): SettingsFieldSpec;
/**
 * A whole-number field that refuses a draft outside its bounds, so the page
 * marks the field instead of sending a write the Host would refuse. Formats
 * like the shared `settingsNumberField`; a blank draft clears the field.
 * @param field - field name inside the namespace section.
 * @param bounds - inclusive minimum and maximum.
 * @returns the field's conversion spec.
 */
export declare function settingsBoundedNumberField(field: string, bounds: Pick<NumberBounds, 'min' | 'max'>): SettingsFieldSpec;
/**
 * A write-only key control. The key lives in the `refkit` section itself, so
 * its staged text is written as one path op through the same form's `mutate`;
 * the model only calls this for a non-blank draft, so a blank field keeps the
 * stored key.
 * @param field - the secret field.
 * @param write - the form's mutate, bound by the caller.
 * @returns the secret spec.
 */
export declare function secretSpec(field: string, write: (ops: readonly SettingsFormPathOp[]) => Promise<boolean>): SettingsSecretSpec;
/** The part of a describe-mirror namespace view this module reads. */
export interface SecretPresenceView {
    readonly ns: string;
    readonly secrets?: readonly {
        readonly path: readonly string[];
        readonly set: boolean;
    }[];
}
/**
 * The keys the Host reports as stored for one namespace, from the describe
 * mirror's presence markers (values never ride the wire).
 * @param namespaces - the mirror's namespaces; undefined before its first answer.
 * @param ns - the namespace to read.
 * @param fields - the secret fields, in the order to report them.
 * @returns the stored fields, in `fields` order.
 */
export declare function configuredKeys(namespaces: readonly SecretPresenceView[] | undefined, ns: string, fields: readonly string[]): string[];
/**
 * The row's one-liner on the Plugins page.
 * @param configured - keys the Host holds.
 * @param total - keys the plugin accepts.
 * @returns the summary line.
 */
export declare function summaryText(configured: number, total: number): string;
//# sourceMappingURL=settings-model.d.ts.map