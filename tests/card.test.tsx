import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRefkit, defineProvider, type EmittedReference, type LicenseId } from '@refkit/core'
import type { ToolCallCommonProps, ToolCallOwnerProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { RefkitCard } from '../src/client/Card.tsx'
import { resolveConfig } from '../src/config.ts'
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

/** A settled refkit_search block as the tool emits it: rendered text content plus cardMeta presentation metadata. */
async function settledSearch(): Promise<ToolCallOwnerProps> {
  const providers = [defineProvider({ id: 'museum', modalities: ['image'], search: async () => [emit('https://museum.example/1', 'CC-BY', '4.0'), emit('https://museum.example/2', 'CC0-1.0')] })]
  const client = createRefkit({ providers, rerank: false, sourceConfidence: false, userAgent: false })
  const config = resolveConfig({}, {})
  const outcome = await runSearch({ query: 'tidal pool' }, { client: () => client, config: () => config })
  return result({ content: [{ type: 'text', text: renderSearch(outcome) }], isError: false, meta: cardMeta(outcome) })
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
    const markup = render(await settledSearch())
    expect(markup).toContain('<span class="rk-head-title">2 references for “tidal pool”</span>')
    const tiles = markup.split('class="rk-tile"').slice(1)
    expect(tiles).toHaveLength(2)
    expect(tiles[0]).toContain('<span class="rk-chip" title="CC-BY">CC-BY 4.0</span>')
    expect(tiles[0]).toContain('https://museum.example/1/t.jpg')
    expect(tiles[1]).toContain('<span class="rk-chip" title="CC0-1.0">CC0-1.0</span>')
    expect(tiles[1]).toContain('https://museum.example/2/t.jpg')
    expect(markup).not.toContain('rk-skeleton')
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
