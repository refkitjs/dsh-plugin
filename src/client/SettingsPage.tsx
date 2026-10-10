/**
 * The refkit row's page on dsh's Plugins page (`plugins.row.config`): the ten
 * API keys and the search tuning, staged in dsh's shared settings form and
 * written on Save. Mirrors dsh's own web-search page (WebSearchCard): the
 * shared SettingsForm frame, SettingsSecretField for keys, SettingsValueField
 * for values. The logic lives in settings-controller.ts / settings-model.ts;
 * this component only lays the state out.
 * @module @refkit/dsh-plugin/client/SettingsPage
 */

import type { ReactNode } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { Button, SettingsForm, SettingsSecretField, SettingsValueField, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { COPY } from './copy.ts'
import { NUMBER_FIELDS, TOGGLE_FIELDS, type RefkitSettingsFace, type RefkitSettingsState, type ToggleField } from './settings-controller.ts'
import { KEY_ENV_HINT, KEY_FIELDS_CLIENT, KEY_LABELS, NUMBER_BOUNDS, SOURCE_IDS, summaryText } from './settings-model.ts'
import { ensureStyle } from './styles.ts'

ensureStyle()

/** Props the renderer binds for the page. */
export type RefkitSettingsPageProps = PropsRuntime<'plugins.row.config'> & InjectFace<RefkitSettingsFace>

const S = COPY.settings

const FORM_LABELS = { unavailable: S.unavailable, readOnly: S.readOnly, saveFailed: S.saveFailed, save: S.save, saving: S.saving }

const fieldId = (field: string): string => `refkit-settings-${field}`

/** The form actions a row uses. */
type RowActions = Pick<RefkitSettingsFace, 'edit' | 'resetField' | 'remove'>

/**
 * Render the row's one-liner or its settings form, as the Plugins page asks.
 * @param props - the view asked for, the page snapshot hook, and the form actions.
 * @returns the one-liner, or the form.
 */
export function RefkitSettingsPage(props: RefkitSettingsPageProps): ReactNode {
  const state: RefkitSettingsState = props.useRefkitSettings((snapshot: RefkitSettingsState) => snapshot)
  if (props.view === 'summary') return summaryText(state.configured.length, KEY_FIELDS_CLIENT.length)
  // A removal in flight locks every control (the face ignores edits and saves
  // meanwhile). Save needs no extra lock: Remove runs only on a clean form, so
  // the frame's own `!dirty` keeps it disabled until the removal settles.
  const disabled = !state.writable || state.removing !== null
  const common = { overriddenLabel: S.overridden, resetLabel: S.reset, disabled }
  return (
    <SettingsForm labels={FORM_LABELS} state={state} onSave={props.save} onDiscard={props.discard}>
      <section className="rk-set-group">
        <h4 className="rk-set-heading">{S.keysHeading}</h4>
        <p className="rk-set-note">{S.keysNote}</p>
        {KEY_FIELDS_CLIENT.map(field => (
          <KeyRow key={field} field={field} state={state} disabled={disabled} actions={props} />
        ))}
      </section>
      <section className="rk-set-group">
        <h4 className="rk-set-heading">{S.searchHeading}</h4>
        {NUMBER_FIELDS.map(field => (
          <SettingsValueField
            key={field}
            id={fieldId(field)}
            label={S[field]}
            hint={S.range(S[`${field}Hint` as const], NUMBER_BOUNDS[field])}
            invalidLabel={S.invalidRange(NUMBER_BOUNDS[field])}
            numeric
            {...common}
            {...state.fields[field]}
            onEdit={(text) => { props.edit(field, text) }}
            onReset={() => { props.resetField(field) }}
          />
        ))}
        <SettingsValueField
          id={fieldId('sources')}
          label={S.sources}
          hint={S.sourcesHint}
          placeholder={S.sourcesPlaceholder}
          help={{ label: S.sourcesHelp, content: <p className="rk-set-ids">{SOURCE_IDS.join(', ')}</p> }}
          invalidLabel={S.sourcesInvalid}
          {...common}
          {...state.fields.sources}
          onEdit={(text) => { props.edit('sources', text) }}
          onReset={() => { props.resetField('sources') }}
        />
        <SettingsValueField
          id={fieldId('userAgent')}
          label={S.userAgent}
          hint={S.userAgentHint}
          invalidLabel=""
          {...common}
          {...state.fields.userAgent}
          onEdit={(text) => { props.edit('userAgent', text) }}
          onReset={() => { props.resetField('userAgent') }}
        />
        {TOGGLE_FIELDS.map(field => (
          <ToggleRow key={field} field={field} state={state} disabled={disabled} actions={props} />
        ))}
      </section>
    </SettingsForm>
  )
}

/** One key: the shared write-only control, and Remove while the Host holds a value. */
function KeyRow({ field, state, disabled, actions }: { field: string; state: RefkitSettingsState; disabled: boolean; actions: RowActions }): ReactNode {
  const configured = state.configured.includes(field)
  const removing = state.removing === field
  const label = KEY_LABELS[field] ?? field
  return (
    <div className="rk-set-key">
      <SettingsSecretField
        id={fieldId(field)}
        label={label}
        hint={S.keyHint(KEY_ENV_HINT[field] ?? [])}
        text={state.keys[field]?.text ?? ''}
        configured={configured}
        stateLabel={configured ? S.keySet : S.keyUnset}
        disabled={disabled}
        onEdit={(text) => { actions.edit(field, text) }}
      />
      {configured || removing
        ? (
            <div className="rk-set-key-actions">
              {state.removeFailed === field ? <span className="rk-set-error" role="status">{S.removeFailed}</span> : null}
              <Button
                variant="ghost"
                size="sm"
                aria-label={S.removeLabel(label)}
                title={state.dirty ? S.removeBlocked : undefined}
                disabled={disabled || state.dirty || state.saving}
                onClick={() => { actions.remove(field) }}
              >
                {removing ? S.removing : S.remove}
              </Button>
            </div>
          )
        : null}
    </div>
  )
}

/** One boolean: a switch staging `on` / `off`, with the same Overridden badge and reset as the value fields. */
function ToggleRow({ field, state, disabled, actions }: { field: ToggleField; state: RefkitSettingsState; disabled: boolean; actions: RowActions }): ReactNode {
  const staged = state.fields[field]
  return (
    <div className="rk-set-toggle">
      <div className="rk-set-toggle-text">
        <span className="rk-set-toggle-label">{S[field]}</span>
        <span className="rk-set-toggle-hint">{S[`${field}Hint` as const]}</span>
      </div>
      <div className="rk-set-toggle-side">
        {staged.overridden
          ? (
              <>
                <Tag tone="neutral">{S.overridden}</Tag>
                <Button variant="ghost" size="sm" disabled={disabled} onClick={() => { actions.resetField(field) }}>{S.reset}</Button>
              </>
            )
          : null}
        <Switch
          checked={staged.text === 'on'}
          label={S[field]}
          disabled={disabled}
          onChange={(next) => { actions.edit(field, next ? 'on' : 'off') }}
        />
      </div>
    </div>
  )
}
