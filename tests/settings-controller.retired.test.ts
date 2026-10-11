import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeHost, settle } from './support/settings-host.ts'

/** dsh's REAL SettingsFormModel, evaluated from the primitives build (see the helper). */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => (await import('./support/primitives-form-model.ts')).primitivesFormModel())

/**
 * RETIRED_SOURCE_IDS is empty in production, so the wiring that lets a retired id through
 * is proved with a fake one injected here; every other export is the real module's. This
 * file holds only those tests, so tests/settings-controller.test.ts runs on the production tables.
 */
vi.mock('../src/client/settings-model.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/client/settings-model.ts')>()),
  RETIRED_SOURCE_IDS: ['retired-fake'],
}))

const { createSettingsController } = await import('../src/client/settings-controller.ts')
type Face = ReturnType<typeof createSettingsController>['face']

describe('createSettingsController with a retired source id', () => {
  let host: ReturnType<typeof fakeHost>
  let face: Face
  const state = () => face.hooks.refkitSettings.getSnapshot()

  beforeEach(() => {
    host = fakeHost(['braveToken', 'pexelsApiKey'])
    face = createSettingsController(host.configForms).face
  })

  it('saves a sources list that holds a retired id, so a stored one never blocks the page', async () => {
    face.edit('sources', 'met, retired-fake')
    expect(state().fields.sources.invalid).toBe(false)
    face.save()
    await settle()
    expect(state().failed).toBe(false)
    expect(host.calls.at(-1)!.ops).toEqual([{ op: 'set', path: ['sources'], value: ['met', 'retired-fake'] }])
  })

  it('still refuses an id that never shipped, and writes nothing', async () => {
    face.edit('sources', 'met, never-shipped')
    expect(state().fields.sources.invalid).toBe(true)
    face.save()
    await settle()
    expect(host.calls).toHaveLength(0)
  })
})
