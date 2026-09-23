// Live smoke: mount the built host half on a fake Cordis context and run one
// keyless search. Needs network; gated so CI never runs it.
//   REFKIT_LIVE=1 node scripts/smoke-host.mjs "forest path"
import { apply, renderSearch, runSearch, resolveConfig, PROVIDER_IDS } from '../lib/index.js'

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
