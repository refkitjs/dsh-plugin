// Asserts the browser bundle is the dsh loader's closure-factory artifact and
// carries the slot key, and requires nothing outside the shared externals
// table (scripts/client-externals.json, also read by tsdown.config.ts). Runs in
// CI after `pnpm build`.
import { readFileSync } from 'node:fs'
import externals from './client-externals.json' with { type: 'json' }

const js = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
// Rolldown re-wraps the banner/footer across lines, so compare with whitespace
// collapsed; the trailing //# sourceMappingURL line sits after the footer.
const squash = (s) => s.replace(/\s+/g, ' ').trim()
const body = squash(js.replace(/\/\/# sourceMappingURL=.*$/m, ''))
const banner = squash('window.__ModuleLoader__.load({ id: "@refkit/dsh-plugin", factory: (require) => {')
if (!body.startsWith(banner)) { console.error('client bundle: missing loader banner'); process.exit(1) }
if (!body.endsWith(squash('return module.exports; } });'))) { console.error('client bundle: missing loader footer'); process.exit(1) }
if (!js.includes('"refkit_search"')) { console.error('client bundle: slot key not found'); process.exit(1) }
// Every require("...") string-literal call in the bundle must name a table entry.
const allowed = new Set(externals)
const required = [...js.matchAll(/require\(\s*(["'`])(.*?)\1\s*\)/g)].map(m => m[2])
const bad = [...new Set(required.filter(id => !allowed.has(id)))]
if (bad.length > 0) { console.error('client bundle: requires outside the externals table', bad); process.exit(1) }
console.log('client bundle ok', js.length, 'bytes')
