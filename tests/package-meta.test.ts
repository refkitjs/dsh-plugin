import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PLUGIN_VERSION } from '../src/config.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version?: string
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

describe('plugin version', () => {
  it('PLUGIN_VERSION (the default User-Agent) matches package.json', () => {
    expect(PLUGIN_VERSION).toBe(pkg.version)
  })
})

// Plugin storefronts (dsh-market, the awesome-dsh-plugin catalog) read screenshots.json
// next to package.json from the repository: 1-8 relative paths inside the repo.
describe('screenshots.json', () => {
  const read = () => JSON.parse(readFileSync(new URL('../screenshots.json', import.meta.url), 'utf8')) as unknown

  it('lists 1-8 relative paths to PNGs that exist in the repository', () => {
    const list = read()
    expect(Array.isArray(list)).toBe(true)
    const paths = list as string[]
    expect(paths.length).toBeGreaterThanOrEqual(1)
    expect(paths.length).toBeLessThanOrEqual(8)
    for (const path of paths) {
      expect(path, path).not.toMatch(/^\/|\.\.|^https?:/)
      expect(readFileSync(`${root}${path}`).subarray(0, 8).toString('hex'), path).toBe('89504e470d0a1a0a')
    }
  })

  it('keeps the screenshots out of the npm package', () => {
    for (const path of read() as string[]) {
      const dir = path.split('/')[0]
      expect(pkg.files?.some(entry => entry === dir || entry.startsWith(`${dir}/`)), path).toBe(false)
    }
  })
})
