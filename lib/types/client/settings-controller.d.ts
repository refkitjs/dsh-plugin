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
import type { ConfigForms } from '@deepseek-ai/dsh-client-ui-settings/client';
import { type SettingsFieldState, type SettingsFormActions, type SettingsFormShell } from '@deepseek-ai/dsh-client-ui-primitives';
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
import { type NumberField } from './settings-model.ts';
export declare const NUMBER_FIELDS: readonly NumberField[];
export declare const TOGGLE_FIELDS: readonly ["rerank", "sourceConfidence"];
export type ToggleField = (typeof TOGGLE_FIELDS)[number];
export type SearchField = NumberField | ToggleField | 'sources' | 'userAgent';
/** What the page renders. */
export interface RefkitSettingsState extends SettingsFormShell {
    /** The staged search fields. */
    fields: Readonly<Record<SearchField, SettingsFieldState>>;
    /** The staged key drafts; blank on every load. */
    keys: Readonly<Record<string, SettingsFieldState>>;
    /** Keys the Host reports as stored, in display order. */
    configured: readonly string[];
    /** The key whose removal is crossing the wire. */
    removing: string | null;
    /** The key whose last removal the Host did not accept. */
    removeFailed: string | null;
}
/** The face the page's slot registration injects. */
export interface RefkitSettingsFace extends SettingsFormActions {
    hooks: {
        /** Page snapshot, bound by the renderer as `useRefkitSettings`. */
        refkitSettings: HostObservable<RefkitSettingsState>;
    };
    /** Unset one stored key now, outside the staged save. */
    remove: (field: string) => void;
}
export interface RefkitSettingsController {
    readonly face: RefkitSettingsFace;
    /** Release the form and mirror subscriptions. */
    dispose(): void;
}
/**
 * Bind the `refkit` namespace's shared form and stage the page's edits over it.
 * @param configForms - the settings domain service (`ctx.configForms`).
 * @returns the page face and its disposer.
 */
export declare function createSettingsController(configForms: Pick<ConfigForms, 'get' | 'describe'>): RefkitSettingsController;
//# sourceMappingURL=settings-controller.d.ts.map