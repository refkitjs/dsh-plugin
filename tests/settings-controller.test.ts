import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeHost, settle } from './support/settings-host.ts'

/** dsh's REAL SettingsFormModel, evaluated from the primitives build (see the helper). */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => (await import('./support/primitives-form-model.ts')).primitivesFormModel())

const { createSettingsController } = await import('../src/client/settings-controller.ts')
type Controller = ReturnType<typeof createSettingsController>
type Face = Controller['face']

describe('createSettingsController', () => {
  let host: ReturnType<typeof fakeHost>
  let controller: Controller
  let face: Face
  const state = () => face.hooks.refkitSettings.getSnapshot()

  beforeEach(() => {
    host = fakeHost(['braveToken', 'pexelsApiKey'])
    controller = createSettingsController(host.configForms)
    face = controller.face
  })

  it('reports stored keys from the mirror and blank drafts', () => {
    expect(state().configured).toEqual(['pexelsApiKey', 'braveToken'])
    expect(state().keys.pexelsApiKey!.text).toBe('')
    expect(state().fields.limit.text).toBe('12')
  })

  it('saves after Remove when a blank key draft was staged before it', async () => {
    face.edit('unsplashAccessKey', 'x')
    face.edit('unsplashAccessKey', '')
    expect(state().dirty).toBe(false)
    face.remove('braveToken')
    await settle()
    expect(state().configured).toEqual(['pexelsApiKey'])
    face.edit('limit', '20')
    face.save()
    await settle()
    expect(state().failed).toBe(false)
    expect(host.user.limit).toBe(20)
    expect(host.calls.at(-1)).toMatchObject({ ops: [{ op: 'set', path: ['limit'], value: 20 }], expected: 2, accepted: true })
  })

  it('saves after Remove when a switch was flipped twice before it', async () => {
    face.edit('rerank', 'off')
    face.edit('rerank', 'on')
    expect(state().dirty).toBe(false)
    face.remove('braveToken')
    await settle()
    face.edit('limit', '20')
    face.save()
    await settle()
    expect(state().failed).toBe(false)
    expect(host.user.limit).toBe(20)
  })

  it('ignores edits, resets and saves while a removal is in flight, then lands the removal', async () => {
    const release = host.holdWrites()
    face.remove('braveToken')
    expect(state().removing).toBe('braveToken')
    face.edit('poolFactor', '3')
    face.resetField('limit')
    face.save()
    expect(state().fields.poolFactor.text).toBe('2')
    expect(state().dirty).toBe(false)
    release()
    await settle()
    expect(host.calls.map(call => call.ops)).toEqual([[{ op: 'unset', path: ['braveToken'] }]])
    expect(state().removing).toBeNull()
    expect(state().configured).toEqual(['pexelsApiKey'])
    // Editing resumes once the removal settled, fenced on the new revision.
    face.edit('poolFactor', '3')
    face.save()
    await settle()
    expect(state().failed).toBe(false)
    expect(host.user.poolFactor).toBe(3)
  })

  it('never writes a blank key draft', async () => {
    face.edit('pexelsApiKey', '   ')
    face.edit('limit', '20')
    face.save()
    await settle()
    expect(host.calls).toHaveLength(1)
    expect(host.calls[0]!.ops).toEqual([{ op: 'set', path: ['limit'], value: 20 }])
    expect(host.stored.has('pexelsApiKey')).toBe(true)
  })

  it('writes a typed key through the form and reports it set, with the draft blank again', async () => {
    face.edit('unsplashAccessKey', ' uk-1 ')
    face.save()
    await settle()
    expect(host.calls[0]!.ops).toEqual([{ op: 'set', path: ['unsplashAccessKey'], value: 'uk-1' }])
    expect(state().configured).toEqual(['unsplashAccessKey', 'pexelsApiKey', 'braveToken'])
    expect(state().keys.unsplashAccessKey!.text).toBe('')
  })

  it('refuses Remove while edits are staged', async () => {
    face.edit('limit', '20')
    face.remove('braveToken')
    await settle()
    expect(host.calls).toHaveLength(0)
    expect(state().removing).toBeNull()
  })

  it('reports a refused removal, keeps the key, and unlocks the form', async () => {
    const form = (host.configForms as unknown as { get: () => { mutate: (...args: unknown[]) => Promise<boolean> } }).get()
    form.mutate = async () => false
    face.remove('braveToken')
    await settle()
    expect(state().removeFailed).toBe('braveToken')
    expect(state().removing).toBeNull()
    expect(state().configured).toEqual(['pexelsApiKey', 'braveToken'])
    face.edit('limit', '20')
    expect(state().dirty).toBe(true)
  })
})
