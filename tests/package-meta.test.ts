import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  icon?: string
  exports?: Record<string, unknown>
  files?: string[]
  engines?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function readLocale(lang: string): unknown {
  return JSON.parse(readFileSync(new URL(`../locale/${lang}.json`, import.meta.url), 'utf8'))
}

describe('locale files', () => {
  for (const lang of ['en', 'zh']) {
    it(`${lang}.json has exactly { meta: { title, description } }`, () => {
      const doc = readLocale(lang) as { meta?: { title?: string; description?: string } }
      expect(Object.keys(doc)).toEqual(['meta'])
      expect(Object.keys(doc.meta ?? {}).sort()).toEqual(['description', 'title'])
      expect(doc.meta?.title).toBe('refkit')
      expect(doc.meta?.description).toBeTypeOf('string')
      expect((doc.meta?.description ?? '').length).toBeGreaterThan(0)
      expect(doc.meta?.description).toContain('24')
    })
  }
})

describe('package.json display metadata', () => {
  it('exports the locale glob', () => {
    expect(pkg.exports?.['./locale/*.json']).toBe('./locale/*.json')
  })
  it('declares an icon and the file exists as an svg', () => {
    expect(pkg.icon).toBe('./icon.svg')
    const iconPath = `${root}icon.svg`
    expect(existsSync(iconPath)).toBe(true)
    expect(readFileSync(iconPath, 'utf8').trim().startsWith('<svg')).toBe(true)
  })
  it('lists the locale files and the icon in files', () => {
    expect(pkg.files).toContain('locale/*.json')
    expect(pkg.files).toContain('icon.svg')
  })
})

// dsh 0.2.1 decides compatibility from engines.dsh alone; dsh 0.1.7 and pnpm read the
// dsh-* peers. Both must name the same releases, or one host refuses what the other loads.
describe('dsh compatibility range', () => {
  const DSH_RANGE = '^0.1.7-rc.2 || ^0.2.1-rc.2'

  it('declares dsh 0.1.7 and 0.2.1 in engines.dsh', () => {
    expect(pkg.engines?.dsh).toBe(DSH_RANGE)
  })

  it('gives every dsh-* peer the same range', () => {
    const dshPeers = Object.entries(pkg.peerDependencies ?? {}).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))
    expect(dshPeers.length).toBeGreaterThan(0)
    for (const [name, range] of dshPeers) expect(range, name).toBe(DSH_RANGE)
  })
})
