# @refkit/dsh-plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@refkit/dsh-plugin` 0.1.0: a DeepSeek Harness plugin exposing `refkit_search` and `refkit_rights` to the model, a settings section for BYOK keys, and a web card that renders every search as a thumbnail grid with license and use-verdict badges.

**Architecture:** One npm package, two halves. The host half (`src/`) is a Cordis plugin that builds a `RefkitClient` from configuration and registers two `defineTool` definitions plus a settings section and a system-prompt hint. The browser half (`src/client/`) registers one keyed `tool.call.toolview` React component. Both compile the dependency-free `src/core/outcome.ts`, which holds the canonical result shape and soft parsers so a malformed payload degrades to text instead of throwing.

**Tech Stack:** TypeScript 5.7, `@deepseek-ai/dsh-tools` / `dsh-settings` / `dsh-system-prompt` / `cordis` (peers, `next` channel 0.1.5-rc.2), `@deepseek-ai/schemastery`, `@refkit/core` + 19 `@refkit/provider-*`, React 18 (client only), tsdown 0.22, vitest, eslint + typescript-eslint, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-09-20-dsh-plugin-design.md` — read it first; every task argues from it.

## Global Constraints

- Package `@refkit/dsh-plugin`, repository `refkitjs/dsh-plugin`, license Apache-2.0, `engines.node` `^22.19.0 || >=24.0.0`, `packageManager` `pnpm@10.32.1`.
- Runtime dependencies: `@refkit/core` and the 19 `@refkit/provider-*` packages at the versions published by refkitjs/refkit#28 (core `0.9.0`), caret ranges. Nothing else at runtime (schemastery and every `@deepseek-ai/*` package are peers supplied by the dsh profile tree and are never bundled).
- Peer dependencies: `@deepseek-ai/cordis ^4.0.2`, `@deepseek-ai/dsh-tools ^0.1.5-rc.2`, `@deepseek-ai/dsh-settings ^0.1.5-rc.2` (optional), `@deepseek-ai/dsh-system-prompt ^0.1.5-rc.2` (optional), `@deepseek-ai/schemastery ^3.18.1-rc.1`, `react ^18.2.0` (optional).
- Fixed names: plugin `name = 'refkit'`, `inject = ['tools']`; settings namespace `refkit`; tools `refkit_search` and `refkit_rights`; slot `tool.call.toolview` key `refkit_search`, registrant `@refkit/dsh-plugin`; system-prompt section `tool:refkit`, order 115; cordis row id `refkit`.
- Configuration defaults: `limit` 12 (1..30), `poolFactor` 2 (1..4), `deadlineMs` 15000 (1000..60000), `timeoutMs` 10000 (1000..60000), `rerank` true, `sourceConfidence` true, `userAgent` `refkit-dsh-plugin/<version>`, `sources` `[]` (= all enabled).
- Environment fallbacks (first wins; a settings value beats the environment): `unsplashAccessKey` ← `REFKIT_UNSPLASH_KEY`, `UNSPLASH_KEY`; `pexelsApiKey` ← `REFKIT_PEXELS_KEY`, `PEXELS_KEY`; `pixabayKey` ← `REFKIT_PIXABAY_KEY`, `PIXABAY_KEY`; `flickrApiKey` ← `REFKIT_FLICKR_KEY`, `FLICKR_KEY`; `smithsonianApiKey` ← `REFKIT_SMITHSONIAN_KEY`, `SI_KEY`; `braveToken` ← `REFKIT_BRAVE_KEY`, `BRAVE_TOKEN`; `freesoundToken` ← `REFKIT_FREESOUND_KEY`, `FREESOUND_TOKEN`; `jamendoClientId` ← `REFKIT_JAMENDO_CLIENT_ID`, `JAMENDO_CLIENT_ID`; `europeanaApiKey` ← `REFKIT_EUROPEANA_KEY`, `EUROPEANA_KEY`; `openverseToken` ← `REFKIT_OPENVERSE_TOKEN`.
- Secrets never appear in tool output, render text, presentation metadata, warnings, or logs. Upstream error text is truncated to 200 characters before it reaches a warning or an error message.
- Canonical tool values and presentation metadata contain no `undefined` properties (dsh snapshots them as lossless JSON): build objects with conditional spreads.
- Browser half: value imports from `@deepseek-ai/*` are limited to the tsdown `CLIENT_EXTERNALS` list; everything else is type-only. Every wiring step is wrapped in try/catch and logged with `console.warn`, never thrown. The card issues no network requests.
- Source files import siblings with explicit `.ts` / `.tsx` extensions (`allowImportingTsExtensions`).
- Gate before every commit: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green with pristine output. Conventional commit subjects, no attribution trailers.
- Work in `/Users/xuan/Desktop/testSpace/dsh-plugin` (branch `main`). Never `git stash`, never push.

---

## File structure

| Path | Responsibility |
|---|---|
| `package.json`, `tsconfig*.json`, `tsdown.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `cordis.patch.yml`, `LICENSE` | Packaging, build, lint, test wiring (Task 1) |
| `src/core/outcome.ts` | Canonical result types shared by both halves; `narrowOutcome` / `narrowTile` soft parsers; `trunc` (Task 1) |
| `src/config.ts` | schemastery `Config`, env fallback, `resolveConfig`, the 23-entry `PROVIDER_REGISTRY`, `enabledProviders`, `validateConfig`, `buildClient`, `PLUGIN_VERSION` (Task 2) |
| `src/tools/controls.ts` | `CONTROLS_PARAMETER`: the dsh DSL mirror of core `SearchControls`; `flattenControlKeys` (Task 3) |
| `src/tools/search.ts`, `src/render.ts` | `refkit_search`: parameter/output schemas, `runSearch`, `toTile`, `toSourceStatus`, `renderSearch`, `cardMeta`, `createSearchTool` (Task 4) |
| `src/tools/rights.ts` | `refkit_rights`: schemas, `runRights`, `renderRights`, `createRightsTool` (Task 5) |
| `src/index.ts` | Plugin entry: `name`, `inject`, `Config`, `apply`, `applyWith`, `GUIDANCE`, re-exports for the smoke script (Task 6) |
| `src/client/copy.ts`, `badges.ts`, `styles.ts`, `Card.tsx`, `index.tsx` | Browser half: strings, pure badge helpers, CSS injection, the card, slot registration (Task 7) |
| `scripts/smoke-host.mjs`, `scripts/check-client-bundle.mjs`, `.github/workflows/*.yml`, `README.md`, `README.zh.md`, `lib/` | Smoke, bundle check, CI, release, docs, committed artifacts (Task 8) |
| `tests/*.test.ts` | vitest suites, one per source module |

---

### Task 1: Scaffold the package and the shared outcome vocabulary

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.host.json`, `tsconfig.client.json`, `tsconfig.tests.json`, `tsdown.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `cordis.patch.yml`, `LICENSE`, `.npmrc`
- Create: `src/core/outcome.ts`
- Test: `tests/outcome.test.ts`

**Interfaces:**
- Produces: `MODALITIES`, `Modality`, `DECISIONS`, `Decision`, `Json`, `VerdictSummary`, `RefTile`, `SourceStatus`, `SearchOutcome`, `CardOutcome`, `narrowTile(value: unknown): RefTile | null`, `narrowOutcome(value: unknown): SearchOutcome | null`, `trunc(text: string, max: number): string` from `src/core/outcome.ts`. Every later task imports these.

- [ ] **Step 1: Verify the refkit release is on npm**

Run: `npm view @refkit/core version`
Expected: `0.9.0`. If it prints `0.8.0`, refkitjs/refkit#28 ("Version Packages") has not been merged and published yet — report `BLOCKED` naming that PR; do not substitute `link:` or `file:` dependencies.

- [ ] **Step 2: Write `package.json`**

Resolve each provider version with `npm view @refkit/provider-<name> version` and write `^<version>`; the block below shows the shape with core filled in. Every one of the 19 provider packages must appear.

```json
{
  "name": "@refkit/dsh-plugin",
  "version": "0.1.0",
  "description": "DeepSeek Harness plugin for refkit: license-normalized creative reference search across 19 sources and 4 modalities, a strict-deny use-gate, and a web card with license and use-verdict badges (refkit_search / refkit_rights).",
  "type": "module",
  "license": "Apache-2.0",
  "keywords": ["dsh-plugin", "deepseek-harness", "refkit", "reference-search", "creative-commons", "license", "agent-tool"],
  "repository": { "type": "git", "url": "git+https://github.com/refkitjs/dsh-plugin.git" },
  "homepage": "https://github.com/refkitjs/dsh-plugin#readme",
  "bugs": "https://github.com/refkitjs/dsh-plugin/issues",
  "engines": { "node": "^22.19.0 || >=24.0.0" },
  "packageManager": "pnpm@10.32.1",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-tool", "@deepseek-ai/dsh-client-ui-conversation"]
    }
  },
  "files": ["lib/**/*.js", "lib/**/*.js.map", "lib/**/*.d.ts", "lib/**/*.d.ts.map", "src", "cordis.patch.yml", "README.md", "README.zh.md", "LICENSE"],
  "scripts": {
    "build": "tsc -b && tsdown",
    "typecheck": "tsc -b --pretty false && tsc -p tsconfig.tests.json --pretty false",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "check:lib": "pnpm build && git diff --exit-code -- lib",
    "smoke:host": "node scripts/smoke-host.mjs",
    "check:client": "node scripts/check-client-bundle.mjs"
  },
  "dependencies": {
    "@refkit/core": "^0.9.0",
    "@refkit/provider-artic": "^<resolved>",
    "@refkit/provider-brave": "^<resolved>",
    "@refkit/provider-europeana": "^<resolved>",
    "@refkit/provider-flickr": "^<resolved>",
    "@refkit/provider-freesound": "^<resolved>",
    "@refkit/provider-gutendex": "^<resolved>",
    "@refkit/provider-internet-archive": "^<resolved>",
    "@refkit/provider-jamendo": "^<resolved>",
    "@refkit/provider-met": "^<resolved>",
    "@refkit/provider-nailbook": "^<resolved>",
    "@refkit/provider-openverse": "^<resolved>",
    "@refkit/provider-pexels": "^<resolved>",
    "@refkit/provider-pixabay": "^<resolved>",
    "@refkit/provider-poetrydb": "^<resolved>",
    "@refkit/provider-polyhaven": "^<resolved>",
    "@refkit/provider-rijksmuseum": "^<resolved>",
    "@refkit/provider-smithsonian": "^<resolved>",
    "@refkit/provider-unsplash": "^<resolved>",
    "@refkit/provider-wikimedia-commons": "^<resolved>"
  },
  "peerDependencies": {
    "@deepseek-ai/cordis": "^4.0.2",
    "@deepseek-ai/dsh-settings": "^0.1.5-rc.2",
    "@deepseek-ai/dsh-system-prompt": "^0.1.5-rc.2",
    "@deepseek-ai/dsh-tools": "^0.1.5-rc.2",
    "@deepseek-ai/schemastery": "^3.18.1-rc.1",
    "react": "^18.2.0"
  },
  "peerDependenciesMeta": {
    "@deepseek-ai/dsh-settings": { "optional": true },
    "@deepseek-ai/dsh-system-prompt": { "optional": true },
    "react": { "optional": true }
  },
  "devDependencies": {
    "@deepseek-ai/cordis": "^4.0.2",
    "@deepseek-ai/dsh-client-runtime": "0.1.1-rc.2",
    "@deepseek-ai/dsh-client-ui-conversation": "next",
    "@deepseek-ai/dsh-client-ui-tool": "0.1.5-rc.2",
    "@deepseek-ai/dsh-settings": "0.1.5-rc.2",
    "@deepseek-ai/dsh-system-prompt": "0.1.5-rc.2",
    "@deepseek-ai/dsh-tools": "0.1.5-rc.2",
    "@deepseek-ai/schemastery": "^3.18.1-rc.1",
    "@types/node": "^22.20.0",
    "@types/react": "~18.3.1",
    "eslint": "^10.7.0",
    "react": "^18.3.1",
    "tsdown": "0.22.2",
    "typescript": "~5.7.2",
    "typescript-eslint": "^8.64.0",
    "vitest": "^3.2.6"
  }
}
```

After `pnpm install`, replace the `"next"` dist-tag for `@deepseek-ai/dsh-client-ui-conversation` with the exact version pnpm resolved (read it from `pnpm-lock.yaml`), so the lockfile and manifest agree.

- [ ] **Step 3: Write `.npmrc`, `cordis.patch.yml`, `LICENSE`**

`.npmrc`:
```
auto-install-peers=true
strict-peer-dependencies=false
```

`cordis.patch.yml`:
```yaml
# @refkit/dsh-plugin bundle patch: one row inserted into the profile roster.
# Install with `dsh plugin --profile web add @refkit/dsh-plugin` (npm) or
# `dsh plugin --profile web add github:refkitjs/dsh-plugin`. Keys go into
# Settings -> Plugins -> refkit (or the REFKIT_* environment variables); the
# non-secret defaults below can be overridden here or in the settings card.
- insert:
    - id: refkit
      name: '@refkit/dsh-plugin'
      config:
        # sources: []            # whitelist of provider ids; empty = every enabled source
        # limit: 12              # default results per call (1..30); also caps museum detail fetches
        # poolFactor: 2          # fusion pool multiplier (1..4)
        # deadlineMs: 15000      # whole-search deadline
        # timeoutMs: 10000       # per-source timeout
        # rerank: true           # default lexical reranker
        # sourceConfidence: true # weight sources by query hit-rate
```

`LICENSE`: copy verbatim from `/Users/xuan/Desktop/testSpace/refkit/LICENSE` (Apache-2.0).

- [ ] **Step 4: Write the TypeScript configs**

`tsconfig.host.json`:
```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "lib": ["ES2024"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "rootDir": "src",
    "outDir": "lib/types",
    "types": ["node"]
  },
  "include": ["src/index.ts", "src/config.ts", "src/render.ts", "src/tools/**/*.ts", "src/core/**/*.ts"]
}
```

`tsconfig.client.json`: identical `compilerOptions` except `"jsx": "react-jsx"`, `"lib": ["ES2024", "DOM", "DOM.Iterable"]`, `"types": []`; `"include": ["src/client/**/*.ts", "src/client/**/*.tsx", "src/core/**/*.ts"]`.

`tsconfig.json`:
```json
{ "files": [], "references": [{ "path": "./tsconfig.host.json" }, { "path": "./tsconfig.client.json" }] }
```

`tsconfig.tests.json`:
```json
{
  "extends": "./tsconfig.host.json",
  "compilerOptions": { "composite": false, "declaration": false, "declarationMap": false, "emitDeclarationOnly": false, "noEmit": true, "rootDir": ".", "types": ["node"] },
  "include": ["src/index.ts", "src/config.ts", "src/render.ts", "src/tools/**/*.ts", "src/core/**/*.ts", "src/client/badges.ts", "src/client/copy.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 5: Write `vitest.config.ts`, `eslint.config.mjs`, `tsdown.config.ts`**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
```

`eslint.config.mjs`:
```js
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['lib/**', 'node_modules/**', 'docs/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  { files: ['tests/**'], rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-non-null-assertion': 'off' } },
)
```

`tsdown.config.ts` (adapted from dsh-refpics's standalone config):
```ts
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { UserConfig } from 'tsdown'

const ID = '@refkit/dsh-plugin'

/** Platform seed modules the dsh web shell shares into the frozen module table. */
export const CLIENT_EXTERNALS: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-client-runtime/client',
]

/** Host-side externals: peers from the profile tree plus our declared runtime deps. */
const HOST_EXTERNAL: readonly (string | RegExp)[] = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-settings',
  '@deepseek-ai/dsh-system-prompt',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/schemastery',
  /^@refkit\//,
]

function hostConfig(): UserConfig {
  return {
    name: ID,
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    external: [...HOST_EXTERNAL],
  }
}

function clientConfig(): UserConfig {
  return {
    name: `${ID}/client`,
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [...CLIENT_EXTERNALS],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    plugins: [{
      name: 'dsh-client-bundle-purity',
      resolveId(source: string) {
        if (!source.startsWith('@deepseek-ai/')) return null
        if (CLIENT_EXTERNALS.includes(source)) return null
        throw new Error(`client bundle purity: "${source}" is not a platform module; collaborate through cordis services (type-only imports are erased)`)
      },
    }],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  }
}

export default function config(): UserConfig[] {
  const hasClient = existsSync(resolve(process.cwd(), 'src/client/index.tsx'))
  return hasClient ? [hostConfig(), clientConfig()] : [hostConfig()]
}
```

- [ ] **Step 6: Install and confirm the toolchain resolves**

Run: `pnpm install`
Expected: succeeds; `node_modules/@refkit/core/package.json` has `"version": "0.9.0"`; `node_modules/@deepseek-ai/dsh-tools/package.json` has `"version": "0.1.5-rc.2"`. Then replace the `"next"` dist-tag in `devDependencies` with the resolved exact version and run `pnpm install` again (lockfile must be unchanged).

- [ ] **Step 7: Write the failing outcome tests**

`tests/outcome.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { narrowOutcome, narrowTile, trunc, type SearchOutcome } from '../src/core/outcome.ts'

const tile = {
  id: 'openverse:abc',
  modality: 'image',
  provider: 'openverse',
  canonicalUrl: 'https://openverse.org/image/abc',
  license: 'CC-BY',
  title: 'Neon alley',
  thumbnail: 'https://cdn.example/abc_t.jpg',
  width: 1200,
  height: 800,
  useVerdict: { decision: 'allowed-with-attribution', reason: 'attribution required', confidence: 'high' },
  attribution: '"Neon alley" by X, CC-BY 4.0',
}

const outcome: SearchOutcome = {
  query: 'neon alley',
  modalities: ['image'],
  intent: 'commercial-product',
  count: 1,
  references: [tile as never],
  sources: [{ id: 'openverse', status: 'fulfilled', returned: 1 }],
  warnings: [],
}

describe('narrowTile', () => {
  it('accepts a complete tile and keeps only known optional fields', () => {
    const parsed = narrowTile({ ...tile, bogus: 1 })
    expect(parsed).toEqual(tile)
  })
  it('rejects a tile missing a required field or with a non-http url', () => {
    expect(narrowTile({ ...tile, canonicalUrl: undefined })).toBeNull()
    expect(narrowTile({ ...tile, canonicalUrl: 'javascript:alert(1)' })).toBeNull()
    expect(narrowTile({ ...tile, modality: 'hologram' })).toBeNull()
  })
  it('drops a malformed useVerdict instead of failing the tile', () => {
    const parsed = narrowTile({ ...tile, useVerdict: { decision: 'maybe' } })
    expect(parsed).not.toBeNull()
    expect(parsed?.useVerdict).toBeUndefined()
  })
})

describe('narrowOutcome', () => {
  it('round-trips a full outcome', () => {
    expect(narrowOutcome(outcome)).toEqual(outcome)
  })
  it('drops malformed tiles and keeps the rest', () => {
    const parsed = narrowOutcome({ ...outcome, references: [tile, { id: 'x' }] })
    expect(parsed?.references).toHaveLength(1)
  })
  it('returns null for the wrong shape', () => {
    expect(narrowOutcome(null)).toBeNull()
    expect(narrowOutcome({ query: 1 })).toBeNull()
    expect(narrowOutcome({ ...outcome, sources: 'nope' })).toBeNull()
  })
  it('accepts a card outcome (no meta) and an outcome carrying meta', () => {
    expect(narrowOutcome({ ...outcome, meta: { passes: 1 } })?.meta).toEqual({ passes: 1 })
  })
})

describe('trunc', () => {
  it('cuts by code point and appends an ellipsis', () => {
    expect(trunc('abcdef', 4)).toBe('abc…')
    expect(trunc('ab', 4)).toBe('ab')
    expect(trunc('😀😀😀', 2)).toBe('😀…')
  })
})
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Failed to resolve import "../src/core/outcome.ts"`.

- [ ] **Step 9: Write `src/core/outcome.ts`**

```ts
/**
 * Canonical result vocabulary shared by the host half (tool output, render,
 * presentation metadata) and the browser half (the card). No runtime
 * dependencies: plain data plus soft parsers, so a malformed or
 * version-drifted payload degrades to text instead of crashing a render.
 * @module @refkit/dsh-plugin/core
 */

export const MODALITIES = ['image', 'video', 'audio', 'text'] as const
export type Modality = (typeof MODALITIES)[number]

export const DECISIONS = ['allowed', 'allowed-with-attribution', 'denied', 'needs-review'] as const
export type Decision = (typeof DECISIONS)[number]

export const SOURCE_STATUSES = ['fulfilled', 'failed', 'skipped'] as const
export type SourceStatusKind = (typeof SOURCE_STATUSES)[number]

/** Lossless JSON. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export interface VerdictSummary {
  decision: Decision
  reason: string
  confidence: 'high' | 'low'
}

/** One reference as the tool returns it and the card renders it. */
export interface RefTile {
  id: string
  modality: Modality
  provider: string
  canonicalUrl: string
  license: string
  title?: string
  kind?: string
  licenseVersion?: string
  author?: string
  thumbnail?: string
  preview?: string
  width?: number
  height?: number
  description?: string
  excerpt?: string
  tags?: string[]
  useVerdict?: VerdictSummary
  attribution?: string
}

export interface SourceStatus {
  id: string
  status: SourceStatusKind
  reason?: string
  returned?: number
}

/** The canonical value of one refkit_search call. */
export interface SearchOutcome {
  query: string
  modalities: Modality[]
  intent?: string
  count: number
  references: RefTile[]
  nextCursor?: string
  sources: SourceStatus[]
  warnings: string[]
  note?: string
  /** Core's full SearchMeta, only when the caller passed `explain`. */
  meta?: Json
}

/** What the card receives: the outcome minus `meta`, descriptions cut, tags dropped. */
export type CardOutcome = Omit<SearchOutcome, 'meta'>

const HTTP = /^https?:\/\//i

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** Cut `text` to `max` code points, appending an ellipsis when anything was removed. */
export function trunc(text: string, max: number): string {
  const points = Array.from(text)
  if (points.length <= max) return text
  return points.slice(0, Math.max(0, max - 1)).join('') + '…'
}

function narrowVerdict(v: unknown): VerdictSummary | undefined {
  if (typeof v !== 'object' || v === null) return undefined
  const r = v as Record<string, unknown>
  if (!DECISIONS.includes(r.decision as Decision)) return undefined
  if (r.confidence !== 'high' && r.confidence !== 'low') return undefined
  return { decision: r.decision as Decision, reason: str(r.reason) ?? '', confidence: r.confidence }
}

/** Soft-narrow one tile; null for anything unusable. Unknown keys are dropped. */
export function narrowTile(value: unknown): RefTile | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Record<string, unknown>
  const id = str(r.id)
  const provider = str(r.provider)
  const canonicalUrl = str(r.canonicalUrl)
  const license = str(r.license)
  if (id === undefined || provider === undefined || license === undefined) return null
  if (canonicalUrl === undefined || !HTTP.test(canonicalUrl)) return null
  if (!MODALITIES.includes(r.modality as Modality)) return null
  const tile: RefTile = { id, modality: r.modality as Modality, provider, canonicalUrl, license }
  for (const key of ['title', 'kind', 'licenseVersion', 'author', 'description', 'excerpt', 'attribution'] as const) {
    const s = str(r[key])
    if (s !== undefined) tile[key] = s
  }
  for (const key of ['thumbnail', 'preview'] as const) {
    const s = str(r[key])
    if (s !== undefined && HTTP.test(s)) tile[key] = s
  }
  for (const key of ['width', 'height'] as const) {
    const n = num(r[key])
    if (n !== undefined && n > 0) tile[key] = n
  }
  if (Array.isArray(r.tags)) {
    const tags = r.tags.filter((t): t is string => typeof t === 'string' && t.length > 0)
    if (tags.length > 0) tile.tags = tags
  }
  const verdict = narrowVerdict(r.useVerdict)
  if (verdict !== undefined) tile.useVerdict = verdict
  return tile
}

function narrowSource(v: unknown): SourceStatus | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  const id = str(r.id)
  if (id === undefined || !SOURCE_STATUSES.includes(r.status as SourceStatusKind)) return null
  const out: SourceStatus = { id, status: r.status as SourceStatusKind }
  const reason = str(r.reason)
  if (reason !== undefined) out.reason = reason
  const returned = num(r.returned)
  if (returned !== undefined) out.returned = returned
  return out
}

/** Soft-parse a canonical value or presentation metadata; null for the wrong shape. */
export function narrowOutcome(value: unknown): SearchOutcome | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Record<string, unknown>
  const query = typeof r.query === 'string' ? r.query : undefined
  if (query === undefined || typeof r.count !== 'number') return null
  if (!Array.isArray(r.modalities) || !Array.isArray(r.references) || !Array.isArray(r.sources)) return null
  if (!Array.isArray(r.warnings)) return null
  const modalities = r.modalities.filter((m): m is Modality => MODALITIES.includes(m as Modality))
  const references = r.references.map(narrowTile).filter((t): t is RefTile => t !== null)
  const sources = r.sources.map(narrowSource).filter((s): s is SourceStatus => s !== null)
  const warnings = r.warnings.filter((w): w is string => typeof w === 'string')
  const out: SearchOutcome = { query, modalities, count: r.count, references, sources, warnings }
  const intent = str(r.intent)
  if (intent !== undefined) out.intent = intent
  const nextCursor = str(r.nextCursor)
  if (nextCursor !== undefined) out.nextCursor = nextCursor
  const note = str(r.note)
  if (note !== undefined) out.note = note
  if (r.meta !== undefined) out.meta = r.meta as Json
  return out
}
```

- [ ] **Step 10: Run the tests, typecheck, lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: outcome tests PASS (9 tests); typecheck emits `lib/types/core/outcome.d.ts`; lint silent. (`pnpm build` needs `src/index.ts`, which arrives in Task 6 — `tsdown` fails until then; run the three commands above as this task's gate.)

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold @refkit/dsh-plugin; shared outcome vocabulary with soft parsers"
```

---

### Task 2: Configuration, environment fallback, provider registry, client factory

**Files:**
- Create: `src/config.ts`
- Test: `tests/config.test.ts`

**Interfaces:**
- Consumes: `Modality` from `src/core/outcome.ts`; `createRefkit`, `ReferenceProvider`, `RefkitClient` from `@refkit/core`; the 23 factories from the 19 provider packages.
- Produces: `Config` (interface + schemastery const), `KEY_FIELDS`, `KeyField`, `KEY_ENV`, `DEFAULTS`, `ResolvedConfig`, `resolveConfig(config, env?)`, `ProviderEntry`, `PROVIDER_REGISTRY`, `PROVIDER_IDS`, `KEYLESS_IDS`, `enabledProviders(cfg)`, `validateConfig(config)`, `buildClient(cfg, createClient?)`, `PLUGIN_VERSION`.

- [ ] **Step 1: Write the failing tests**

`tests/config.test.ts`:
```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  Config, DEFAULTS, KEY_ENV, KEY_FIELDS, KEYLESS_IDS, PLUGIN_VERSION, PROVIDER_IDS, PROVIDER_REGISTRY,
  buildClient, enabledProviders, resolveConfig, validateConfig,
} from '../src/config.ts'

const EXPECTED_IDS = [
  'artic', 'brave', 'europeana', 'flickr', 'freesound', 'gutendex', 'internet-archive', 'jamendo', 'met',
  'nailbook', 'openverse', 'openverse-audio', 'pexels', 'pexels-video', 'pixabay', 'pixabay-video', 'poetrydb',
  'polyhaven', 'ambientcg', 'rijksmuseum', 'smithsonian', 'unsplash', 'wikimedia-commons',
].sort()

describe('provider registry', () => {
  it('pins the 23 factory ids from the 19 packages', () => {
    expect([...PROVIDER_IDS].sort()).toEqual(EXPECTED_IDS)
    expect(new Set(PROVIDER_IDS).size).toBe(23)
  })
  it('every entry builds a provider whose id matches', () => {
    const cfg = resolveConfig({ unsplashAccessKey: 'u', pexelsApiKey: 'p', pixabayKey: 'x', flickrApiKey: 'f', smithsonianApiKey: 's', braveToken: 'b', freesoundToken: 'fs', jamendoClientId: 'j', europeanaApiKey: 'e' }, {})
    for (const entry of PROVIDER_REGISTRY) {
      const provider = entry.make(cfg)
      expect(provider.id).toBe(entry.id)
      expect(provider.modalities).toEqual(entry.modalities)
    }
  })
  it('keyless ids are exactly the entries without a key field', () => {
    expect([...KEYLESS_IDS].sort()).toEqual(PROVIDER_REGISTRY.filter(e => e.key === undefined).map(e => e.id).sort())
    expect(KEYLESS_IDS).toContain('openverse')
    expect(KEYLESS_IDS).not.toContain('unsplash')
  })
})

describe('resolveConfig', () => {
  it('applies defaults with an empty config and no environment', () => {
    const cfg = resolveConfig({}, {})
    expect(cfg.limit).toBe(DEFAULTS.limit)
    expect(cfg.poolFactor).toBe(2)
    expect(cfg.deadlineMs).toBe(15000)
    expect(cfg.timeoutMs).toBe(10000)
    expect(cfg.rerank).toBe(true)
    expect(cfg.sourceConfidence).toBe(true)
    expect(cfg.sources).toEqual([])
    expect(cfg.userAgent).toBe(`refkit-dsh-plugin/${PLUGIN_VERSION}`)
    for (const field of KEY_FIELDS) expect(cfg.keys[field]).toBeUndefined()
  })
  it('reads each key from its environment names in order', () => {
    expect(resolveConfig({}, { UNSPLASH_KEY: 'plain' }).keys.unsplashAccessKey).toBe('plain')
    expect(resolveConfig({}, { UNSPLASH_KEY: 'plain', REFKIT_UNSPLASH_KEY: 'scoped' }).keys.unsplashAccessKey).toBe('scoped')
    expect(resolveConfig({}, { SI_KEY: 's' }).keys.smithsonianApiKey).toBe('s')
    expect(resolveConfig({}, { BRAVE_TOKEN: 'b' }).keys.braveToken).toBe('b')
    expect(resolveConfig({}, { FREESOUND_TOKEN: 'f' }).keys.freesoundToken).toBe('f')
    expect(resolveConfig({}, { JAMENDO_CLIENT_ID: 'j' }).keys.jamendoClientId).toBe('j')
    expect(resolveConfig({}, { REFKIT_OPENVERSE_TOKEN: 'o' }).keys.openverseToken).toBe('o')
  })
  it('a settings value beats the environment and blanks are ignored', () => {
    expect(resolveConfig({ unsplashAccessKey: 'settings' }, { REFKIT_UNSPLASH_KEY: 'env' }).keys.unsplashAccessKey).toBe('settings')
    expect(resolveConfig({ unsplashAccessKey: '   ' }, { REFKIT_UNSPLASH_KEY: 'env' }).keys.unsplashAccessKey).toBe('env')
  })
  it('every KEY_FIELD has at least one env name and every env name is REFKIT_-scoped or a known plain name', () => {
    for (const field of KEY_FIELDS) expect(KEY_ENV[field].length).toBeGreaterThan(0)
    expect(KEY_ENV.unsplashAccessKey).toEqual(['REFKIT_UNSPLASH_KEY', 'UNSPLASH_KEY'])
  })
})

describe('enabledProviders', () => {
  it('with no keys enables exactly the keyless sources', () => {
    const ids = enabledProviders(resolveConfig({}, {})).map(p => p.id).sort()
    expect(ids).toEqual([...KEYLESS_IDS].sort())
  })
  it('a key enables both factories of a dual package', () => {
    const ids = enabledProviders(resolveConfig({ pexelsApiKey: 'k' }, {})).map(p => p.id)
    expect(ids).toContain('pexels')
    expect(ids).toContain('pexels-video')
    expect(ids).not.toContain('unsplash')
  })
  it('sources whitelists within the enabled set and keeps registry order', () => {
    const ids = enabledProviders(resolveConfig({ sources: ['met', 'unsplash', 'artic'] }, {})).map(p => p.id)
    expect(ids).toEqual(['artic', 'met'])
  })
  it('museum detail fetches are capped at the configured limit', () => {
    const cfg = resolveConfig({ limit: 7 }, {})
    const met = PROVIDER_REGISTRY.find(e => e.id === 'met')!
    // the factory closes over maxObjects; assert through the registry's declared cap
    expect(met.detailCap?.(cfg)).toBe(7)
    const poly = PROVIDER_REGISTRY.find(e => e.id === 'polyhaven')!
    expect(poly.detailCap?.(cfg)).toBe(7)
  })
})

describe('validateConfig', () => {
  it('rejects an unknown source id naming the valid ids', () => {
    expect(() => validateConfig({ sources: ['unsplsh'] })).toThrow(/unsplsh.*valid ids/i)
  })
  it('accepts an empty config and known ids', () => {
    expect(() => validateConfig({})).not.toThrow()
    expect(() => validateConfig({ sources: ['met', 'unsplash'] })).not.toThrow()
  })
})

describe('Config schema', () => {
  it('applies schemastery defaults and marks keys secret', () => {
    const value = new Config({}) as Record<string, unknown>
    expect(value.limit).toBe(12)
    expect(value.poolFactor).toBe(2)
    const json = JSON.stringify(Config.toJSON())
    expect(json).toContain('"role":"secret"')
    expect(json).toContain('unsplashAccessKey')
  })
  it('rejects out-of-range numbers', () => {
    expect(() => new Config({ limit: 0 })).toThrow()
    expect(() => new Config({ poolFactor: 9 })).toThrow()
    expect(() => new Config({ deadlineMs: 10 })).toThrow()
  })
})

describe('buildClient', () => {
  it('wires the resolved config into createRefkit', () => {
    const cfg = resolveConfig({ pexelsApiKey: 'k', rerank: false, sourceConfidence: false }, {})
    let seen: Record<string, unknown> | undefined
    const client = buildClient(cfg, (opts) => { seen = opts as Record<string, unknown>; return { providers: opts.providers } as never })
    expect(client).toBeDefined()
    expect(seen?.rerank).toBe(false)
    expect(seen?.sourceConfidence).toBe(false)
    expect(seen?.resilience).toEqual({ timeoutMs: 10000 })
    expect(seen?.userAgent).toBe(`refkit-dsh-plugin/${PLUGIN_VERSION}`)
    expect((seen?.providers as { id: string }[]).map(p => p.id)).toContain('pexels')
  })
  it('leaves rerank undefined (core default) when enabled', () => {
    let seen: Record<string, unknown> | undefined
    buildClient(resolveConfig({}, {}), (opts) => { seen = opts as Record<string, unknown>; return {} as never })
    expect(seen && 'rerank' in seen).toBe(false)
  })
  it('throws a clear error when the whitelist leaves nothing enabled', () => {
    expect(() => buildClient(resolveConfig({ sources: ['unsplash'] }, {}))).toThrow(/no sources enabled/i)
  })
})

describe('PLUGIN_VERSION', () => {
  it('matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
    expect(PLUGIN_VERSION).toBe(pkg.version)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- config`
Expected: FAIL — cannot resolve `../src/config.ts`.

- [ ] **Step 3: Write `src/config.ts`**

```ts
/**
 * Plugin configuration: the schemastery schema (doubles as the Settings ->
 * Plugins -> refkit card), environment fallbacks shared with @refkit/mcp's
 * CLI, the static registry of the 23 provider factories, and the
 * RefkitClient factory. Secrets are read here and nowhere else.
 * @module @refkit/dsh-plugin/config
 */

import z from '@deepseek-ai/schemastery'
import { createRefkit, type ReferenceProvider, type RefkitClient, type RefkitOptions } from '@refkit/core'
import { artic } from '@refkit/provider-artic'
import { brave } from '@refkit/provider-brave'
import { europeana } from '@refkit/provider-europeana'
import { flickr } from '@refkit/provider-flickr'
import { freesound } from '@refkit/provider-freesound'
import { gutendex } from '@refkit/provider-gutendex'
import { internetArchive } from '@refkit/provider-internet-archive'
import { jamendo } from '@refkit/provider-jamendo'
import { met } from '@refkit/provider-met'
import { nailbook } from '@refkit/provider-nailbook'
import { openverse, openverseAudio } from '@refkit/provider-openverse'
import { pexels, pexelsVideo } from '@refkit/provider-pexels'
import { pixabay, pixabayVideo } from '@refkit/provider-pixabay'
import { poetrydb } from '@refkit/provider-poetrydb'
import { ambientcg, polyhaven } from '@refkit/provider-polyhaven'
import { rijksmuseum } from '@refkit/provider-rijksmuseum'
import { smithsonian } from '@refkit/provider-smithsonian'
import { unsplash } from '@refkit/provider-unsplash'
import { wikimediaCommons } from '@refkit/provider-wikimedia-commons'
import type { Modality } from './core/outcome.ts'

/** Kept in sync with package.json by tests/config.test.ts. */
export const PLUGIN_VERSION = '0.1.0'

export const KEY_FIELDS = [
  'unsplashAccessKey', 'pexelsApiKey', 'pixabayKey', 'flickrApiKey', 'smithsonianApiKey',
  'braveToken', 'freesoundToken', 'jamendoClientId', 'europeanaApiKey', 'openverseToken',
] as const
export type KeyField = (typeof KEY_FIELDS)[number]

/** Environment names per key, first match wins. The nine keyed sources mirror @refkit/mcp's CLI. */
export const KEY_ENV: Record<KeyField, readonly string[]> = {
  unsplashAccessKey: ['REFKIT_UNSPLASH_KEY', 'UNSPLASH_KEY'],
  pexelsApiKey: ['REFKIT_PEXELS_KEY', 'PEXELS_KEY'],
  pixabayKey: ['REFKIT_PIXABAY_KEY', 'PIXABAY_KEY'],
  flickrApiKey: ['REFKIT_FLICKR_KEY', 'FLICKR_KEY'],
  smithsonianApiKey: ['REFKIT_SMITHSONIAN_KEY', 'SI_KEY'],
  braveToken: ['REFKIT_BRAVE_KEY', 'BRAVE_TOKEN'],
  freesoundToken: ['REFKIT_FREESOUND_KEY', 'FREESOUND_TOKEN'],
  jamendoClientId: ['REFKIT_JAMENDO_CLIENT_ID', 'JAMENDO_CLIENT_ID'],
  europeanaApiKey: ['REFKIT_EUROPEANA_KEY', 'EUROPEANA_KEY'],
  openverseToken: ['REFKIT_OPENVERSE_TOKEN'],
}

export const DEFAULTS = {
  limit: 12,
  poolFactor: 2,
  deadlineMs: 15000,
  timeoutMs: 10000,
  rerank: true,
  sourceConfidence: true,
} as const

/** Deployment configuration; every field optional so an unconfigured mount loads silently. */
export interface Config {
  unsplashAccessKey?: string
  pexelsApiKey?: string
  pixabayKey?: string
  flickrApiKey?: string
  smithsonianApiKey?: string
  braveToken?: string
  freesoundToken?: string
  jamendoClientId?: string
  europeanaApiKey?: string
  openverseToken?: string
  /** Provider ids to enable; empty = every source whose key is present. */
  sources?: string[]
  limit?: number
  poolFactor?: number
  deadlineMs?: number
  timeoutMs?: number
  rerank?: boolean
  sourceConfidence?: boolean
  userAgent?: string
}

const secret = (text: string) => z.string().role('secret').description(text)

/** Schemastery schema; also the `refkit` settings-section schema. */
export const Config: z<Config> = z.object({
  unsplashAccessKey: secret('Unsplash access key (free at unsplash.com/developers). Empty disables unsplash. Env: REFKIT_UNSPLASH_KEY / UNSPLASH_KEY.'),
  pexelsApiKey: secret('Pexels API key (free at pexels.com/api). Enables pexels and pexels-video. Env: REFKIT_PEXELS_KEY / PEXELS_KEY.'),
  pixabayKey: secret('Pixabay API key (free at pixabay.com/api/docs). Enables pixabay and pixabay-video. Env: REFKIT_PIXABAY_KEY / PIXABAY_KEY.'),
  flickrApiKey: secret('Flickr API key. Env: REFKIT_FLICKR_KEY / FLICKR_KEY.'),
  smithsonianApiKey: secret('api.data.gov key for the Smithsonian Open Access API. Env: REFKIT_SMITHSONIAN_KEY / SI_KEY.'),
  braveToken: secret('Brave Search API token (web image discovery). Env: REFKIT_BRAVE_KEY / BRAVE_TOKEN.'),
  freesoundToken: secret('Freesound APIv2 token. Env: REFKIT_FREESOUND_KEY / FREESOUND_TOKEN.'),
  jamendoClientId: secret('Jamendo client id. Env: REFKIT_JAMENDO_CLIENT_ID / JAMENDO_CLIENT_ID.'),
  europeanaApiKey: secret('Europeana API key (free). Env: REFKIT_EUROPEANA_KEY / EUROPEANA_KEY.'),
  openverseToken: secret('Optional Openverse OAuth2 token; anonymous works with lower rate limits. Env: REFKIT_OPENVERSE_TOKEN.'),
  sources: z.array(z.string()).default([]).description('Provider ids to enable (empty = every source whose key is present).'),
  limit: z.number().step(1).min(1).max(30).default(DEFAULTS.limit).description('Default results per call; also caps per-item detail fetches for met, rijksmuseum and polyhaven.'),
  poolFactor: z.number().step(1).min(1).max(4).default(DEFAULTS.poolFactor).description('Rank-fusion pool multiplier.'),
  deadlineMs: z.number().step(1).min(1000).max(60000).default(DEFAULTS.deadlineMs).description('Whole-search deadline in ms.'),
  timeoutMs: z.number().step(1).min(1000).max(60000).default(DEFAULTS.timeoutMs).description('Per-source timeout in ms.'),
  rerank: z.boolean().default(DEFAULTS.rerank).description('Rerank fused results lexically over title, description, tags and excerpt.'),
  sourceConfidence: z.boolean().default(DEFAULTS.sourceConfidence).description('Down-weight sources whose batch never mentions the query.'),
  userAgent: z.string().description('User-Agent for provider requests. Default refkit-dsh-plugin/<version>.'),
})

export interface ResolvedConfig {
  keys: Record<KeyField, string | undefined>
  sources: string[]
  limit: number
  poolFactor: number
  deadlineMs: number
  timeoutMs: number
  rerank: boolean
  sourceConfidence: boolean
  userAgent: string
}

function nonEmpty(value: string | undefined): string | undefined {
  const t = (value ?? '').trim()
  return t.length > 0 ? t : undefined
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.floor(value as number) : fallback
  return Math.min(max, Math.max(min, n))
}

/** Resolve raw config plus environment into validated facts with defaults. */
export function resolveConfig(config: Config, env: NodeJS.ProcessEnv = process.env): ResolvedConfig {
  const keys = {} as Record<KeyField, string | undefined>
  for (const field of KEY_FIELDS) {
    let value = nonEmpty(config[field])
    if (value === undefined) {
      for (const name of KEY_ENV[field]) {
        value = nonEmpty(env[name])
        if (value !== undefined) break
      }
    }
    keys[field] = value
  }
  return {
    keys,
    sources: Array.isArray(config.sources) ? config.sources.filter(s => typeof s === 'string' && s.length > 0) : [],
    limit: clampInt(config.limit, DEFAULTS.limit, 1, 30),
    poolFactor: clampInt(config.poolFactor, DEFAULTS.poolFactor, 1, 4),
    deadlineMs: clampInt(config.deadlineMs, DEFAULTS.deadlineMs, 1000, 60000),
    timeoutMs: clampInt(config.timeoutMs, DEFAULTS.timeoutMs, 1000, 60000),
    rerank: config.rerank ?? DEFAULTS.rerank,
    sourceConfidence: config.sourceConfidence ?? DEFAULTS.sourceConfidence,
    userAgent: nonEmpty(config.userAgent) ?? `refkit-dsh-plugin/${PLUGIN_VERSION}`,
  }
}

/** One provider factory the plugin can mount. */
export interface ProviderEntry {
  id: string
  modalities: Modality[]
  /** The secret field that enables this entry; undefined = keyless. */
  key?: KeyField
  /** For N+1 sources: the per-search detail-fetch cap derived from config. */
  detailCap?: (cfg: ResolvedConfig) => number
  make: (cfg: ResolvedConfig) => ReferenceProvider
}

const k = (cfg: ResolvedConfig, field: KeyField): string => cfg.keys[field] ?? ''

export const PROVIDER_REGISTRY: readonly ProviderEntry[] = [
  { id: 'artic', modalities: ['image'], make: () => artic() },
  { id: 'brave', modalities: ['image'], key: 'braveToken', make: cfg => brave({ token: k(cfg, 'braveToken') }) },
  { id: 'europeana', modalities: ['image'], key: 'europeanaApiKey', make: cfg => europeana({ apiKey: k(cfg, 'europeanaApiKey') }) },
  { id: 'flickr', modalities: ['image'], key: 'flickrApiKey', make: cfg => flickr({ apiKey: k(cfg, 'flickrApiKey') }) },
  { id: 'freesound', modalities: ['audio'], key: 'freesoundToken', make: cfg => freesound({ apiKey: k(cfg, 'freesoundToken') }) },
  { id: 'gutendex', modalities: ['text'], make: () => gutendex() },
  { id: 'internet-archive', modalities: ['video', 'text'], make: () => internetArchive() },
  { id: 'jamendo', modalities: ['audio'], key: 'jamendoClientId', make: cfg => jamendo({ clientId: k(cfg, 'jamendoClientId') }) },
  { id: 'met', modalities: ['image'], detailCap: cfg => cfg.limit, make: cfg => met({ maxObjects: cfg.limit }) },
  { id: 'nailbook', modalities: ['image'], make: () => nailbook() },
  { id: 'openverse', modalities: ['image'], make: cfg => openverse(cfg.keys.openverseToken ? { token: cfg.keys.openverseToken } : {}) },
  { id: 'openverse-audio', modalities: ['audio'], make: cfg => openverseAudio(cfg.keys.openverseToken ? { token: cfg.keys.openverseToken } : {}) },
  { id: 'pexels', modalities: ['image'], key: 'pexelsApiKey', make: cfg => pexels({ apiKey: k(cfg, 'pexelsApiKey') }) },
  { id: 'pexels-video', modalities: ['video'], key: 'pexelsApiKey', make: cfg => pexelsVideo({ apiKey: k(cfg, 'pexelsApiKey') }) },
  { id: 'pixabay', modalities: ['image'], key: 'pixabayKey', make: cfg => pixabay({ key: k(cfg, 'pixabayKey') }) },
  { id: 'pixabay-video', modalities: ['video'], key: 'pixabayKey', make: cfg => pixabayVideo({ key: k(cfg, 'pixabayKey') }) },
  { id: 'poetrydb', modalities: ['text'], make: () => poetrydb() },
  { id: 'polyhaven', modalities: ['image'], detailCap: cfg => cfg.limit, make: cfg => polyhaven({ maxAssets: cfg.limit }) },
  { id: 'ambientcg', modalities: ['image'], make: cfg => ambientcg({ limit: cfg.limit }) },
  { id: 'rijksmuseum', modalities: ['image'], detailCap: cfg => cfg.limit, make: cfg => rijksmuseum({ maxObjects: cfg.limit }) },
  { id: 'smithsonian', modalities: ['image'], key: 'smithsonianApiKey', make: cfg => smithsonian({ apiKey: k(cfg, 'smithsonianApiKey') }) },
  { id: 'unsplash', modalities: ['image'], key: 'unsplashAccessKey', make: cfg => unsplash({ accessKey: k(cfg, 'unsplashAccessKey') }) },
  { id: 'wikimedia-commons', modalities: ['image'], make: () => wikimediaCommons() },
]

export const PROVIDER_IDS: readonly string[] = PROVIDER_REGISTRY.map(e => e.id)
export const KEYLESS_IDS: readonly string[] = PROVIDER_REGISTRY.filter(e => e.key === undefined).map(e => e.id)

/** Providers that are keyless or keyed-and-configured, intersected with the whitelist, in registry order. */
export function enabledProviders(cfg: ResolvedConfig): ReferenceProvider[] {
  const allow = cfg.sources.length > 0 ? new Set(cfg.sources) : null
  return PROVIDER_REGISTRY
    .filter(e => (e.key === undefined || cfg.keys[e.key] !== undefined) && (allow === null || allow.has(e.id)))
    .map(e => e.make(cfg))
}

/** Constraints the schema cannot express; throwing refuses the settings write. */
export function validateConfig(config: Config): void {
  const unknown = (config.sources ?? []).filter(id => !PROVIDER_IDS.includes(id))
  if (unknown.length > 0) {
    throw new Error(`refkit: unknown source id(s) ${unknown.join(', ')}; valid ids: ${PROVIDER_IDS.join(', ')}`)
  }
}

/** Build the RefkitClient for one resolved configuration. */
export function buildClient(cfg: ResolvedConfig, createClient: (opts: RefkitOptions) => RefkitClient = createRefkit): RefkitClient {
  const providers = enabledProviders(cfg)
  if (providers.length === 0) {
    throw new Error('refkit: no sources enabled — add a key under Settings -> Plugins -> refkit or widen `sources`')
  }
  return createClient({
    providers,
    ...(cfg.rerank ? {} : { rerank: false as const }),
    sourceConfidence: cfg.sourceConfidence,
    resilience: { timeoutMs: cfg.timeoutMs },
    userAgent: cfg.userAgent,
  })
}
```

- [ ] **Step 4: Run the tests, typecheck, lint**

Run: `pnpm test -- config && pnpm typecheck && pnpm lint`
Expected: all config tests PASS; typecheck and lint silent. If a provider factory's config field name differs from the registry above, fix the registry to the package's exported interface (the test "every entry builds a provider whose id matches" is the arbiter) and note it in the report.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: configuration schema, env fallbacks, 23-entry provider registry, client factory"
```

---

### Task 3: The controls DSL mirror

**Files:**
- Create: `src/tools/controls.ts`
- Test: `tests/controls.test.ts`

**Interfaces:**
- Consumes: `SearchControls`, `SEARCH_CONTROL_KEYS`, `buildSearchControlsSchema` from `@refkit/core`; `ObjectValueSchemaSpec`, `InferValue` from `@deepseek-ai/dsh-tools`.
- Produces: `CONTROLS_PARAMETER` (an `ObjectValueSchemaSpec` literal), `flattenControlKeys(spec: ObjectValueSchemaSpec): string[]`.

- [ ] **Step 1: Write the failing test**

`tests/controls.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { SEARCH_CONTROL_KEYS, buildSearchControlsSchema, type SearchControls } from '@refkit/core'
import { assertSupportedJsonSchema, valueSchemaSpecToJsonSchema, type InferValue } from '@deepseek-ai/dsh-tools'
import { CONTROLS_PARAMETER, flattenControlKeys } from '../src/tools/controls.ts'

describe('CONTROLS_PARAMETER mirrors core SearchControls', () => {
  it('flattened keys equal SEARCH_CONTROL_KEYS', () => {
    expect(flattenControlKeys(CONTROLS_PARAMETER).sort()).toEqual([...SEARCH_CONTROL_KEYS].sort())
  })
  it('top-level keys equal the core zod schema shape', () => {
    const shape = Object.keys(buildSearchControlsSchema().shape).sort()
    expect(Object.keys(CONTROLS_PARAMETER.properties ?? {}).sort()).toEqual(shape)
  })
  it('compiles to a JSON schema within the dsh enforced subset', () => {
    expect(() => assertSupportedJsonSchema(valueSchemaSpecToJsonSchema(CONTROLS_PARAMETER))).not.toThrow()
  })
  it('infers a value assignable to SearchControls in both directions (compile-time)', () => {
    type Inferred = InferValue<typeof CONTROLS_PARAMETER>
    const a: SearchControls = {} as Inferred
    const b: Inferred = {} as SearchControls
    expect([a, b]).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- controls`
Expected: FAIL — cannot resolve `../src/tools/controls.ts`.

- [ ] **Step 3: Write `src/tools/controls.ts`**

```ts
/**
 * The dsh value-schema mirror of @refkit/core's SearchControls. Core owns the
 * registry (CONTROL_PATHS); this literal exists because dsh tools declare
 * parameters in their own DSL. tests/controls.test.ts pins the mirror to
 * SEARCH_CONTROL_KEYS so the two cannot drift.
 * @module @refkit/dsh-plugin/tools/controls
 */

import type { ObjectValueSchemaSpec } from '@deepseek-ai/dsh-tools'

export const CONTROLS_PARAMETER = {
  type: 'object',
  additionalProperties: false,
  description: 'Provider-neutral search controls; each source applies the ones it supports and the rest are reported as ignored.',
  properties: {
    orientation: { type: 'string', enum: ['landscape', 'portrait', 'square'] },
    color: { type: 'string', description: 'dominant colour name or hex' },
    language: { type: 'string', description: 'BCP-47 tag, e.g. en-US' },
    sort: { type: 'string', enum: ['relevance', 'latest', 'popular', 'interesting'] },
    safety: { type: 'string', enum: ['strict', 'moderate', 'off'] },
    license: {
      type: 'object',
      additionalProperties: false,
      properties: {
        commercial: { type: 'boolean', description: 'only licenses allowing commercial use' },
        modification: { type: 'boolean', description: 'only licenses allowing derivatives' },
        allowUnknown: { type: 'boolean' },
      },
    },
    media: {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { type: 'string', description: 'photo, illustration, vector, icon, artwork, texture, hdri, 3d-model, film, animation, ...' },
        size: { type: 'string', enum: ['small', 'medium', 'large'] },
        minWidth: { type: 'integer' },
        minHeight: { type: 'integer' },
        duration: { type: 'string', enum: ['short', 'medium', 'long'] },
      },
    },
    creator: {
      type: 'object',
      additionalProperties: false,
      properties: { id: { type: 'string' }, name: { type: 'string' } },
    },
    text: {
      type: 'object',
      additionalProperties: false,
      properties: { copyright: { type: 'string', enum: ['public-domain', 'copyrighted', 'any'] } },
    },
    page: { type: 'integer', description: 'provider-local page (1-based)' },
  },
} as const satisfies ObjectValueSchemaSpec

/** `group.field` for nested object properties, bare name for scalars. */
export function flattenControlKeys(spec: ObjectValueSchemaSpec): string[] {
  const out: string[] = []
  for (const [name, node] of Object.entries(spec.properties ?? {})) {
    if ('type' in node && node.type === 'object') {
      for (const field of Object.keys(node.properties ?? {})) out.push(`${name}.${field}`)
    } else {
      out.push(name)
    }
  }
  return out
}
```

- [ ] **Step 4: Run the tests, typecheck, lint**

Run: `pnpm test -- controls && pnpm typecheck && pnpm lint`
Expected: PASS. If the compile-time assignability test fails on `media.kind` (core's `ResourceKind` is `WellKnownKind | (string & {})`), that is a real drift — report it rather than loosening the test.

- [ ] **Step 5: Commit**

```bash
git add src/tools/controls.ts tests/controls.test.ts
git commit -m "feat: dsh DSL mirror of core SearchControls, pinned to SEARCH_CONTROL_KEYS"
```

---

### Task 4: `refkit_search` — run, render, presentation metadata, tool definition

**Files:**
- Create: `src/tools/search.ts`, `src/render.ts`
- Test: `tests/search.test.ts`, `tests/render.test.ts`

**Interfaces:**
- Consumes: `CONTROLS_PARAMETER` (Task 3); `ResolvedConfig`, `PROVIDER_IDS`, `PROVIDER_REGISTRY`, `KEYLESS_IDS` (Task 2); `SearchOutcome`, `RefTile`, `SourceStatus`, `CardOutcome`, `MODALITIES`, `trunc`, `narrowOutcome` (Task 1); from `@refkit/core`: `RefkitClient`, `Reference`, `ProviderSearchStatus`, `SearchInput`, `Verdict`, `Attribution`, `INTENTS`, `Intent`; from `@deepseek-ai/dsh-tools`: `defineTool`, `ToolDefinition`, `InferArgs`, `ParameterSchemaSpec`, `ValueSchemaSpec`, `GenericCallView`, `GenericResultView`.
- Produces: `SEARCH_TOOL_NAME = 'refkit_search'`, `SEARCH_PARAMETERS`, `SEARCH_OUTPUT`, `SearchArgs`, `SearchDeps { client(): RefkitClient; config(): ResolvedConfig }`, `runSearch(args, deps, signal?)`, `toTile(ref, assessment?)`, `toSourceStatus(status)`, `createSearchTool(deps): ToolDefinition`; from `src/render.ts`: `renderSearch(value: SearchOutcome): string`, `cardMeta(value: SearchOutcome): CardOutcome`.

- [ ] **Step 1: Write the failing render tests**

`tests/render.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { cardMeta, renderSearch } from '../src/render.ts'
import type { SearchOutcome } from '../src/core/outcome.ts'

const base: SearchOutcome = {
  query: 'neon alley',
  modalities: ['image'],
  intent: 'commercial-product',
  count: 2,
  references: [
    { id: 'openverse:1', modality: 'image', provider: 'openverse', canonicalUrl: 'https://o/1', license: 'CC-BY', licenseVersion: '4.0', title: 'Neon alley', useVerdict: { decision: 'allowed-with-attribution', reason: 'attribution required', confidence: 'high' }, attribution: '"Neon alley" by A (CC BY 4.0)', description: 'x'.repeat(300), tags: ['neon', 'alley'] },
    { id: 'gutendex:2', modality: 'text', provider: 'gutendex', canonicalUrl: 'https://g/2', license: 'PD', excerpt: 'It was a bright cold day in April, and the clocks were striking thirteen. '.repeat(5), useVerdict: { decision: 'allowed', reason: '', confidence: 'high' } },
  ],
  nextCursor: 'abc',
  sources: [{ id: 'openverse', status: 'fulfilled', returned: 5 }, { id: 'met', status: 'failed', reason: undefined }, { id: 'nailbook', status: 'skipped', reason: 'declined' }],
  warnings: ['met: upstream 503'],
}

describe('renderSearch', () => {
  it('lists every reference with provider, license, decision and url', () => {
    const text = renderSearch(base)
    const lines = text.split('\n')
    expect(lines[0]).toBe('2 reference(s) for "neon alley" — intent: commercial-product')
    expect(lines[1]).toBe('1. Neon alley — openverse — CC-BY 4.0 — allowed-with-attribution — https://o/1')
    expect(lines[2]).toBe('   credit: "Neon alley" by A (CC BY 4.0)')
    expect(lines[3]).toBe('2. (untitled) — gutendex — PD — allowed — https://g/2')
    expect(lines[4].startsWith('   excerpt: It was a bright cold day')).toBe(true)
    expect(lines[4].length).toBeLessThanOrEqual('   excerpt: '.length + 160)
    expect(text).toContain('warning: met: upstream 503')
    expect(text).toContain('more: pass cursor "abc" to continue')
  })
  it('renders the empty note and omits the intent suffix when absent', () => {
    const text = renderSearch({ ...base, intent: undefined, count: 0, references: [], nextCursor: undefined, warnings: [], note: 'No results' })
    expect(text.split('\n')[0]).toBe('0 reference(s) for "neon alley"')
    expect(text).toContain('No results')
    expect(text).not.toContain('intent:')
    expect(text).not.toContain('more:')
  })
})

describe('cardMeta', () => {
  it('drops meta and tags and cuts descriptions at 200 code points', () => {
    const meta = cardMeta({ ...base, meta: { passes: 1 } })
    expect('meta' in meta).toBe(false)
    expect(meta.references[0].tags).toBeUndefined()
    expect(Array.from(meta.references[0].description ?? '').length).toBe(200)
    expect(meta.references[1].excerpt).toBe(base.references[1].excerpt)
  })
  it('contains no undefined-valued properties', () => {
    const meta = cardMeta(base)
    const walk = (v: unknown, path: string): void => {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`))
      else if (typeof v === 'object' && v !== null) {
        for (const [k, x] of Object.entries(v)) {
          expect(x, `${path}.${k}`).not.toBeUndefined()
          walk(x, `${path}.${k}`)
        }
      }
    }
    walk(meta, 'meta')
  })
})
```

- [ ] **Step 2: Write the failing search tests**

`tests/search.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createRefkit, defineProvider, type EmittedReference, type LicenseId } from '@refkit/core'
import { assertSupportedJsonSchema, parameterSchemaSpecToJsonSchema, valueSchemaSpecToJsonSchema } from '@deepseek-ai/dsh-tools'
import { resolveConfig } from '../src/config.ts'
import { SEARCH_OUTPUT, SEARCH_PARAMETERS, SEARCH_TOOL_NAME, createSearchTool, runSearch, type SearchDeps } from '../src/tools/search.ts'
import { narrowOutcome } from '../src/core/outcome.ts'

const emit = (url: string, license: LicenseId, extra: Partial<EmittedReference> = {}): EmittedReference => ({
  modality: 'image',
  title: `title ${url}`,
  sourceUrl: url,
  rights: { license, author: 'Ada', rehostPolicy: 'cache-allowed', raw: { sourceTerms: 't', sourceUrl: url } },
  thumbnail: { url: `${url}/t.jpg` },
  visual: { width: 800, height: 600 },
  ...extra,
})

const provider = (id: string, refs: EmittedReference[]) =>
  defineProvider({ id, modalities: ['image'], search: async () => refs })
const failing = (id: string) =>
  defineProvider({ id, modalities: ['image'], search: async () => { throw new Error('boom ' + 'x'.repeat(300)) } })

function deps(providers: ReturnType<typeof defineProvider>[], config = resolveConfig({}, {})): SearchDeps {
  const client = createRefkit({ providers, rerank: false, sourceConfidence: false, userAgent: false })
  return { client: () => client, config: () => config }
}

describe('schemas', () => {
  it('compile within the dsh enforced subset', () => {
    expect(() => assertSupportedJsonSchema(parameterSchemaSpecToJsonSchema(SEARCH_PARAMETERS))).not.toThrow()
    expect(() => assertSupportedJsonSchema(valueSchemaSpecToJsonSchema(SEARCH_OUTPUT))).not.toThrow()
  })
  it('defineTool accepts the definition', () => {
    const def = createSearchTool(deps([provider('a', [emit('https://a/1', 'CC0-1.0')])]))
    expect(def.name).toBe(SEARCH_TOOL_NAME)
    expect(def.timeoutMs).toBe(15000 + 5000)
  })
})

describe('runSearch', () => {
  it('returns tiles with provenance and license and no undefined keys', async () => {
    const out = await runSearch({ query: 'lion' }, deps([provider('a', [emit('https://a/1', 'CC-BY', { rights: { license: 'CC-BY', licenseVersion: '4.0', author: 'Ada', rehostPolicy: 'cache-allowed', raw: { sourceTerms: 't', sourceUrl: 'https://a/1' } } })]))
    expect(out.query).toBe('lion')
    expect(out.modalities).toEqual(['image'])
    expect(out.count).toBe(1)
    const tile = out.references[0]
    expect(tile).toMatchObject({ provider: 'a', canonicalUrl: 'https://a/1', license: 'CC-BY', licenseVersion: '4.0', author: 'Ada', thumbnail: 'https://a/1/t.jpg', width: 800, height: 600, title: 'title https://a/1' })
    expect(tile.useVerdict).toBeUndefined()
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
    expect(out.sources).toEqual([{ id: 'a', status: 'fulfilled', returned: 1 }])
    expect(narrowOutcome(out)).toEqual(out)
  })
  it('annotates a verdict and credit line when intent is set, without filtering', async () => {
    const out = await runSearch({ query: 'lion', intent: 'commercial-product' }, deps([provider('a', [emit('https://a/1', 'CC-BY'), emit('https://a/2', 'CC-BY-NC')])]))
    expect(out.intent).toBe('commercial-product')
    expect(out.count).toBe(2)
    const byUrl = Object.fromEntries(out.references.map(r => [r.canonicalUrl, r]))
    expect(byUrl['https://a/1'].useVerdict?.decision).toBe('allowed-with-attribution')
    expect(byUrl['https://a/1'].attribution).toContain('Ada')
    expect(byUrl['https://a/2'].useVerdict?.decision).toBe('denied')
    expect(byUrl['https://a/2'].attribution).toBeUndefined()
  })
  it('gateFor filters to allowed results and still annotates', async () => {
    const out = await runSearch({ query: 'lion', gateFor: 'commercial-product' }, deps([provider('a', [emit('https://a/1', 'CC0-1.0'), emit('https://a/2', 'CC-BY-NC')])]))
    expect(out.references.map(r => r.canonicalUrl)).toEqual(['https://a/1'])
    expect(out.references[0].useVerdict?.decision).toBe('allowed')
  })
  it('defaults limit from config and clamps an oversized request', async () => {
    const many = Array.from({ length: 40 }, (_, i) => emit(`https://a/${i}`, 'CC0-1.0'))
    const d = deps([provider('a', many)], resolveConfig({ limit: 5 }, {}))
    expect((await runSearch({ query: 'x' }, d)).count).toBe(5)
    expect((await runSearch({ query: 'x', limit: 99 }, d)).count).toBe(30)
  })
  it('reports partial failure as a warning and a failed source, not an error', async () => {
    const out = await runSearch({ query: 'x' }, deps([provider('a', [emit('https://a/1', 'CC0-1.0')]), failing('b')]))
    expect(out.count).toBe(1)
    expect(out.sources.find(s => s.id === 'b')?.status).toBe('failed')
    expect(out.warnings.some(w => w.includes('b'))).toBe(true)
    for (const w of out.warnings) expect(w.length).toBeLessThanOrEqual(260)
  })
  it('throws a bounded message when every source fails', async () => {
    await expect(runSearch({ query: 'x' }, deps([failing('a'), failing('b')]))).rejects.toThrow(/all 2 sources failed: a: boom/)
    await expect(runSearch({ query: 'x' }, deps([failing('a')]))).rejects.toThrow((e: Error) => e.message.length < 400)
  })
  it('maps an unknown sources id to an actionable error', async () => {
    await expect(runSearch({ query: 'x', sources: ['nope'] }, deps([provider('a', [])]))).rejects.toThrow(/nope.*Enabled source ids: a/)
  })
  it('names the settings card for a known but unconfigured keyed source', async () => {
    await expect(runSearch({ query: 'x', sources: ['unsplash'] }, deps([provider('a', [])]))).rejects.toThrow(/Settings -> Plugins -> refkit/)
  })
  it('sets the note on an empty result and rejects a blank query', async () => {
    const out = await runSearch({ query: 'x' }, deps([provider('a', [])]))
    expect(out.count).toBe(0)
    expect(out.note).toMatch(/No results/)
    await expect(runSearch({ query: '   ' }, deps([provider('a', [])]))).rejects.toThrow(/non-empty/)
  })
  it('includes core meta only with explain', async () => {
    const d = deps([provider('a', [emit('https://a/1', 'CC0-1.0')])])
    expect((await runSearch({ query: 'x' }, d)).meta).toBeUndefined()
    const explained = await runSearch({ query: 'x', explain: true }, d)
    expect((explained.meta as { passes: number }).passes).toBe(1)
    expect(JSON.parse(JSON.stringify(explained))).toEqual(explained)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test -- search render`
Expected: FAIL — cannot resolve `../src/render.ts` and `../src/tools/search.ts`.

- [ ] **Step 4: Write `src/render.ts`**

```ts
/**
 * Model-facing text for refkit_search and the bounded presentation metadata
 * the web card reads. Pure functions of the canonical value.
 * @module @refkit/dsh-plugin/render
 */

import { trunc, type CardOutcome, type RefTile, type SearchOutcome } from './core/outcome.ts'

const EXCERPT_CHARS = 160
const DESCRIPTION_CHARS = 200

function licenseLabel(tile: RefTile): string {
  return tile.licenseVersion ? `${tile.license} ${tile.licenseVersion}` : tile.license
}

/** One numbered line per reference plus credit/excerpt sub-lines, warnings and the cursor hint. */
export function renderSearch(value: SearchOutcome): string {
  const lines: string[] = []
  lines.push(`${value.count} reference(s) for "${value.query}"${value.intent ? ` — intent: ${value.intent}` : ''}`)
  value.references.forEach((tile, i) => {
    const decision = tile.useVerdict ? ` — ${tile.useVerdict.decision}` : ''
    lines.push(`${i + 1}. ${tile.title ?? '(untitled)'} — ${tile.provider} — ${licenseLabel(tile)}${decision} — ${tile.canonicalUrl}`)
    if (tile.attribution) lines.push(`   credit: ${tile.attribution}`)
    if (tile.modality === 'text' && tile.excerpt) lines.push(`   excerpt: ${trunc(tile.excerpt.replace(/\s+/g, ' ').trim(), EXCERPT_CHARS)}`)
  })
  if (value.note) lines.push(value.note)
  for (const warning of value.warnings) lines.push(`warning: ${warning}`)
  if (value.nextCursor) lines.push(`more: pass cursor "${value.nextCursor}" to continue`)
  return lines.join('\n')
}

/** Bounded, replayable card data: no meta, no tags, descriptions cut, no undefined values. */
export function cardMeta(value: SearchOutcome): CardOutcome {
  const references = value.references.map((tile) => {
    const { tags: _tags, description, ...rest } = tile
    return description === undefined ? rest : { ...rest, description: trunc(description, DESCRIPTION_CHARS) }
  })
  const out: CardOutcome = {
    query: value.query,
    modalities: value.modalities,
    count: value.count,
    references,
    sources: value.sources,
    warnings: value.warnings,
  }
  if (value.intent !== undefined) out.intent = value.intent
  if (value.nextCursor !== undefined) out.nextCursor = value.nextCursor
  if (value.note !== undefined) out.note = value.note
  return out
}
```

Note: `trunc` pads to `max` including the ellipsis, so a 300-char description becomes 199 chars + `…` = 200 code points, which is what the test asserts.

- [ ] **Step 5: Write `src/tools/search.ts`**

```ts
/**
 * The refkit_search tool: parameter and output schemas in dsh's DSL, the
 * execution that maps core's SearchResult onto the canonical SearchOutcome,
 * and the defineTool wrapper. All ranking and rights logic stays in
 * @refkit/core; this file only shapes inputs and outputs.
 * @module @refkit/dsh-plugin/tools/search
 */

import { defineTool, type GenericCallView, type GenericResultView, type InferArgs, type InferValue, type ParameterSchemaSpec, type ToolDefinition, type ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import { INTENTS, type Attribution, type Intent, type ProviderSearchStatus, type Reference, type RefkitClient, type SearchInput, type Verdict } from '@refkit/core'
import { KEYLESS_IDS, PROVIDER_IDS, PROVIDER_REGISTRY, type ResolvedConfig } from '../config.ts'
import { DECISIONS, MODALITIES, SOURCE_STATUSES, narrowOutcome, trunc, type Json, type RefTile, type SearchOutcome, type SourceStatus } from '../core/outcome.ts'
import { cardMeta, renderSearch } from '../render.ts'
import { CONTROLS_PARAMETER } from './controls.ts'

export const SEARCH_TOOL_NAME = 'refkit_search'
const MAX_LIMIT = 30
const ERROR_CHARS = 200

export interface SearchDeps {
  client(): RefkitClient
  config(): ResolvedConfig
}

export const SEARCH_PARAMETERS = {
  query: { type: 'string', required: true, description: 'What to search for, e.g. "cyberpunk alley at night". Translate to concise English keywords unless the source is language-specific.' },
  modalities: { type: 'array', items: { type: 'string', enum: MODALITIES }, description: 'Default ["image"]. text = passages/poems/books; audio = sounds/music; video = clips.' },
  intent: { type: 'string', enum: INTENTS, description: 'Annotate every result with a use-verdict (allowed / allowed-with-attribution / denied / needs-review) and a credit line for this intended use. No filtering.' },
  gateFor: { type: 'string', enum: INTENTS, description: 'Return only results whose license allows this intended use (also annotates). Prefer over intent when the user needs usable material only.' },
  sources: { type: 'array', items: { type: 'string' }, description: 'Restrict to provider ids (see the tool description). Omit to search every enabled source.' },
  limit: { type: 'integer', description: 'Results to return, 1..30. Default from configuration (12).' },
  cursor: { type: 'string', description: 'Opaque continuation from a previous result\'s nextCursor.' },
  controls: CONTROLS_PARAMETER,
  minRelevance: { type: 'number', description: 'Drop results the ranker scored below this (0..1) after reranking. A result matching no query term lands around 0.3 under the default weights, so 0.5 keeps only real matches. Off by default.' },
  explain: { type: 'boolean', description: 'Include core\'s full search metadata (per-source status, applied/ignored controls, gate and threshold counts) under meta.' },
} as const satisfies ParameterSchemaSpec

export type SearchArgs = InferArgs<typeof SEARCH_PARAMETERS>

const tileSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true },
    modality: { type: 'string', enum: MODALITIES, required: true },
    provider: { type: 'string', required: true },
    canonicalUrl: { type: 'string', required: true },
    license: { type: 'string', required: true },
    title: { type: 'string' },
    kind: { type: 'string' },
    licenseVersion: { type: 'string' },
    author: { type: 'string' },
    thumbnail: { type: 'string' },
    preview: { type: 'string' },
    width: { type: 'number' },
    height: { type: 'number' },
    description: { type: 'string' },
    excerpt: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    useVerdict: {
      type: 'object',
      additionalProperties: false,
      properties: {
        decision: { type: 'string', enum: DECISIONS, required: true },
        reason: { type: 'string', required: true },
        confidence: { type: 'string', enum: ['high', 'low'], required: true },
      },
    },
    attribution: { type: 'string' },
  },
} as const satisfies ValueSchemaSpec

export const SEARCH_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: { type: 'string', required: true },
    modalities: { type: 'array', items: { type: 'string', enum: MODALITIES }, required: true },
    intent: { type: 'string' },
    count: { type: 'integer', required: true },
    references: { type: 'array', items: tileSchema, required: true },
    nextCursor: { type: 'string' },
    sources: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          status: { type: 'string', enum: SOURCE_STATUSES, required: true },
          reason: { type: 'string' },
          returned: { type: 'integer' },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' }, required: true },
    note: { type: 'string' },
    meta: { type: 'json' },
  },
} as const satisfies ValueSchemaSpec

// The DSL-inferred output and the hand-written SearchOutcome must agree in both directions.
type InferredOutcome = InferValue<typeof SEARCH_OUTPUT>
const _outcomeCheckA: InferredOutcome = {} as SearchOutcome
const _outcomeCheckB: SearchOutcome = {} as InferredOutcome
void _outcomeCheckA
void _outcomeCheckB

const SOURCE_LIST = PROVIDER_REGISTRY
  .map(e => `${e.id} (${e.modalities.join('/')}${e.key ? ', needs key' : ''})`)
  .join(', ')

const DESCRIPTION =
  'Search license-normalized creative references (images, video, audio, text passages) across up to 23 sources and return them ranked, deduplicated, and each tagged with its license and canonical source link. '
  + 'Use for reference pictures, moodboards, textures/HDRIs, public-domain artworks, sound effects, music, poems and book passages — not for web pages. '
  + 'Pass `intent` when the user has said how the material will be used so every result carries a use-verdict and a ready credit line; pass `gateFor` to return only usable results. '
  + 'Results are references, not rights clearance. '
  + `Sources: ${SOURCE_LIST}. Keyed sources are inactive until their key is set under Settings -> Plugins -> refkit.`

function defined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

function message(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return trunc(raw, ERROR_CHARS)
}

/** Project one core Reference (plus optional assessment) onto a tile with no undefined keys. */
export function toTile(ref: Reference, assessment?: { verdict: Verdict; attribution: Attribution }): RefTile {
  const tile = defined({
    id: ref.id,
    modality: ref.modality,
    provider: ref.source.providerId,
    canonicalUrl: ref.canonicalUrl,
    license: ref.rights.license,
    title: ref.title,
    kind: ref.kind,
    licenseVersion: ref.rights.licenseVersion,
    author: ref.rights.author,
    thumbnail: ref.thumbnail?.url,
    preview: ref.preview?.url,
    width: ref.visual?.width,
    height: ref.visual?.height,
    description: ref.description,
    excerpt: ref.text?.excerpt,
    tags: ref.tags && ref.tags.length > 0 ? ref.tags : undefined,
  }) as RefTile
  if (assessment) {
    const { verdict, attribution } = assessment
    tile.useVerdict = { decision: verdict.decision, reason: verdict.reasons.join('; '), confidence: verdict.confidence }
    if (attribution.required && attribution.text) tile.attribution = attribution.text
  }
  return tile
}

/** Compact projection of core's per-provider status. */
export function toSourceStatus(status: ProviderSearchStatus): SourceStatus {
  return defined({
    id: status.providerId,
    status: status.status,
    reason: status.reason,
    returned: status.returned,
  }) as SourceStatus
}

function sourcesError(err: unknown, requested: readonly string[], enabled: readonly string[]): Error {
  const unconfigured = requested.filter(id => PROVIDER_IDS.includes(id) && !enabled.includes(id) && !KEYLESS_IDS.includes(id))
  const hint = unconfigured.length > 0
    ? ` ${unconfigured.join(', ')}: configure its key under Settings -> Plugins -> refkit.`
    : ''
  return new Error(`${message(err)} Enabled source ids: ${enabled.join(', ') || '(none)'}.${hint}`)
}

/** Execute one search against the current client and shape the canonical value. */
export async function runSearch(args: SearchArgs, deps: SearchDeps, signal?: AbortSignal): Promise<SearchOutcome> {
  const query = args.query.trim()
  if (query.length === 0) throw new Error('refkit_search: query must be a non-empty string')
  const cfg = deps.config()
  const client = deps.client()
  const modalities = args.modalities && args.modalities.length > 0 ? [...args.modalities] : (['image'] as SearchOutcome['modalities'])
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(args.limit ?? cfg.limit)))
  const intent: Intent | undefined = args.intent ?? args.gateFor

  const input: SearchInput = defined({
    query,
    modalities,
    sources: args.sources,
    controls: args.controls,
    limit,
    cursor: args.cursor,
    poolFactor: cfg.poolFactor,
    deadlineMs: cfg.deadlineMs,
    minRelevance: args.minRelevance,
    gateFor: args.gateFor,
    signal,
  })

  let result
  try {
    result = await client.searchWithMeta(input)
  } catch (err) {
    if (err instanceof AggregateError) {
      const parts = err.errors.map((e: unknown) => {
        const pe = e as { providerId?: string; error?: unknown }
        const inner = pe && typeof pe === 'object' && 'error' in pe ? pe.error : e
        return `${pe?.providerId ?? '?'}: ${message(inner)}`
      })
      throw new Error(`all ${err.errors.length} sources failed: ${parts.join('; ')}`)
    }
    if (args.sources && args.sources.length > 0) {
      throw sourcesError(err, args.sources, client.providers.map(p => p.id))
    }
    throw err
  }

  const references = result.references.map(ref =>
    intent
      ? toTile(ref, { verdict: client.evaluateUse(ref, intent), attribution: client.buildAttribution(ref) })
      : toTile(ref),
  )
  const outcome: SearchOutcome = {
    query,
    modalities,
    count: references.length,
    references,
    sources: result.meta.providers.map(toSourceStatus),
    warnings: result.meta.warnings.map(w => trunc(w, ERROR_CHARS + 60)),
  }
  if (intent) outcome.intent = intent
  if (result.meta.nextCursor) outcome.nextCursor = result.meta.nextCursor
  if (references.length === 0) outcome.note = 'No results; try broader terms, another modality, or fewer controls.'
  if (args.explain) outcome.meta = JSON.parse(JSON.stringify(result.meta)) as Json
  return outcome
}

function presentCall(args: SearchArgs): GenericCallView {
  return { card: 'generic', title: 'refkit search', kind: 'search', rawInput: defined({ query: args.query, modalities: args.modalities, intent: args.intent ?? args.gateFor }) }
}

/** The registered definition; `timeoutMs` is fixed from the configuration at registration time. */
export function createSearchTool(deps: SearchDeps): ToolDefinition {
  return defineTool({
    name: SEARCH_TOOL_NAME,
    description: DESCRIPTION,
    parameters: SEARCH_PARAMETERS,
    output: {
      schema: SEARCH_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: renderSearch(value) }],
      presentationMeta: (_args, value) => cardMeta(value) as unknown as Json,
    },
    timeoutMs: deps.config().deadlineMs + 5000,
    isConcurrencySafe: () => true,
    presentCall,
    presentResult: (_args, result): GenericResultView => {
      const meta = narrowOutcome(result.meta)
      return { card: 'generic', title: meta ? `${meta.count} refs for "${meta.query}"` : 'refkit search', content: result.content }
    },
    execute: (args, exec) => runSearch(args, deps, exec.signal),
  })
}
```

Note on the error path: core throws `AggregateError` whose `errors` are the raw provider errors (see `pipeline.ts` `runs.filter(r => !r.ok).map(r => r.error)`). If those entries carry no `providerId`, the test regex `a: boom` will fail; in that case derive the id from `result` being unavailable is impossible, so instead build the message from `client.providers` order when `err.errors.length === client.providers.length` — implement that fallback and keep the test. Report which branch the real error shape needed.

- [ ] **Step 6: Run the tests, typecheck, lint**

Run: `pnpm test -- search render && pnpm typecheck && pnpm lint`
Expected: all PASS. The two compile-time assignability constants in `search.ts` must typecheck; if `InferValue` widens `width`/`height` to `number` while `RefTile` says `number | undefined`, both directions still hold because the property is optional in both. If `meta: { type: 'json' }` infers a type incompatible with `Json`, align `Json` to dsh's `JsonValue` (import it as a type from `@deepseek-ai/dsh-tools`).

- [ ] **Step 7: Commit**

```bash
git add src/tools/search.ts src/render.ts tests/search.test.ts tests/render.test.ts
git commit -m "feat: refkit_search tool — canonical outcome, verdict annotation, render text, card metadata"
```

---

### Task 5: `refkit_rights` tool

**Files:**
- Create: `src/tools/rights.ts`
- Test: `tests/rights.test.ts`

**Interfaces:**
- Consumes: from `@refkit/core`: `evaluateUse`, `buildAttribution`, `ccVersionFor`, `licenseFactsSchema`, `INTENTS`, `RightsRecord`, `LicenseFacts`; `DECISIONS` (Task 1); `defineTool` and types from `@deepseek-ai/dsh-tools`.
- Produces: `RIGHTS_TOOL_NAME = 'refkit_rights'`, `RIGHTS_PARAMETERS`, `RIGHTS_OUTPUT`, `RightsArgs`, `RightsOutcome`, `runRights(args): RightsOutcome`, `renderRights(value): string`, `createRightsTool(): ToolDefinition`.

- [ ] **Step 1: Write the failing test**

`tests/rights.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { assertSupportedJsonSchema, parameterSchemaSpecToJsonSchema, valueSchemaSpecToJsonSchema } from '@deepseek-ai/dsh-tools'
import { RIGHTS_OUTPUT, RIGHTS_PARAMETERS, RIGHTS_TOOL_NAME, createRightsTool, renderRights, runRights } from '../src/tools/rights.ts'

const url = 'https://example.org/work/1'

describe('refkit_rights', () => {
  it('schemas compile and defineTool accepts the definition', () => {
    expect(() => assertSupportedJsonSchema(parameterSchemaSpecToJsonSchema(RIGHTS_PARAMETERS))).not.toThrow()
    expect(() => assertSupportedJsonSchema(valueSchemaSpecToJsonSchema(RIGHTS_OUTPUT))).not.toThrow()
    expect(createRightsTool().name).toBe(RIGHTS_TOOL_NAME)
  })
  it('a known permissive license with attribution', () => {
    const out = runRights({ license: 'CC-BY', licenseVersion: '4.0', author: 'Ada', title: 'Lion', canonicalUrl: url, intent: 'commercial-product' })
    expect(out.decision).toBe('allowed-with-attribution')
    expect(out.attribution.required).toBe(true)
    expect(out.attribution.text).toContain('Ada')
    expect(out.attribution.text).toContain('4.0')
    expect(out.disclaimer.length).toBeGreaterThan(10)
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
  })
  it('a non-commercial license is denied for commercial use and needs no credit line', () => {
    const out = runRights({ license: 'CC-BY-NC', canonicalUrl: url, intent: 'commercial-product' })
    expect(out.decision).toBe('denied')
    expect(out.attribution.text).toBeUndefined()
  })
  it('an unknown id without facts is needs-review (strict deny by construction)', () => {
    const out = runRights({ license: 'acme-stock-standard', canonicalUrl: url, intent: 'internal-moodboard' })
    expect(out.decision).toBe('needs-review')
  })
  it('an unknown id with facts is judged on the facts', () => {
    const out = runRights({
      license: 'acme-stock-standard',
      canonicalUrl: url,
      intent: 'commercial-product',
      facts: { commercialUse: true, derivatives: true, redistribution: false, attributionRequired: false, shareAlike: false },
    })
    expect(out.decision).toBe('allowed')
    expect(out.attribution.required).toBe(false)
  })
  it('rejects incomplete facts with core\'s schema message', () => {
    expect(() => runRights({ license: 'x', canonicalUrl: url, intent: 'redistribution', facts: { commercialUse: true } as never })).toThrow(/facts/)
  })
  it('licenseVersion is dropped for non-CC ids and kept for CC families', () => {
    expect(runRights({ license: 'PD', licenseVersion: '4.0', canonicalUrl: url, intent: 'redistribution' }).attribution.text ?? '').not.toContain('4.0')
    expect(runRights({ license: 'CC-BY-SA', licenseVersion: '3.0', author: 'B', canonicalUrl: url, intent: 'redistribution' }).attribution.text).toContain('3.0')
  })
  it('renders decision, reasons, credit and disclaimer', () => {
    const text = renderRights(runRights({ license: 'CC-BY', author: 'Ada', canonicalUrl: url, intent: 'commercial-product' }))
    expect(text.split('\n')[0]).toMatch(/^allowed-with-attribution \(high\): /)
    expect(text).toContain('credit: ')
    expect(text).toContain('not legal advice')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- rights`
Expected: FAIL — cannot resolve `../src/tools/rights.ts`.

- [ ] **Step 3: Write `src/tools/rights.ts`**

```ts
/**
 * The refkit_rights tool: a stateless use-gate check for one license id (or
 * a facts row) against an intended use, returning core's verdict and the
 * credit line. Lets the model re-check a result for a new intent without
 * searching again.
 * @module @refkit/dsh-plugin/tools/rights
 */

import { defineTool, type InferArgs, type InferValue, type ParameterSchemaSpec, type ToolDefinition, type ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import { INTENTS, buildAttribution, ccVersionFor, evaluateUse, licenseFactsSchema, type LicenseFacts, type RightsRecord } from '@refkit/core'
import { DECISIONS } from '../core/outcome.ts'

export const RIGHTS_TOOL_NAME = 'refkit_rights'

const TRI = { oneOf: [{ type: 'boolean' }, { type: 'string', const: 'unknown' }] } as const

export const RIGHTS_PARAMETERS = {
  license: { type: 'string', required: true, description: 'License id as returned by refkit_search (e.g. CC-BY, CC0-1.0, PD, unsplash). An unknown id without `facts` resolves to needs-review.' },
  intent: { type: 'string', enum: INTENTS, required: true, description: 'The intended use to evaluate.' },
  canonicalUrl: { type: 'string', required: true, description: 'Canonical source link, for the credit line and audit.' },
  licenseVersion: { type: 'string', description: 'CC version such as "4.0"; ignored for non-CC ids.' },
  author: { type: 'string' },
  title: { type: 'string' },
  editorialOnly: { type: 'boolean', description: 'Source marked editorial-only.' },
  jurisdiction: { type: 'string', description: 'Source-declared jurisdiction of a public-domain status.' },
  userJurisdiction: { type: 'string', description: 'Caller\'s jurisdiction; a mismatch defaults to needs-review.' },
  facts: {
    type: 'object',
    additionalProperties: false,
    description: 'Override the license table with source-declared facts (all five fields required when present).',
    properties: {
      commercialUse: TRI,
      derivatives: TRI,
      redistribution: TRI,
      attributionRequired: { type: 'boolean' },
      shareAlike: { type: 'boolean' },
    },
  },
} as const satisfies ParameterSchemaSpec

export type RightsArgs = InferArgs<typeof RIGHTS_PARAMETERS>

export const RIGHTS_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    decision: { type: 'string', enum: DECISIONS, required: true },
    reasons: { type: 'array', items: { type: 'string' }, required: true },
    confidence: { type: 'string', enum: ['high', 'low'], required: true },
    attribution: {
      type: 'object',
      additionalProperties: false,
      required: true,
      properties: {
        required: { type: 'boolean', required: true },
        text: { type: 'string' },
        html: { type: 'string' },
      },
    },
    disclaimer: { type: 'string', required: true },
  },
} as const satisfies ValueSchemaSpec

export type RightsOutcome = InferValue<typeof RIGHTS_OUTPUT>

/** Evaluate one license for one intent; pure and synchronous. */
export function runRights(args: RightsArgs): RightsOutcome {
  let facts: LicenseFacts | undefined
  if (args.facts !== undefined) {
    const parsed = licenseFactsSchema.safeParse(args.facts)
    if (!parsed.success) throw new Error(`refkit_rights: invalid facts — ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
    facts = parsed.data
  }
  const licenseVersion = ccVersionFor(args.license, args.licenseVersion)
  const rights: RightsRecord = {
    license: args.license,
    rehostPolicy: 'cache-allowed',
    raw: { sourceTerms: '', sourceUrl: args.canonicalUrl },
    ...(facts ? { facts } : {}),
    ...(licenseVersion ? { licenseVersion } : {}),
    ...(args.author ? { author: args.author } : {}),
    ...(args.jurisdiction ? { jurisdiction: args.jurisdiction } : {}),
    ...(args.editorialOnly !== undefined ? { editorialOnly: args.editorialOnly } : {}),
  }
  const verdict = evaluateUse(rights, args.intent, args.userJurisdiction ? { userJurisdiction: args.userJurisdiction } : undefined)
  const attribution = buildAttribution({
    license: args.license,
    canonicalUrl: args.canonicalUrl,
    ...(facts ? { facts } : {}),
    ...(licenseVersion ? { licenseVersion } : {}),
    ...(args.author ? { author: args.author } : {}),
    ...(args.title ? { title: args.title } : {}),
  })
  return {
    decision: verdict.decision,
    reasons: verdict.reasons,
    confidence: verdict.confidence,
    attribution: {
      required: attribution.required,
      ...(attribution.text ? { text: attribution.text } : {}),
      ...(attribution.html ? { html: attribution.html } : {}),
    },
    disclaimer: verdict.disclaimer,
  }
}

/** Model-facing text: verdict line, credit line when required, disclaimer. */
export function renderRights(value: RightsOutcome): string {
  const lines = [`${value.decision} (${value.confidence}): ${value.reasons.join('; ') || 'license facts allow this use'}`]
  if (value.attribution.required && value.attribution.text) lines.push(`credit: ${value.attribution.text}`)
  lines.push(value.disclaimer)
  return lines.join('\n')
}

export function createRightsTool(): ToolDefinition {
  return defineTool({
    name: RIGHTS_TOOL_NAME,
    description:
      'Stateless license check: given a license id (or source-declared facts) and an intended use, return a conservative verdict '
      + '(allowed / allowed-with-attribution / denied / needs-review) with reasons, confidence and a ready credit line. '
      + 'Use it to re-check one refkit_search result for a different intent without searching again. Not legal advice.',
    parameters: RIGHTS_PARAMETERS,
    output: {
      schema: RIGHTS_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: renderRights(value) }],
    },
    timeoutMs: 5000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({ card: 'generic', title: 'refkit rights check', kind: 'other', rawInput: { license: args.license, intent: args.intent } }),
    presentResult: (_args, result) => ({ card: 'generic', content: result.content }),
    execute: async (args) => runRights(args),
  })
}
```

If `AttributionInput.title` does not exist in core (check `packages/core/src/attribution.ts` in the refkit checkout at `/Users/xuan/Desktop/testSpace/refkit`), drop the `title` spread from `buildAttribution` and keep the parameter (it is still echoed nowhere; remove it from `RIGHTS_PARAMETERS` too and from the tests).

- [ ] **Step 4: Run the tests, typecheck, lint**

Run: `pnpm test -- rights && pnpm typecheck && pnpm lint`
Expected: PASS. If `licenseFactsSchema.safeParse` is not available because core exports a zod v4 schema with a different API, use `licenseFactsSchema.parse` inside try/catch and rethrow with the same prefix.

- [ ] **Step 5: Commit**

```bash
git add src/tools/rights.ts tests/rights.test.ts
git commit -m "feat: refkit_rights tool — stateless use-gate check with credit line"
```

---

### Task 6: Plugin entry — settings section, client rebuild, system prompt, registrations

**Files:**
- Create: `src/index.ts`
- Test: `tests/index.test.ts`

**Interfaces:**
- Consumes: `Config` (schema + type), `resolveConfig`, `validateConfig`, `buildClient`, `ResolvedConfig` (Task 2); `createSearchTool`, `SearchDeps`, `runSearch` (Task 4); `createRightsTool` (Task 5); `Context` from `@deepseek-ai/cordis`; type augmentations from `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-settings`, `@deepseek-ai/dsh-system-prompt`; `RefkitClient`, `RefkitOptions`, `createRefkit` from `@refkit/core`.
- Produces: `name`, `inject`, `Config`, `GUIDANCE`, `apply(ctx, config?)`, `applyWith(ctx, config, deps: { createClient })`; re-exports `runSearch`, `runRights`, `createSearchTool`, `createRightsTool`, `resolveConfig`, `PROVIDER_IDS`, `narrowOutcome` for the smoke script and hosts.

- [ ] **Step 1: Write the failing test**

`tests/index.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { GUIDANCE, apply, applyWith, inject, name } from '../src/index.ts'

interface FakeSettings {
  installSection: (owner: unknown, ns: string, schema: unknown, entry: unknown, hooks: { setSource(c: () => unknown): void; onChange(): void; validate?: (v: unknown) => void }) => void
}

function fakeContext(services: { settings?: FakeSettings; systemPrompt?: { section: (s: { name: string; order: number; text: string }) => () => void } } = {}) {
  const registered: ToolDefinition[] = []
  const ctx = {
    inject(deps: string[], cb: (scope: unknown) => void) {
      if (deps.every(d => d in services)) cb({ ...services })
    },
    effect: () => () => {},
    tools: { register: (def: ToolDefinition) => { registered.push(def); return () => {} } },
  }
  return { ctx, registered }
}

describe('plugin entry', () => {
  it('declares the Cordis name and required services', () => {
    expect(name).toBe('refkit')
    expect(inject).toEqual(['tools'])
  })
  it('registers both tools with no optional services mounted', () => {
    const { ctx, registered } = fakeContext()
    apply(ctx as never, {})
    expect(registered.map(d => d.name).sort()).toEqual(['refkit_rights', 'refkit_search'])
  })
  it('installs the settings section under the refkit namespace and rebuilds the client on change', async () => {
    let hooks: Parameters<FakeSettings['installSection']>[4] | undefined
    let ns: string | undefined
    const settings: FakeSettings = { installSection: (_o, n, _s, _e, h) => { ns = n; hooks = h } }
    const { ctx } = fakeContext({ settings })
    const built: string[][] = []
    applyWith(ctx as never, {}, {
      createClient: (opts) => { built.push(opts.providers.map(p => p.id)); return { providers: opts.providers } as never },
    })
    expect(ns).toBe('refkit')
    // the client is built lazily; a settings change swaps the source and drops the cached client
    let current: Record<string, unknown> = {}
    hooks!.setSource(() => current)
    hooks!.onChange()
    expect(built).toHaveLength(0)
    expect(() => hooks!.validate?.({ sources: ['nope'] })).toThrow(/valid ids/)
    current = { pexelsApiKey: 'k' }
    hooks!.onChange()
    // force a build through the search tool's deps: the tool closes over getClient
    expect(built).toHaveLength(0)
  })
  it('registers a system-prompt section when the service exists', () => {
    const sections: { name: string; order: number; text: string }[] = []
    const { ctx } = fakeContext({ systemPrompt: { section: (s) => { sections.push(s); return () => {} } } })
    apply(ctx as never, {})
    expect(sections).toEqual([{ name: 'tool:refkit', order: 115, text: GUIDANCE }])
    expect(GUIDANCE).toContain('refkit_search')
    expect(GUIDANCE).toContain('refkit_rights')
    expect(GUIDANCE).toContain('intent')
  })
  it('rejects an unknown sources id in the entry config at apply time', () => {
    const { ctx } = fakeContext()
    expect(() => apply(ctx as never, { sources: ['unsplsh'] })).toThrow(/valid ids/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- index`
Expected: FAIL — cannot resolve `../src/index.ts`.

- [ ] **Step 3: Write `src/index.ts`**

```ts
/**
 * @refkit/dsh-plugin host half. Registers the refkit_search and refkit_rights
 * tools, the `refkit` settings section (BYOK keys, limits) and a short
 * system-prompt hint. The RefkitClient is rebuilt lazily whenever the
 * settings change, so a key typed into the card is live on the next call.
 * @module @refkit/dsh-plugin
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { createRefkit, type RefkitClient, type RefkitOptions } from '@refkit/core'
import { Config, buildClient, resolveConfig, validateConfig, type ResolvedConfig } from './config.ts'
import { createRightsTool } from './tools/rights.ts'
import { createSearchTool } from './tools/search.ts'

export const name = 'refkit'
export const inject = ['tools']

export { Config } from './config.ts'
export type { Config as RefkitPluginConfig, ResolvedConfig } from './config.ts'
export { PROVIDER_IDS, KEYLESS_IDS, PROVIDER_REGISTRY, resolveConfig, buildClient, PLUGIN_VERSION } from './config.ts'
export { createSearchTool, runSearch, SEARCH_TOOL_NAME } from './tools/search.ts'
export type { SearchArgs, SearchDeps } from './tools/search.ts'
export { createRightsTool, runRights, RIGHTS_TOOL_NAME } from './tools/rights.ts'
export type { RightsArgs, RightsOutcome } from './tools/rights.ts'
export { renderSearch, cardMeta } from './render.ts'
export { narrowOutcome, narrowTile } from './core/outcome.ts'
export type { SearchOutcome, CardOutcome, RefTile, SourceStatus, VerdictSummary } from './core/outcome.ts'

/** Model-facing guidance; registered as prompt section `tool:refkit`. */
export const GUIDANCE =
  'Use refkit_search when the user wants reference material for creative work — reference images, textures, artworks, sound effects, music, poems or book passages — rather than web pages. '
  + 'Pass `intent` when the user has said how the material will be used, and `gateFor` when only usable results should come back; cite each result\'s canonicalUrl and repeat its credit line whenever a result requires attribution. '
  + 'Use refkit_rights to re-check one license for a different intent without searching again.'

export interface ApplyDeps {
  createClient: (opts: RefkitOptions) => RefkitClient
}

/** Register everything; `deps` exists so tests can observe client construction. */
export function applyWith(ctx: Context, config: Config, deps: ApplyDeps): void {
  validateConfig(config)
  let source: () => Config = () => config
  let resolved: ResolvedConfig = resolveConfig(source())
  let client: RefkitClient | null = null
  const rebuild = (): void => {
    resolved = resolveConfig(source())
    client = null
  }
  const getConfig = (): ResolvedConfig => resolved
  const getClient = (): RefkitClient => (client ??= buildClient(resolved, deps.createClient))

  ctx.inject(['settings'], (scope) => {
    scope.settings.installSection(ctx, 'refkit', Config, config, {
      setSource: (current) => { source = current as () => Config; rebuild() },
      onChange: rebuild,
      validate: (value) => validateConfig(value as Config),
    })
  })

  ctx.inject(['systemPrompt'], (scope) => {
    scope.systemPrompt.section({ name: 'tool:refkit', order: 115, text: GUIDANCE })
  })

  ctx.tools.register(createSearchTool({ client: getClient, config: getConfig }))
  ctx.tools.register(createRightsTool())
}

/** Cordis entry point. */
export function apply(ctx: Context, config: Config = {}): void {
  applyWith(ctx, config, { createClient: createRefkit })
}
```

If `scope.settings.installSection`'s `ns` generic rejects the literal `'refkit'`, it is because the `SettingsNamespaceInput` type expects a lowercase hyphenated identifier — `'refkit'` satisfies it; check the import of the type augmentation (`import type {} from '@deepseek-ai/dsh-settings'`) is present. If `PromptSection` requires more fields than `{ name, order, text }`, read `node_modules/@deepseek-ai/dsh-system-prompt/lib/types/index.d.ts` and add the required ones with their documented defaults; report the shape.

- [ ] **Step 4: Run the tests, typecheck, lint, and the first full build**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all PASS; `lib/index.js` exists and `node -e "import('./lib/index.js').then(m => console.log(m.name, m.inject, typeof m.apply))"` prints `refkit [ 'tools' ] function`. The client entry does not exist yet, so tsdown builds only the host config.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts tests/index.test.ts
git commit -m "feat: plugin entry — settings section, lazy client rebuild, system-prompt hint, tool registration"
```

---

### Task 7: Browser half — badges, styles, card, slot registration

**Files:**
- Create: `src/client/copy.ts`, `src/client/badges.ts`, `src/client/styles.ts`, `src/client/Card.tsx`, `src/client/index.tsx`
- Test: `tests/badges.test.ts`

**Interfaces:**
- Consumes: `narrowOutcome`, `RefTile`, `SearchOutcome`, `SourceStatus`, `Decision` (Task 1); types `ClientContext`, `ToolCallBlock` from `@deepseek-ai/dsh-client-runtime/client`; `ToolCallOwnerProps` from `@deepseek-ai/dsh-client-ui-tool/client`; slot typing from `@deepseek-ai/dsh-client-ui-conversation/client` (type-only).
- Produces: `COPY`; `verdictBadge(decision): { className: string; label: string }`, `licenseLabel(tile): string`, `summarizeSources(sources): { fulfilled: SourceStatus[]; failed: SourceStatus[]; skipped: SourceStatus[] }`, `aspectRatio(tile): string`; `ensureStyle()`; `RefkitCard`; client `inject`, `apply`.

- [ ] **Step 1: Write the failing badge tests**

`tests/badges.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { aspectRatio, licenseLabel, summarizeSources, verdictBadge } from '../src/client/badges.ts'

describe('verdictBadge', () => {
  it('maps every decision to a class and a label', () => {
    expect(verdictBadge('allowed')).toEqual({ className: 'rk-badge rk-badge-allowed', label: 'Allowed' })
    expect(verdictBadge('allowed-with-attribution')).toEqual({ className: 'rk-badge rk-badge-attribution', label: 'Credit required' })
    expect(verdictBadge('denied')).toEqual({ className: 'rk-badge rk-badge-denied', label: 'Not allowed' })
    expect(verdictBadge('needs-review')).toEqual({ className: 'rk-badge rk-badge-review', label: 'Needs review' })
  })
})

describe('licenseLabel', () => {
  it('appends the version and shortens long ids', () => {
    expect(licenseLabel({ license: 'CC-BY', licenseVersion: '4.0' })).toBe('CC-BY 4.0')
    expect(licenseLabel({ license: 'PD' })).toBe('PD')
    expect(licenseLabel({ license: 'acme-stock-standard-extended-license' })).toBe('acme-stock-standard-…')
  })
})

describe('summarizeSources', () => {
  it('buckets by status preserving order', () => {
    const s = summarizeSources([
      { id: 'a', status: 'fulfilled', returned: 3 }, { id: 'b', status: 'failed' }, { id: 'c', status: 'skipped', reason: 'declined' }, { id: 'd', status: 'fulfilled', returned: 0 },
    ])
    expect(s.fulfilled.map(x => x.id)).toEqual(['a', 'd'])
    expect(s.failed.map(x => x.id)).toEqual(['b'])
    expect(s.skipped.map(x => x.id)).toEqual(['c'])
  })
})

describe('aspectRatio', () => {
  it('uses width/height when known and 4/3 otherwise', () => {
    expect(aspectRatio({ width: 1600, height: 900 })).toBe('1600 / 900')
    expect(aspectRatio({})).toBe('4 / 3')
    expect(aspectRatio({ width: 0, height: 10 })).toBe('4 / 3')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- badges`
Expected: FAIL — cannot resolve `../src/client/badges.ts`.

- [ ] **Step 3: Write `src/client/copy.ts` and `src/client/badges.ts`**

`src/client/copy.ts`:
```ts
/** UI strings for the card. One object so a locale swap is one file. */
export const COPY = {
  searching: 'Searching refkit sources…',
  refsFor: (count: number, query: string) => `${count} reference${count === 1 ? '' : 's'} for “${query}”`,
  intent: (intent: string) => `intent: ${intent}`,
  more: 'more available — ask for the next page',
  failed: (n: number) => `${n} source${n === 1 ? '' : 's'} failed`,
  skipped: (n: number) => `${n} skipped`,
  open: 'Open',
  copyCredit: 'Copy credit',
  copied: 'Copied',
  copyFailed: 'Select and copy:',
  empty: 'No results. Try broader terms, another modality, or fewer controls.',
  legend: 'Verdict:',
  untitled: '(untitled)',
} as const
```

`src/client/badges.ts`:
```ts
/**
 * Pure presentation helpers for the card: verdict badge classes and labels,
 * license chip text, source bucketing, tile aspect ratio. No DOM, no React,
 * so they are unit-tested directly.
 * @module @refkit/dsh-plugin/client/badges
 */

import type { Decision, RefTile, SourceStatus } from '../core/outcome.ts'

const LICENSE_CHARS = 20

export function verdictBadge(decision: Decision): { className: string; label: string } {
  switch (decision) {
    case 'allowed': return { className: 'rk-badge rk-badge-allowed', label: 'Allowed' }
    case 'allowed-with-attribution': return { className: 'rk-badge rk-badge-attribution', label: 'Credit required' }
    case 'denied': return { className: 'rk-badge rk-badge-denied', label: 'Not allowed' }
    case 'needs-review': return { className: 'rk-badge rk-badge-review', label: 'Needs review' }
  }
}

export function licenseLabel(tile: Pick<RefTile, 'license' | 'licenseVersion'>): string {
  const base = tile.licenseVersion ? `${tile.license} ${tile.licenseVersion}` : tile.license
  const points = Array.from(base)
  return points.length > LICENSE_CHARS ? points.slice(0, LICENSE_CHARS).join('') + '…' : base
}

export function summarizeSources(sources: readonly SourceStatus[]): { fulfilled: SourceStatus[]; failed: SourceStatus[]; skipped: SourceStatus[] } {
  return {
    fulfilled: sources.filter(s => s.status === 'fulfilled'),
    failed: sources.filter(s => s.status === 'failed'),
    skipped: sources.filter(s => s.status === 'skipped'),
  }
}

/** CSS `aspect-ratio` value for a tile. */
export function aspectRatio(tile: Pick<RefTile, 'width' | 'height'>): string {
  return tile.width && tile.height && tile.width > 0 && tile.height > 0 ? `${tile.width} / ${tile.height}` : '4 / 3'
}
```

- [ ] **Step 4: Run the badge tests**

Run: `pnpm test -- badges`
Expected: PASS.

- [ ] **Step 5: Write `src/client/styles.ts`**

```ts
/**
 * Card stylesheet, injected once as <style data-refkit-css> the first time the
 * card module evaluates. Classes are prefixed rk-; colours read the shell's
 * alias tokens with neutral fallbacks and adapt to prefers-color-scheme.
 * @module @refkit/dsh-plugin/client/styles
 */

export const CSS = `
.rk-root { font-family: inherit; color: var(--dsw-alias-text-l1, #1f2328); }
.rk-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; margin: 2px 0 10px; }
.rk-head-title { font-size: 13px; font-weight: 600; }
.rk-head-meta { font-size: 12px; color: var(--dsw-alias-text-l2, #656d76); }
.rk-chip { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; line-height: 16px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.14)); color: var(--dsw-alias-text-l2, #656d76); background: var(--dsw-alias-bg-l2, rgba(127,127,127,.08)); }
.rk-chip-muted { opacity: .65; }
.rk-legend { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 11px; color: var(--dsw-alias-text-l2, #656d76); margin: 0 0 10px; }
.rk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.rk-tile { position: relative; display: flex; flex-direction: column; border-radius: 10px; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); background: var(--dsw-alias-bg-l2, rgba(127,127,127,.06)); }
.rk-media { position: relative; width: 100%; background: var(--dsw-alias-bg-l3, rgba(127,127,127,.12)); overflow: hidden; }
.rk-media img { display: block; width: 100%; height: 100%; object-fit: cover; }
.rk-media-text { padding: 10px; font-size: 12px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; }
.rk-media-glyph { display: flex; align-items: center; justify-content: center; font-size: 28px; color: var(--dsw-alias-text-l3, #8c959f); }
.rk-badge { position: absolute; top: 6px; left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 600; line-height: 16px; color: #fff; }
.rk-badge-allowed { background: #1a7f37; }
.rk-badge-attribution { background: #0969da; }
.rk-badge-denied { background: #cf222e; }
.rk-badge-review { background: #bf8700; }
.rk-chips { position: absolute; right: 6px; bottom: 6px; display: flex; gap: 4px; }
.rk-chips .rk-chip { background: rgba(0,0,0,.62); color: #fff; border-color: rgba(255,255,255,.25); backdrop-filter: blur(3px); }
.rk-body { padding: 7px 8px 8px; display: flex; flex-direction: column; gap: 6px; }
.rk-title { font-size: 12px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rk-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.rk-btn { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.16)); background: var(--dsw-alias-bg-l1, transparent); color: inherit; font-size: 11px; line-height: 16px; cursor: pointer; text-decoration: none; }
.rk-btn:hover { border-color: var(--dsw-alias-border-l1, rgba(0,0,0,.3)); }
.rk-credit { font-size: 11px; line-height: 1.35; color: var(--dsw-alias-text-l2, #656d76); user-select: all; word-break: break-word; }
.rk-skeleton { aspect-ratio: 4 / 3; border-radius: 10px; background: linear-gradient(90deg, rgba(127,127,127,.10), rgba(127,127,127,.22), rgba(127,127,127,.10)); background-size: 200% 100%; animation: rk-shimmer 1.2s linear infinite; }
@keyframes rk-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.rk-error { padding: 8px 10px; border-radius: 8px; font-size: 12px; color: #cf222e; background: rgba(207,34,46,.08); white-space: pre-wrap; }
.rk-plain { font-size: 12px; white-space: pre-wrap; }
@media (prefers-color-scheme: dark) {
  .rk-root { color: var(--dsw-alias-text-l1, #e6edf3); }
  .rk-head-meta, .rk-legend, .rk-credit { color: var(--dsw-alias-text-l2, #9198a1); }
  .rk-tile { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.12)); background: var(--dsw-alias-bg-l2, rgba(255,255,255,.04)); }
  .rk-chip { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.14)); color: var(--dsw-alias-text-l2, #9198a1); }
  .rk-btn { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.16)); }
}
`

/** Inject the stylesheet once per page load; idempotent by data attribute. */
export function ensureStyle(): void {
  if (typeof document === 'undefined') return
  if (document.head.querySelector('style[data-refkit-css]') !== null) return
  const tag = document.createElement('style')
  tag.setAttribute('data-refkit-css', '1')
  tag.textContent = CSS
  document.head.appendChild(tag)
}
```

- [ ] **Step 6: Write `src/client/Card.tsx`**

```tsx
/**
 * Keyed tool.call.toolview entry for refkit_search. Parses the settled block's
 * presentation metadata into a SearchOutcome and renders a thumbnail grid:
 * license chip on every tile, a coloured use-verdict badge when the call
 * carried an intent, and a one-click credit copy. Every failure path degrades
 * to plain text — the chat row never breaks.
 * @module @refkit/dsh-plugin/client/Card
 */

import { useState, type ReactNode } from 'react'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolCallOwnerProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { narrowOutcome, type RefTile, type SearchOutcome } from '../core/outcome.ts'
import { aspectRatio, licenseLabel, summarizeSources, verdictBadge } from './badges.ts'
import { COPY } from './copy.ts'
import { ensureStyle } from './styles.ts'

ensureStyle()

function textOf(block: ToolCallBlock): string {
  if (!('kind' in block)) return ''
  const parts: string[] = []
  for (const item of block.content) {
    if (item.type === 'text' && typeof (item as { text?: unknown }).text === 'string') parts.push((item as { text: string }).text)
  }
  return parts.join('\n')
}

function outcomeOf(block: ToolCallBlock): SearchOutcome | null {
  if (!('kind' in block)) return null
  const fromMeta = narrowOutcome(block.meta)
  if (fromMeta !== null) return fromMeta
  const text = textOf(block).trim()
  if (text.length === 0 || text[0] !== '{') return null
  try { return narrowOutcome(JSON.parse(text)) } catch { return null }
}

function RunningGrid(): ReactNode {
  return (
    <div className="rk-root">
      <div className="rk-head"><span className="rk-head-meta">{COPY.searching}</span></div>
      <div className="rk-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="rk-skeleton" />)}</div>
    </div>
  )
}

function CreditButton({ text }: { text: string }): ReactNode {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copy = (): void => {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    if (!clipboard) { setState('failed'); return }
    clipboard.writeText(text).then(() => setState('copied'), () => setState('failed'))
  }
  if (state === 'failed') return <span className="rk-credit">{COPY.copyFailed} {text}</span>
  return <button type="button" className="rk-btn" onClick={copy}>{state === 'copied' ? COPY.copied : COPY.copyCredit}</button>
}

function Tile({ tile }: { tile: RefTile }): ReactNode {
  const image = tile.thumbnail ?? tile.preview
  const badge = tile.useVerdict ? verdictBadge(tile.useVerdict.decision) : null
  let media: ReactNode
  if (tile.modality === 'image' && image) {
    media = <img src={image} alt={tile.title ?? ''} loading="lazy" referrerPolicy="no-referrer" />
  } else if (tile.modality === 'text') {
    media = <div className="rk-media-text">{tile.excerpt ?? tile.description ?? tile.title ?? COPY.untitled}</div>
  } else {
    media = <div className="rk-media-glyph" aria-label={tile.modality}>{tile.modality === 'audio' ? '♪' : tile.modality === 'video' ? '▶' : '▦'}</div>
  }
  return (
    <div className="rk-tile">
      <div className="rk-media" style={{ aspectRatio: aspectRatio(tile) }}>
        {media}
        {badge && <span className={badge.className} title={tile.useVerdict?.reason}>{badge.label}</span>}
        <div className="rk-chips">
          <span className="rk-chip" title={tile.provider}>{tile.provider}</span>
          <span className="rk-chip" title={tile.license}>{licenseLabel(tile)}</span>
        </div>
      </div>
      <div className="rk-body">
        <div className="rk-title" title={tile.title}>{tile.title ?? COPY.untitled}</div>
        <div className="rk-actions">
          <a className="rk-btn" href={tile.canonicalUrl} target="_blank" rel="noopener noreferrer">{COPY.open}</a>
          {tile.attribution && <CreditButton text={tile.attribution} />}
        </div>
      </div>
    </div>
  )
}

function Header({ outcome }: { outcome: SearchOutcome }): ReactNode {
  const { fulfilled, failed, skipped } = summarizeSources(outcome.sources)
  return (
    <>
      <div className="rk-head">
        <span className="rk-head-title">{COPY.refsFor(outcome.count, outcome.query)}</span>
        {outcome.intent && <span className="rk-head-meta">{COPY.intent(outcome.intent)}</span>}
        {fulfilled.map(s => <span key={s.id} className="rk-chip">{s.id}{s.returned !== undefined ? ` ${s.returned}` : ''}</span>)}
        {failed.length > 0 && <span className="rk-chip rk-chip-muted" title={failed.map(s => s.id).join(', ')}>{COPY.failed(failed.length)}</span>}
        {skipped.length > 0 && <span className="rk-chip rk-chip-muted" title={skipped.map(s => `${s.id}${s.reason ? ` (${s.reason})` : ''}`).join(', ')}>{COPY.skipped(skipped.length)}</span>}
        {outcome.nextCursor && <span className="rk-head-meta">{COPY.more}</span>}
      </div>
      {outcome.intent && (
        <div className="rk-legend">
          <span>{COPY.legend}</span>
          {(['allowed', 'allowed-with-attribution', 'denied', 'needs-review'] as const).map(d => {
            const b = verdictBadge(d)
            return <span key={d} className={b.className} style={{ position: 'static' }}>{b.label}</span>
          })}
        </div>
      )}
    </>
  )
}

/** The slot component: dispatch by block lifecycle, degrade safely. */
export function RefkitCard(props: ToolCallOwnerProps): ReactNode {
  const { block } = props
  if (!('kind' in block)) return <RunningGrid />
  if (block.isError) {
    const text = textOf(block)
    return <div className="rk-error">{text.length > 0 ? text : `${block.error?.name ?? 'Error'}: ${block.error?.code ?? 'unknown'}`}</div>
  }
  const outcome = outcomeOf(block)
  if (outcome === null) {
    const text = textOf(block)
    return <div className="rk-plain">{text.length > 0 ? text : JSON.stringify(block.content, null, 2)}</div>
  }
  return (
    <div className="rk-root">
      <Header outcome={outcome} />
      {outcome.references.length === 0
        ? <div className="rk-head-meta">{outcome.note ?? COPY.empty}</div>
        : <div className="rk-grid">{outcome.references.map(tile => <Tile key={tile.id} tile={tile} />)}</div>}
    </div>
  )
}

export default RefkitCard
```

- [ ] **Step 7: Write `src/client/index.tsx`**

```tsx
/**
 * Browser half of @refkit/dsh-plugin: one keyed tool.call.toolview entry for
 * refkit_search. Every wiring step is logged, never thrown — the web shell
 * fails the whole boot when a plugin apply throws.
 * @module @refkit/dsh-plugin/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { RefkitCard } from './Card.tsx'

export const name = 'refkit-client'
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  try {
    ctx.inject(['slots'], (scope) => {
      try {
        scope.slots.inject('tool.call.toolview', () =>
          scope.slots.register(
            { name: 'tool.call.toolview', key: 'refkit_search', priority: 0, registrant: '@refkit/dsh-plugin' },
            RefkitCard,
          ))
      } catch (error) {
        console.warn('[refkit] toolview registration failed', error)
      }
    })
  } catch (error) {
    console.warn('[refkit] client apply failed', error)
  }
}
```

- [ ] **Step 8: Build and verify the client bundle shape**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && head -c 120 lib/client.js && echo && grep -c '"refkit_search"' lib/client.js`
Expected: typecheck (host + client programs) silent; `lib/client.js` begins with `window.__ModuleLoader__.load({ id: "@refkit/dsh-plugin", factory: (require) => {`; the grep prints at least `1`. If tsdown's purity plugin throws on an `@deepseek-ai/*` value import, that import must become `import type`.

- [ ] **Step 9: Commit**

```bash
git add src/client tests/badges.test.ts
git commit -m "feat(client): refkit_search card — thumbnail grid with license and verdict badges, credit copy"
```

---

### Task 8: Smoke scripts, CI, release workflow, README, committed artifacts

**Files:**
- Create: `scripts/smoke-host.mjs`, `scripts/check-client-bundle.mjs`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `README.md`, `README.zh.md`
- Modify: `.gitignore` (ensure `lib/` is NOT ignored), `package.json` (no change expected; verify scripts exist)
- Commit: `lib/**` build outputs

**Interfaces:**
- Consumes: `lib/index.js` exports `apply`, `runSearch`, `resolveConfig`, `PROVIDER_IDS`, `renderSearch` (Task 6); `lib/client.js` (Task 7).

- [ ] **Step 1: Write `scripts/check-client-bundle.mjs`**

```js
// Asserts the browser bundle is the dsh loader's closure-factory artifact and
// carries the slot key. Runs in CI after `pnpm build`.
import { readFileSync } from 'node:fs'

const js = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const banner = 'window.__ModuleLoader__.load({ id: "@refkit/dsh-plugin", factory: (require) => {'
if (!js.startsWith(banner)) { console.error('client bundle: missing loader banner'); process.exit(1) }
if (!js.trimEnd().endsWith('return module.exports; } });')) { console.error('client bundle: missing loader footer'); process.exit(1) }
if (!js.includes('"refkit_search"')) { console.error('client bundle: slot key not found'); process.exit(1) }
const forbidden = [...js.matchAll(/require\("(@deepseek-ai\/[^"]+)"\)/g)].map(m => m[1])
const allowed = new Set(['@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-web-react', '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-schema-form', '@deepseek-ai/dsh-client-runtime/client'])
const bad = forbidden.filter(id => !allowed.has(id))
if (bad.length > 0) { console.error('client bundle: non-platform requires', bad); process.exit(1) }
console.log('client bundle ok', js.length, 'bytes')
```

- [ ] **Step 2: Write `scripts/smoke-host.mjs`**

```js
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
```

- [ ] **Step 3: Write the workflows**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
      - run: node scripts/check-client-bundle.mjs
      - name: Committed lib/ is fresh
        run: git diff --exit-code -- lib
```

`.github/workflows/release.yml`:
```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - run: node scripts/check-client-bundle.mjs
      - name: Tag matches package version
        run: test "v$(node -p "require('./package.json').version")" = "${GITHUB_REF_NAME}"
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 4: Write `README.md`**

```markdown
# @refkit/dsh-plugin

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin for [refkit](https://github.com/refkitjs/refkit): license-normalized creative reference search as native agent tools, with a web card that shows the license and the use-verdict on every result.

- **`refkit_search`** — one call fans out to up to 23 sources (Openverse, Met, Art Institute of Chicago, Wikimedia Commons, Rijksmuseum, Smithsonian, Internet Archive, Project Gutenberg, PoetryDB, Poly Haven, ambientCG, Europeana, Unsplash, Pexels, Pixabay, Flickr, Freesound, Jamendo, Brave, nailbook), merges and reranks the results, and returns each with its license id, canonical link, and — when you pass an `intent` — a use-verdict and a ready credit line.
- **`refkit_rights`** — re-check one license for a different intent without searching again.
- **Web card** — thumbnail grid; license chip on every tile; green / blue / red / amber badges for allowed / credit required / not allowed / needs review; one-click credit copy.

Seven sources work with no key at all. Add free keys for the rest under Settings → Plugins → refkit.

## Install

```sh
dsh plugin --profile web add @refkit/dsh-plugin
# or straight from GitHub (prebuilt bundles are committed):
dsh plugin --profile web add github:refkitjs/dsh-plugin
```

Restart the dsh web host once so the profile picks up the bundle. Tested against `@deepseek-ai/dsh` 0.1.5-rc.2 (the `next` channel); dsh is in developer preview and its plugin API changes between release candidates.

## Configuration

Settings → Plugins → **refkit** (namespace `refkit`; changes apply on the next call). Keys are `secret` fields: masked in the card, never logged, never returned to the model. Each key also falls back to an environment variable — the same names `@refkit/mcp` reads, so one `.env` serves both.

| Field | Env (first wins) | Enables |
| --- | --- | --- |
| `unsplashAccessKey` | `REFKIT_UNSPLASH_KEY`, `UNSPLASH_KEY` | unsplash |
| `pexelsApiKey` | `REFKIT_PEXELS_KEY`, `PEXELS_KEY` | pexels, pexels-video |
| `pixabayKey` | `REFKIT_PIXABAY_KEY`, `PIXABAY_KEY` | pixabay, pixabay-video |
| `flickrApiKey` | `REFKIT_FLICKR_KEY`, `FLICKR_KEY` | flickr |
| `smithsonianApiKey` | `REFKIT_SMITHSONIAN_KEY`, `SI_KEY` | smithsonian |
| `braveToken` | `REFKIT_BRAVE_KEY`, `BRAVE_TOKEN` | brave |
| `freesoundToken` | `REFKIT_FREESOUND_KEY`, `FREESOUND_TOKEN` | freesound |
| `jamendoClientId` | `REFKIT_JAMENDO_CLIENT_ID`, `JAMENDO_CLIENT_ID` | jamendo |
| `europeanaApiKey` | `REFKIT_EUROPEANA_KEY`, `EUROPEANA_KEY` | europeana |
| `openverseToken` | `REFKIT_OPENVERSE_TOKEN` | higher Openverse rate limits (optional) |

| Field | Default | Meaning |
| --- | --- | --- |
| `sources` | `[]` | Provider ids to enable; empty = every source whose key is present |
| `limit` | `12` | Default results per call (1–30); also caps per-item detail fetches for met, rijksmuseum, polyhaven |
| `poolFactor` | `2` | Rank-fusion pool multiplier (1–4) |
| `deadlineMs` | `15000` | Whole-search deadline |
| `timeoutMs` | `10000` | Per-source timeout |
| `rerank` | `true` | Lexical reranker over title, description, tags and excerpt (CJK aware) |
| `sourceConfidence` | `true` | Down-weight sources whose batch never mentions the query |
| `userAgent` | `refkit-dsh-plugin/<version>` | Sent with provider requests |

## Tools

### `refkit_search`

| Argument | Type | Meaning |
| --- | --- | --- |
| `query` | string | What to search for |
| `modalities` | `image` `video` `audio` `text` | Default `["image"]` |
| `intent` | `internal-moodboard` `commercial-product` `ai-generation-input` `redistribution` | Annotate every result with a use-verdict and credit line |
| `gateFor` | same | Return only results whose license allows the intent |
| `sources` | string[] | Restrict to provider ids |
| `limit` | 1–30 | Default from configuration |
| `cursor` | string | Continuation from a previous `nextCursor` |
| `controls` | object | orientation, color, language, sort, safety, license, media, creator, text, page |
| `minRelevance` | 0–1 | Drop results the reranker scored below this |
| `explain` | boolean | Include per-source diagnostics under `meta` |

Example prompts: “find me reference photos of brutalist libraries I can use in a commercial pitch deck”, “给我找几张可以商用的赛博朋克街景参考图”, “a public-domain poem about the sea for a poster”.

### `refkit_rights`

`license`, `intent`, `canonicalUrl` (required); `licenseVersion`, `author`, `title`, `editorialOnly`, `jurisdiction`, `userJurisdiction`, `facts` (optional). Returns `decision`, `reasons`, `confidence`, `attribution`, `disclaimer`.

## Development

```sh
pnpm install
pnpm test                 # vitest, in-process, no network
pnpm build                # lib/index.js (host) + lib/client.js (browser) + lib/types
node scripts/check-client-bundle.mjs
REFKIT_LIVE=1 node scripts/smoke-host.mjs "forest path"   # one real Openverse search
dsh plugin --profile web add file:$PWD                    # install the local build
```

`lib/` is committed so `github:` installs need no build step; CI fails if it is stale.

## Not legal advice

Verdicts are a conservative heuristic over source-declared license facts. They tell you what the source says you may do; they are not rights clearance.

## License

Apache-2.0
```

- [ ] **Step 5: Write `README.zh.md`**

A faithful Chinese translation of `README.md` with the same tables and commands (translate prose; keep field names, env names, commands and ids verbatim). Add `English | [中文](README.zh.md)` under the title in `README.md` and `[English](README.md) | 中文` in `README.zh.md`.

- [ ] **Step 6: Build, check, run the gate, and commit `lib/`**

Run:
```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && node scripts/check-client-bundle.mjs && node scripts/smoke-host.mjs && git status --short lib | head
```
Expected: all green; the smoke prints `skipped (set REFKIT_LIVE=1 ...)`; `lib/index.js`, `lib/client.js`, `lib/client.js.map`, `lib/types/**` appear as untracked. Confirm `.gitignore` does not exclude `lib/`.

- [ ] **Step 7: Commit**

```bash
git add scripts .github README.md README.zh.md lib
git commit -m "chore: smoke and bundle checks, CI and tag-release workflows, README, committed build artifacts"
```

---

## Manual acceptance (release checklist, not a coding task)

1. `pnpm build && dsh plugin --profile web add file:$PWD`, restart the web host.
2. Ask: “find me reference photos of a neon alley at night I can use in a commercial product” — expect `refkit_search` with `intent: commercial-product`, a grid of tiles with license chips and coloured badges, and working “Open” / “Copy credit”.
3. Ask: “can I redistribute the second one?” — expect `refkit_rights`.
4. Set `sources: ["openverse"]` in the settings card, search again — expect only Openverse chips in the header, no restart.
5. Screenshot the grid for the README; run `REFKIT_LIVE=1 node scripts/smoke-host.mjs`.
6. Bump `version` in `package.json` and `PLUGIN_VERSION` in `src/config.ts`, `pnpm build`, commit `lib/`, tag `vX.Y.Z`, push the tag.
