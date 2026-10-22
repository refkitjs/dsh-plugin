import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRefkit, defineProvider, type EmittedReference, type LicenseId } from '@refkit/core'
import type { ToolCallCommonProps, ToolCallOwnerProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { RefkitCard } from '../src/client/Card.tsx'
import { resolveConfig } from '../src/config.ts'
import type { SearchOutcome } from '../src/core/outcome.ts'
import { cardMeta, renderSearch } from '../src/render.ts'
import { runSearch } from '../src/tools/search.ts'

type Phase<P extends ToolCallOwnerProps['phase']> = Extract<ToolCallOwnerProps, { phase: P }>['block']
type ResultBlock = Phase<'result'>

const CALL_ID = 'call-1'
const ARGS = '{"query":"tidal pool"}'

/** The owner currency the tool tree hands every atomic view; the card reads none of it. */
const common: ToolCallCommonProps = {
  useDisclosure: () => ({ expanded: false, setExpanded: () => {}, toggle: () => {} }),
  callId: CALL_ID,
  toolName: 'refkit_search',
  openFile: () => {},
  loadImage: async () => '',
}

const head = { callId: CALL_ID, name: 'refkit_search', turn: 1, step: 1, time: 0, subCalls: [] }

function result(block: Pick<ResultBlock, 'content' | 'isError'> & Partial<ResultBlock>): ToolCallOwnerProps {
  return {
    ...common,
    phase: 'result',
    block: { kind: 'tool-result', seq: 2, time: 0, callId: CALL_ID, call: { name: 'refkit_search', argsRaw: ARGS }, callTime: 0, subCalls: [], ...block },
  }
}

const render = (props: ToolCallOwnerProps): string => renderToStaticMarkup(<RefkitCard {...props} />)
const count = (markup: string, needle: string): number => markup.split(needle).length - 1

const emit = (url: string, license: LicenseId, licenseVersion?: string): EmittedReference => ({
  modality: 'image',
  title: `title ${url}`,
  sourceUrl: url,
  rights: { license, licenseVersion, author: 'Ada', rehostPolicy: 'cache-allowed', raw: { sourceTerms: 't', sourceUrl: url } },
  thumbnail: { url: `${url}/t.jpg` },
  visual: { width: 800, height: 600 },
})

/** A refkit_search outcome from the real runSearch over one in-memory provider with two references. */
async function searchOutcome(): Promise<SearchOutcome> {
  const providers = [defineProvider({ id: 'museum', modalities: ['image'], search: async () => [emit('https://museum.example/1', 'CC-BY', '4.0'), emit('https://museum.example/2', 'CC0-1.0')] })]
  const client = createRefkit({ providers, rerank: false, sourceConfidence: false, userAgent: false })
  const config = resolveConfig({}, {})
  return runSearch({ query: 'tidal pool' }, { client: () => client, config: () => config })
}

/** The grid the card draws for searchOutcome(): its header, then one tile per reference with its license chip. */
function expectGrid(markup: string): void {
  expect(markup).toContain('<span class="rk-head-title">2 references for “tidal pool”</span>')
  const tiles = markup.split('class="rk-tile"').slice(1)
  expect(tiles).toHaveLength(2)
  expect(tiles[0]).toMatch(/class="rk-chip"[^>]*>museum</)
  expect(tiles[0]).toMatch(/class="rk-chip"[^>]*>CC-BY 4\.0</)
  expect(tiles[0]).toContain('https://museum.example/1/t.jpg')
  expect(tiles[1]).toMatch(/class="rk-chip"[^>]*>CC0-1\.0</)
  expect(tiles[1]).toContain('https://museum.example/2/t.jpg')
  expect(markup).not.toContain('rk-skeleton')
}

describe('RefkitCard phase dispatch', () => {
  it('preparing: says it is preparing and draws no skeleton grid', () => {
    const markup = render({ ...common, phase: 'preparing', block: { ...head, phase: 'preparing' } })
    expect(markup).toContain('Preparing refkit search…')
    expect(markup).not.toContain('rk-skeleton')
  })

  it('start: says it is searching over six skeleton tiles', () => {
    const markup = render({ ...common, phase: 'start', block: { ...head, phase: 'start', argsRaw: ARGS } })
    expect(markup).toContain('Searching refkit sources…')
    expect(count(markup, 'class="rk-skeleton"')).toBe(6)
  })

  it('result: heads the grid with the count and query, one tile per reference with its license chip', async () => {
    // As the tool emits it: the rendered text as content, cardMeta as the presentation metadata.
    const outcome = await searchOutcome()
    expectGrid(render(result({ content: [{ type: 'text', text: renderSearch(outcome) }], isError: false, meta: cardMeta(outcome) })))
  })

  it('result without metadata whose text is the outcome JSON: draws the same grid', async () => {
    const outcome = await searchOutcome()
    expectGrid(render(result({ content: [{ type: 'text', text: JSON.stringify(cardMeta(outcome)) }], isError: false })))
  })

  it('result with isError: shows the error text, or the error name and code when there is none', () => {
    const withText = render(result({ content: [{ type: 'text', text: 'all 2 sources failed: museum: boom' }], isError: true }))
    expect(withText).toBe('<div class="rk-error">all 2 sources failed: museum: boom</div>')
    const bare = render(result({ content: [], isError: true, error: { name: 'ToolTimeout', code: 'timeout' } }))
    expect(bare).toBe('<div class="rk-error">ToolTimeout: timeout</div>')
  })

  it('result that is not a search outcome: falls back to its plain text', () => {
    const markup = render(result({ content: [{ type: 'text', text: 'search finished without card metadata' }], isError: false, meta: { version: 'drifted' } }))
    expect(markup).toBe('<div class="rk-plain">search finished without card metadata</div>')
  })
})

/** A card for these raw tiles, as the presentation metadata carries them. */
function cardOf(references: Record<string, unknown>[]): string {
  const meta = { query: 'q', modalities: ['image', 'video', 'audio'], count: references.length, references, sources: [], warnings: [] }
  return render(result({ content: [], isError: false, meta }))
}

const tileOf = (id: string, modality: string, extra: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ id, modality, source: 'src', canonicalUrl: `https://x.example/${id}`, license: 'CC0-1.0', title: id, ...extra })

describe('RefkitCard media by modality', () => {
  it('video: draws the poster under a ▶ overlay, never the mp4 preview, with an m:ss duration badge', () => {
    const markup = cardOf([tileOf('v1', 'video', { thumbnail: 'https://x.example/poster.jpg', preview: 'https://x.example/clip.mp4', durationSec: 12, width: 640, height: 360 })])
    expect(markup).toMatch(/<img [^>]*src="https:\/\/x\.example\/poster\.jpg"/)
    expect(markup).not.toContain('clip.mp4')
    expect(markup).toMatch(/class="rk-play"[^>]*>▶</)
    expect(markup).toMatch(/class="rk-duration"[^>]*>0:12</)
    expect(markup).toContain('aspect-ratio:640 / 360')
  })

  it('video without a poster: the ▶ glyph and no image, still never the mp4', () => {
    const markup = cardOf([tileOf('v2', 'video', { preview: 'https://x.example/clip.mp4', durationSec: 75 })])
    expect(markup).not.toContain('<img')
    expect(markup).not.toContain('clip.mp4')
    expect(markup).toMatch(/class="rk-media-glyph"[^>]*>▶</)
    expect(markup).toMatch(/class="rk-duration"[^>]*>1:15</)
  })

  it('audio: draws its album art over the ♪ fallback, never the audio file, with an m:ss duration badge', () => {
    const markup = cardOf([tileOf('a1', 'audio', { thumbnail: 'https://x.example/art.jpg', preview: 'https://x.example/song.mp3', durationSec: 65.4 })])
    expect(markup).toMatch(/<img [^>]*src="https:\/\/x\.example\/art\.jpg"/)
    expect(markup).toMatch(/class="rk-media-glyph"[^>]*>♪</)
    expect(markup).not.toContain('song.mp3')
    expect(markup).toMatch(/class="rk-duration"[^>]*>1:05</)
  })

  it('audio without art or duration: the ♪ glyph only', () => {
    const markup = cardOf([tileOf('a2', 'audio', { preview: 'https://x.example/song.mp3' })])
    expect(markup).not.toContain('<img')
    expect(markup).toMatch(/class="rk-media-glyph"[^>]*>♪</)
    expect(markup).not.toContain('rk-duration')
  })

  it('image: no duration badge and no play overlay', () => {
    const markup = cardOf([tileOf('i1', 'image', { thumbnail: 'https://x.example/i.jpg', durationSec: 9 })])
    expect(markup).toMatch(/<img [^>]*src="https:\/\/x\.example\/i\.jpg"/)
    expect(markup).not.toContain('rk-duration')
    expect(markup).not.toContain('rk-play')
  })

  it('a card persisted by 0.2.0, whose tiles name their source `provider`, still renders with its source chip', () => {
    const { source: _source, ...legacy } = tileOf('o1', 'image', { thumbnail: 'https://x.example/o.jpg', license: 'CC-BY', licenseVersion: '4.0' })
    const markup = cardOf([{ ...legacy, provider: 'openverse' }])
    const tiles = markup.split('class="rk-tile"').slice(1)
    expect(tiles).toHaveLength(1)
    expect(tiles[0]).toMatch(/class="rk-chip"[^>]*>openverse</)
    expect(tiles[0]).toMatch(/class="rk-chip"[^>]*>CC-BY 4\.0</)
    expect(tiles[0]).toContain('https://x.example/o.jpg')
  })
})
