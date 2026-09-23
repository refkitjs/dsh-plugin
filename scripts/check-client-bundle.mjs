// Asserts the browser bundle is the dsh loader's closure-factory artifact and
// carries the slot key. Runs in CI after `pnpm build`.
import { readFileSync } from 'node:fs'

const js = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
// Rolldown re-wraps the banner/footer across lines, so compare with whitespace
// collapsed; the trailing //# sourceMappingURL line sits after the footer.
const squash = (s) => s.replace(/\s+/g, ' ').trim()
const body = squash(js.replace(/\/\/# sourceMappingURL=.*$/m, ''))
const banner = squash('window.__ModuleLoader__.load({ id: "@refkit/dsh-plugin", factory: (require) => {')
if (!body.startsWith(banner)) { console.error('client bundle: missing loader banner'); process.exit(1) }
if (!body.endsWith(squash('return module.exports; } });'))) { console.error('client bundle: missing loader footer'); process.exit(1) }
if (!js.includes('"refkit_search"')) { console.error('client bundle: slot key not found'); process.exit(1) }
const forbidden = [...js.matchAll(/require\("(@deepseek-ai\/[^"]+)"\)/g)].map(m => m[1])
const allowed = new Set(['@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-web-react', '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-schema-form', '@deepseek-ai/dsh-client-runtime/client'])
const bad = forbidden.filter(id => !allowed.has(id))
if (bad.length > 0) { console.error('client bundle: non-platform requires', bad); process.exit(1) }
console.log('client bundle ok', js.length, 'bytes')
