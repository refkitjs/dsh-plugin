# @refkit/dsh-plugin — Design Spec

Status: approved in conversation 2026-09-20; written for review. First release 0.1.0.

## Goals

1. Make refkit usable inside DeepSeek Harness (dsh) as a native plugin: the model gets a
   license-aware reference search tool and a rights-evaluation tool; the web GUI renders each
   search as a thumbnail grid whose every tile carries a license badge and, when the caller
   stated an intent, a use-verdict badge and a one-click credit line.
2. Ship the differentiators, not a clone of dsh-refpics: 19 sources instead of 4, license facts
   and a strict-deny use-gate instead of a pass-through license string, four modalities instead
   of one, source-confidence weighted ranking.
3. Stay a thin adapter over `@refkit/core`. Every ranking, rights and provider decision lives in
   refkit; the plugin owns tool schemas, configuration, and presentation only.

## Non-goals

- Sidebar board, proxied download route, save-to-Eagle, lightbox (dsh-refpics features that
  need host HTTP routes or third-party sidebar plugins and have nothing to do with rights).
- Bridging `@refkit/mcp`; the MCP server stays a separate distribution.
- Localised UI copy. All strings live in one `copy` object so a locale swap is one file.
- Per-call `rerank` / `deadlineMs` parameters (configuration-level only).
- Supporting the npm `latest` dist-tag of dsh (0.0.1-rc.1). The CLI installs the `next` channel.

## Decisions

### D1 — Repository, package, discoverability

- Repository `refkitjs/dsh-plugin`, package `@refkit/dsh-plugin`, Apache-2.0, single package,
  no changesets (manual semver, one `version` field).
- `package.json`: `keywords: ["dsh-plugin", "deepseek-harness", "refkit", "reference-search",
  "license", "agent-tool"]`; GitHub topics `dsh-plugin`, `deepseek-harness`. Hubs index on the
  keyword, so the scoped name loses no discoverability.
- `dsh.bundle.patch: "./cordis.patch.yml"` inserting one row `{ id: refkit, name:
  '@refkit/dsh-plugin' }` with the non-secret defaults of D4 as commented config.
- `dsh.client: { platform: 'web', inject: [...] }` declaring the browser half; the `inject`
  list is the minimal set that makes the `slots` service and the `tool.call.toolview` slot
  available and is verified against a real `web` profile in the smoke (D8).
- `exports`: `"."` → `lib/index.js` (+ `lib/types/index.d.ts`), `"./client"` → `lib/client.js`,
  `"./package.json"`. `files`: `lib/**`, `src/**`, `cordis.patch.yml`, READMEs, LICENSE.
- `lib/` is committed on release commits so `dsh plugin --profile web add github:refkitjs/dsh-plugin`
  works without a build step; CI fails when `lib/` is stale (D9).
- Runtime dependencies: `@refkit/core` and the 19 `@refkit/provider-*` packages at the first
  release that includes refkitjs/refkit#27 (facts-driven gate, `EmittedReference`), caret
  ranges. Peer dependencies supplied by the dsh profile tree, never bundled:
  `@deepseek-ai/cordis ^4.0.2`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-settings`,
  `@deepseek-ai/dsh-system-prompt` at `^0.1.5-rc.2` (the `next` channel), `@deepseek-ai/schemastery`,
  `react ^18.2`. devDependencies pin the same versions plus `@deepseek-ai/dsh-client-runtime`,
  `@deepseek-ai/dsh-client-ui-tool` (types only), `tsdown`, `typescript ~5.7`, `vitest`.
- `engines.node`: `^22.19.0 || >=24.0.0` (dsh's own range).

### D2 — Runtime architecture

One package, two halves, one shared pure core.

- Host half (`src/`, runs in dsh's Node process): `export const name = 'refkit'`,
  `export const inject = ['tools']`, `apply(ctx, config)` registers the settings section (D4),
  builds a `RefkitClient`, registers `refkit_search` and `refkit_rights` (D3), and, when a
  `systemPrompt` service is mounted, one guidance section (D6). All registrations are Cordis
  effects, so unloading the plugin unregisters everything.
- Browser half (`src/client/`, served to the web GUI): registers one keyed
  `tool.call.toolview` entry, `key: 'refkit_search'`, `registrant: '@refkit/dsh-plugin'`. It
  imports nothing from the host half and nothing at value level from other dsh plugins
  (bundle-purity gate); collaboration is through Cordis services only.
- Shared core (`src/core/outcome.ts`): the canonical result types (`SearchOutcome`,
  `RefTile`, `VerdictSummary`), `narrowOutcome(unknown) → SearchOutcome | null`, and
  `narrowTile`. Zero runtime dependencies. Both halves compile it; a version-drifted or
  malformed payload yields `null` and the card falls back to plain text, never throws.
- Files: `src/index.ts` (entry: inject/apply/Config), `src/config.ts` (schemastery Config,
  env fallback, provider registry, `buildClient`), `src/tools/search.ts`, `src/tools/rights.ts`,
  `src/tools/controls.ts` (the DSL mirror of `SearchControls`), `src/render.ts` (model-facing
  text), `src/core/outcome.ts`, `src/client/index.tsx`, `src/client/Card.tsx`,
  `src/client/badges.ts`, `src/client/styles.ts`, `src/client/copy.ts`.

### D3 — Tool contracts

Both tools are `defineTool` definitions registered on `ctx.tools`. Parameter and output
schemas use dsh's unified value-schema DSL; `execute` returns the canonical JSON value only;
`output.render` produces the model-facing text; `output.presentationMeta` produces the
bounded replayable value the card reads.

#### `refkit_search`

Parameters (implicit open object root):

| name | type | notes |
|---|---|---|
| `query` | string, required | what to search for |
| `modalities` | array of enum `image` `video` `audio` `text` | default `['image']` |
| `intent` | enum `internal-moodboard` `commercial-product` `ai-generation-input` `redistribution` | annotate each result with a use-verdict and credit line; no filtering |
| `gateFor` | same enum | return only results whose license allows the intent; also annotates |
| `sources` | array of string | restrict to provider ids; a miss throws with the enabled ids |
| `limit` | integer | default = config `limit`; clamped 1..30 |
| `cursor` | string | opaque continuation from a previous `nextCursor` |
| `controls` | object, `additionalProperties: false` | mirrors core `SearchControls` one-to-one: `orientation`, `color`, `language`, `sort`, `safety`, `license {commercial, modification, allowUnknown}`, `media {kind, size, minWidth, minHeight, duration}`, `creator {id, name}`, `text {copyright}`, `page`; enum literals copied from core. A test asserts the flattened key set equals `SEARCH_CONTROL_KEYS` so the mirror cannot drift |
| `minRelevance` | number 0..1 | post-rerank threshold; description carries the calibration note from the MCP tool |
| `explain` | boolean | include core's full `SearchMeta` under `meta` |

Execution: `searchWithMeta({ query, modalities, sources, controls, limit, cursor, minRelevance,
gateFor, deadlineMs: cfg.deadlineMs, signal: exec.signal })` on the current client. When
`intent ?? gateFor` is set, each reference is annotated with `client.evaluateUse(ref, intent)`
and `client.buildAttribution(ref)`.

Canonical output value (`additionalProperties: false` objects throughout):

```
{
  query: string, modalities: string[], intent?: string, count: integer,
  references: [{
    id, modality, provider, canonicalUrl, license: string,
    title?, kind?, licenseVersion?, author?, thumbnail?, preview?, width?, height?,
    description?, excerpt?, tags?: string[],
    useVerdict?: { decision, reason, confidence }, attribution?: string
  }],
  nextCursor?: string,
  sources: [{ id, status: 'fulfilled' | 'failed' | 'skipped', reason?, returned?: integer }],
  warnings: string[],
  note?: string,
  meta?: json            // only when explain
}
```

`thumbnail` = `ref.thumbnail?.url`, `preview` = `ref.preview?.url`, `width`/`height` from
`ref.visual`, `excerpt` from `ref.text?.excerpt`. `sources` is the compact projection of
`meta.providers` (always present; `meta` itself only with `explain`). `note` is set when
`count === 0` ("No results; try broader terms, another modality, or fewer controls").

`render`: one header line `N reference(s) for "query"` (+ ` — intent: X` when set); one line
per reference `k. Title — provider — LICENSE[ vX] — decision — canonicalUrl`; an indented
`credit: …` line when attribution is required; for `text` modality one indented excerpt line
cut at 160 chars; then one line per warning and, when `nextCursor` is present, `more: pass
cursor "…" to continue`. Bounded by `limit` ≤ 30.

`presentationMeta`: `{ query, intent, count, references, sources, warnings, nextCursor }` with
`description` cut at 200 chars and `tags` dropped — bounded, replayable, and exactly what the
card consumes.

`presentCall`: `{ card: 'generic', title: 'refkit search', kind: 'search', rawInput: { query,
modalities, intent } }`. `presentResult`: generic card titled `N refs for "query"` with the
rendered content. `timeoutMs = cfg.deadlineMs + 5000`. `isConcurrencySafe: () => true`.

#### `refkit_rights`

Parameters: `license` (string, required; any id — an unknown id resolves to the strict-deny
`unknown` facts row), `intent` (enum, required), `canonicalUrl` (string, required; audit and
credit link), `licenseVersion?`, `author?`, `title?`, `editorialOnly?` (boolean),
`jurisdiction?`, `userJurisdiction?`, `facts?` (object, `additionalProperties: false`:
`commercialUse`, `derivatives`, `redistribution` each `oneOf [boolean, const 'unknown']`;
`attributionRequired`, `shareAlike` boolean) — the override for a source whose terms are
narrower than its label.

Execution: build a `RightsRecord` (`rehostPolicy: 'cache-allowed'`, `raw: { sourceTerms: '',
sourceUrl: canonicalUrl }`), `evaluateUse(rights, intent, { userJurisdiction })`, and
`buildAttribution({ license, facts, licenseVersion, canonicalUrl, author, title })`.

Output: `{ decision, reasons: string[], confidence: 'high' | 'low', attribution: { required,
text?, html? }, disclaimer }`. `render`: `decision (confidence): reasons` + `credit: text` when
required + the disclaimer line. Generic cards; `timeoutMs 5000`; concurrency-safe.

### D4 — Configuration and sources

Schemastery `Config`, settings namespace `refkit`, installed through
`ctx.settings.installSection(ctx, 'refkit', Config, entryConfig, hooks)` inside
`ctx.inject(['settings'], …)` so a profile without a settings service still runs on the
`cordis.yml` entry. `hooks.onChange` rebuilds the `RefkitClient`; the tools read the client
through a thunk, so a key typed into Settings → Plugins → refkit takes effect on the next call.

Secret fields (`role('secret')`, masked in the card, never logged, never in tool output),
each with an environment fallback identical to `@refkit/mcp`'s CLI so one `.env` serves both:

| field | env (first wins) | enables |
|---|---|---|
| `unsplashAccessKey` | `REFKIT_UNSPLASH_KEY`, `UNSPLASH_KEY` | unsplash |
| `pexelsApiKey` | `REFKIT_PEXELS_KEY`, `PEXELS_KEY` | pexels, pexels-video |
| `pixabayKey` | `REFKIT_PIXABAY_KEY`, `PIXABAY_KEY` | pixabay, pixabay-video |
| `flickrApiKey` | `REFKIT_FLICKR_KEY`, `FLICKR_KEY` | flickr |
| `smithsonianApiKey` | `REFKIT_SMITHSONIAN_KEY`, `SI_KEY` | smithsonian |
| `braveToken` | `REFKIT_BRAVE_KEY`, `BRAVE_TOKEN` | brave |
| `freesoundToken` | `REFKIT_FREESOUND_KEY`, `FREESOUND_TOKEN` | freesound |
| `jamendoClientId` | `REFKIT_JAMENDO_CLIENT_ID`, `JAMENDO_CLIENT_ID` | jamendo |
| `europeanaApiKey` | `REFKIT_EUROPEANA_KEY`, `EUROPEANA_KEY` | europeana |
| `openverseToken` | `REFKIT_OPENVERSE_TOKEN` | optional; raises openverse rate limits |

A settings value wins over the environment; the environment is read at every rebuild.

Non-secret fields and defaults (tighter than core's, per the fan-out analysis):

| field | default | bounds | effect |
|---|---|---|---|
| `sources` | `[]` (= all enabled) | provider ids | whitelist; an unknown id rejects the write with the valid list |
| `limit` | 12 | 1..30 | default per-call limit; also `maxObjects` for met / rijksmuseum / polyhaven so their N+1 detail fetches stay ≤ limit |
| `poolFactor` | 2 | 1..4 | fusion pool multiplier |
| `deadlineMs` | 15000 | 1000..60000 | whole-search deadline |
| `timeoutMs` | 10000 | 1000..60000 | per-source timeout (core resilience) |
| `rerank` | true | | default lexical reranker on/off |
| `sourceConfidence` | true | | confidence weighting on/off |
| `userAgent` | `refkit-dsh-plugin/<version>` | | injected into provider fetches |

Provider registry (`src/config.ts`): a static table of the 23 factories from the 19 packages,
`{ id, modalities, key?: <secret field>, make(cfg) }`: artic, brave, europeana, flickr,
freesound, gutendex, internet-archive, jamendo, met, nailbook, openverse, openverse-audio,
pexels, pexels-video, pixabay, pixabay-video, poetrydb, polyhaven, ambientcg, rijksmuseum,
smithsonian, unsplash, wikimedia-commons. A provider is enabled when it is keyless or its key
is present, intersected with `sources` when non-empty. `buildClient(resolved)` =
`createRefkit({ providers, rerank, sourceConfidence, resilience: { timeoutMs }, userAgent })`;
`poolFactor` and `limit` are passed per search. A test pins the id list and that every
factory import resolves.

### D5 — Web card

Registered in `src/client/index.tsx` via `ctx.inject(['slots'], scope => scope.slots.inject(
'tool.call.toolview', () => scope.slots.register({ name: 'tool.call.toolview', key:
'refkit_search', priority: 0, registrant: '@refkit/dsh-plugin' }, RefkitCard)))`. Every wiring
step is wrapped in try/catch and logged, never thrown (a throwing client `apply` fails the
whole web shell boot).

`RefkitCard(props: ToolCallOwnerProps)`:

- Running block → header "Searching refkit sources…" and six shimmer tiles.
- Settled with `isError` → the error text in an `rk-error` box.
- Settled, `narrowOutcome(block.meta)` null → falls back to the block's text content.
- Settled and parsed → header + grid.

Header: the query, `count`, one chip per fulfilled source with its `returned` count, failed or
skipped sources listed muted with their reason, a "more available" hint when `nextCursor` is
present, and, when `intent` is set, a legend of the four verdict colours.

Grid: `display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))`. Tile
aspect from `width/height` when known, else 4:3. Image tiles render `<img loading="lazy"
referrerpolicy="no-referrer" src={thumbnail ?? preview}>` with alt = title. Text tiles show the
title and a six-line-clamped excerpt. Audio and video tiles show a modality glyph, title and
provider (no player). Overlay chips: provider id; license id (+ version). Verdict badge,
top-left, only when `useVerdict` is present: `allowed` green, `allowed-with-attribution` blue,
`denied` red, `needs-review` amber; `title` attribute = the verdict reason. Actions row:
"Open" (`canonicalUrl`, `target="_blank" rel="noopener noreferrer"`) and, when `attribution`
is present, "Copy credit" (`navigator.clipboard.writeText`; on failure the credit line is
revealed as selectable text). The card issues no network requests of its own; thumbnails are
provider-hosted URLs loaded by the browser.

Styles are a CSS string (`src/client/styles.ts`) appended as one `<style data-refkit>` element to `document.head` the first time the card mounts (idempotent by the data attribute), all classes prefixed `rk-`,
colours via CSS variables with light and `prefers-color-scheme: dark` values. Pure helpers in
`src/client/badges.ts` (verdict → class + label, license label shortening) are unit-tested
without a DOM.

### D6 — System-prompt guidance

`ctx.inject(['systemPrompt'], c => c.systemPrompt.section({ name: 'tool:refkit', order: 115,
text }))`. Text (three sentences): use `refkit_search` when the user wants reference images,
audio, video or text passages for creative work, not web pages; pass `intent` when the user has
said how the material will be used, and `gateFor` when only usable results should come back;
cite `canonicalUrl` and repeat the `credit` line whenever a result requires attribution. Use
`refkit_rights` to re-check one license for a different intent without searching again.

### D7 — Error handling

- Partial source failure is not an error: core reports it in `meta.providers`; the value carries
  `sources[].status = 'failed'` and one warning per failure; the card lists them muted.
- Every chosen source failed (`AggregateError` from core) → `execute` throws
  `Error('all N sources failed: id: message; …')`, each message cut at 200 chars → dsh marks the
  call `isError`.
- `sources` naming no enabled provider → `execute` throws with the enabled id list and, for a
  known-but-unconfigured keyed source, "configure its key under Settings → Plugins → refkit".
- No results → `count: 0` with `note`; not an error.
- `exec.signal` is forwarded as the search `signal`; `deadlineMs` composes with it.
- Secrets: the client is built from resolved config in the host; the canonical value,
  `render`, `presentationMeta` and warnings never include configuration values. Upstream HTTP
  error bodies are truncated to 200 chars before they reach a warning.
- Settings `validate` rejects an unknown `sources` id and out-of-range numbers at write time.

### D8 — Testing

Vitest, in-process, no network in CI.

- `tools/controls`: flattened key set equals `SEARCH_CONTROL_KEYS`; every enum literal equals
  core's `SearchControls` type (compile-time via `satisfies`, plus a runtime check against
  `buildSearchControlsSchema().shape` keys).
- `config`: registry ids pinned; keyless providers enabled with empty config; a key enables its
  providers; env fallback order; settings value beats env; whitelist intersection; unknown id
  rejected by `validate`; `maxObjects` equals `limit`.
- `tools/search`: against fake providers through a seam `buildClient` override — canonical value
  shape, verdict annotation with `intent`, filtering with `gateFor`, `sources` error mapping,
  all-failed mapping, empty `note`, warnings on partial failure, `presentationMeta` bounds
  (description ≤ 200, no tags), render text lines.
- `tools/rights`: known id, custom id without facts → `needs-review`, custom id with facts,
  attribution text present iff required.
- `core/outcome`: `narrowOutcome` accepts a full value, drops malformed tiles, returns null for
  the wrong shape. `client/badges`: verdict mapping, license shortening.
- Build shape: after `pnpm build`, `lib/client.js` starts with
  `window.__ModuleLoader__.load({ id: "@refkit/dsh-plugin"` and `lib/index.js` exports
  `apply`, `inject`, `name`, `Config`.
- `scripts/smoke-host.mjs` (manual, env-gated): mount `apply` on a real `@deepseek-ai/cordis`
  Context with a stub `tools` registry, run one live Openverse search, print the render text.
- Manual acceptance before each release: `dsh plugin --profile web add file:<repo>`, restart the
  web host, run a search with `intent: 'commercial-product'`, confirm badges and copy-credit, take
  the README screenshot.

### D9 — Build, CI, release

- `tsc -b` emits `lib/types`; `tsdown` builds `lib/index.js` (ESM, platform node, externals:
  `@deepseek-ai/*` peers, `@refkit/*`, `react`) and `lib/client.js` (CJS closure-factory
  artifact with the `window.__ModuleLoader__.load` banner/footer, browser platform, externals =
  the dsh client module table, bundle-purity plugin rejecting any other `@deepseek-ai/*` value
  import). Config adapted from dsh-refpics's standalone `tsdown.config.ts`.
- CI (`.github/workflows/ci.yml`, push to main + PRs): `pnpm install --frozen-lockfile`,
  `typecheck`, `lint`, `test`, `build`, then `git diff --exit-code lib` so committed artifacts
  are never stale.
- Release (`.github/workflows/release.yml`, on tag `v*`): install, test, build, `npm publish
  --access public` with `NPM_TOKEN`. Versions are bumped by hand in `package.json`; the tag is
  the release.
- README (EN + ZH): install commands (npm and `github:`), configuration table, tool table with
  example prompts, screenshot, tested dsh version, the not-legal-advice disclaimer, and a link
  to refkit.

### D10 — dsh compatibility posture

dsh is in developer preview and breaks APIs between rc's (0.0.1-rc.1 exposes
`installSettingsSection`; 0.1.5-rc.2 moved it to `ctx.settings.installSection`). The plugin
tracks the `next` channel: peers and devDependencies pin `^0.1.5-rc.2`, typecheck runs against
those exact typings, and the README states the tested version. When dsh publishes a stable
0.1.x the peer ranges widen; no attempt is made to support two API generations at once.

## Risks

- `dsh.client.inject` and the client externals list are inferred from dsh-refpics and the
  cookbook, not from a published preset; the smoke against a real web profile is the only proof.
- Museum sources with N+1 detail fetches (met, rijksmuseum, polyhaven) dominate latency; the
  12-item cap and 15 s deadline bound it, and the card shows what timed out.
- Hot-linked thumbnails can be blocked by a provider's CDN for some referrers; the tile then
  shows the title-only fallback.
- The plugin cannot publish before the refkit release that contains PR #27 is on npm.
