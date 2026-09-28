// Host smoke. Always: the built host bundle loads and exports the Cordis
// plugin surface (name, inject, apply, Config) — CI runs this after the build.
// Live part: mount the host half on a fake Cordis context and run one keyless
// search. Needs network; gated so CI never runs it.
//   REFKIT_LIVE=1 node scripts/smoke-host.mjs "forest path"
import { apply, name, inject, Config, renderSearch, runSearch, resolveConfig, PROVIDER_IDS } from '../lib/index.js'

const surface = [
  ["name === 'refkit'", name === 'refkit'],
  ["inject[0] === 'tools'", Array.isArray(inject) && inject[0] === 'tools'],
  ["typeof apply === 'function'", typeof apply === 'function'],
  ["typeof Config === 'function'", typeof Config === 'function'],
]
const broken = surface.filter(([, ok]) => !ok).map(([check]) => check)
if (broken.length > 0) {
  console.error(`host bundle: lib/index.js export check failed: ${broken.join('; ')}`)
  process.exit(1)
}
console.log('host bundle ok')

if (process.env.REFKIT_LIVE !== '1') {
  console.log('skipped (set REFKIT_LIVE=1 to run against real sources)')
  process.exit(0)
}

const registered = []
const ctx = {
  inject: () => {},
  effect: () => () => {},
  tools: { register: (def) => { registered.push(def.name); return () => {} } },
}
apply(ctx, {})
console.log('registered tools:', registered.join(', '))
console.log('registry ids:', PROVIDER_IDS.length)

const { createRefkit } = await import('@refkit/core')
const { buildClient } = await import('../lib/index.js')
const cfg = resolveConfig({ sources: ['openverse'], limit: 5 })
const client = buildClient(cfg, createRefkit)
const query = process.argv[2] ?? 'forest path'
const out = await runSearch({ query, intent: 'commercial-product' }, { client: () => client, config: () => cfg })
console.log(renderSearch(out))
