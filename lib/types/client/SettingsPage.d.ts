/**
 * The refkit row's page on dsh's Plugins page (`plugins.row.config`): the ten
 * API keys and the search tuning, staged in dsh's shared settings form and
 * written on Save. Mirrors dsh's own web-search page (WebSearchCard): the
 * shared SettingsForm frame, SettingsSecretField for keys, SettingsValueField
 * for values. The logic lives in settings-controller.ts / settings-model.ts;
 * this component only lays the state out.
 * @module @refkit/dsh-plugin/client/SettingsPage
 */
import type { ReactNode } from 'react';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type RefkitSettingsFace } from './settings-controller.ts';
/** Props the renderer binds for the page. */
export type RefkitSettingsPageProps = PropsRuntime<'plugins.row.config'> & InjectFace<RefkitSettingsFace>;
/**
 * Render the row's one-liner or its settings form, as the Plugins page asks.
 * @param props - the view asked for, the page snapshot hook, and the form actions.
 * @returns the one-liner, or the form.
 */
export declare function RefkitSettingsPage(props: RefkitSettingsPageProps): ReactNode;
//# sourceMappingURL=SettingsPage.d.ts.map