# @refkit/dsh-plugin 0.2.0 — port to DeepSeek Harness 0.1.7 (design spec)

Status: approved in conversation 2026-09-28. Amends `2026-09-20-dsh-plugin-design.md`; sections not
mentioned here stand unchanged. Evidence for every API claim: the research brief
`.superpowers/research/2026-09-28-dsh-017-migration.md` (git-ignored; its sections are cited as §n).

## Why

dsh 0.1.7-rc.2 (npm `latest`) removed `ctx.settings.installSection` and the
`@deepseek-ai/dsh-client-runtime` package. The 0.1.0 plugin loads and its tools work, but its
settings never register (the inject child throws), so users cannot enter API keys in the UI.
Live acceptance on 0.1.7-rc.2 also showed 1280 px thumbnails in 150 px tiles and a stale "19
sources" description.

## Goals

1. Full function on dsh 0.1.7-rc.2: tools, card, and a settings page where users enter the 10 API
   keys and the tuning fields, applied live without restart.
2. Declare compatibility honestly: dsh `^0.1.7-rc.2` only.
3. Remove the 0.1.5-era scaffolding that 0.1.7 makes unnecessary (the 18 `pnpm.overrides`).

## Non-goals

- dsh 0.2.0-rc.x support (published 2026-09-28; identical typings per §5, widen after a live smoke).
- `role('credential-ref')` indirection for keys (follow-up hardening; §Open risks).
- Any change to tool contracts, render text, presentation metadata, or the card's visual design
  beyond the phase-aware running state.

## Decisions

### P1 — Version and peers (amends D1, D10)

- Package version `0.2.0`; `PLUGIN_VERSION` follows.
- `peerDependencies`: `@deepseek-ai/dsh-tools` `^0.1.7-rc.2`, `@deepseek-ai/dsh-system-prompt`
  `^0.1.7-rc.2`, `@deepseek-ai/dsh-settings` `^0.1.7-rc.2` (optional, used only for `configure`),
  `@deepseek-ai/cordis` `^4.0.4`, `@deepseek-ai/schemastery` `^3.18.4`, `react` `^18.2.0`
  (optional). dsh checks only `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peers, with
  `includePrerelease` (§3), so `^0.1.7-rc.2` admits 0.1.7-rc.2 … 0.1.x and refuses 0.1.5/0.1.6
  (where `.volatile()` does not exist) and 0.2.0-rc.x.
- `devDependencies` pinned exactly to the 0.1.7-rc.2 family (§6 list): `dsh-tools`,
  `dsh-system-prompt`, `dsh-settings`, `dsh-client-ui-tool`, `dsh-client-ui-conversation`,
  `dsh-client-ui-renderer`, `dsh-client-ui-chat`, `dsh-client-ui-slots`,
  `dsh-client-ui-plugin-manager`, `dsh-client-ui-settings`, `dsh-client-ui-primitives`,
  `dsh-api-remotes` at `0.1.7-rc.2`; `cordis` `~4.0.4`; `cordis-plugin-loader` `~1.0.5`
  (type-only, for the `loader/volatile-update` event); `schemastery` `~3.18.4`.
  `@deepseek-ai/dsh-client-runtime` is removed. The whole `pnpm.overrides` block is deleted — a
  0.1.7 dev install resolves without it (§6).
- `dsh.client.inject` becomes `['@deepseek-ai/dsh-client-ui-tool',
  '@deepseek-ai/dsh-client-ui-conversation', '@deepseek-ai/dsh-client-ui-plugin-manager',
  '@deepseek-ai/dsh-client-ui-settings']` (informational in 0.1.7, §4).
- `description`: "… across 23 sources from 19 provider packages and 4 modalities …".
- README "tested against" becomes `@deepseek-ai/dsh` 0.1.7-rc.2.

### P2 — Live configuration (replaces D4's settings mechanism)

- Every one of the 18 `Config` fields is declared `.volatile()`; secrets keep `role('secret')`.
- `sources` becomes `z.array(z.union(PROVIDER_IDS)).default([]).volatile()`; the schema rejects an
  unknown id with a message that lists the valid ids. `validateConfig` is deleted. Retired ids
  must stay in the union as no-ops in future releases (§2).
- Types: `ConfigValues` is the plain value interface (what the old `Config` interface was);
  `Config` (type) maps each field to `Volatile<…>` from `@deepseek-ai/cordis`; `Config` (value) is
  the schemastery schema. `readConfig(config): ConfigValues` reads every reference with `.get()`.
  `resolveConfig(values, env)` is unchanged in behaviour and now takes `ConfigValues`.
- `apply(ctx, config)`: resolve once; register `ctx.on('loader/volatile-update', …)` on the
  plugin's own context (the event is delivered to the owning fiber only) to re-resolve and drop
  the cached client; the client is still built lazily. The environment is still re-read at every
  resolve, so the `REFKIT_*` variables keep working as a fallback under empty settings.
- `ctx.inject(['settings'], child => child.effect(() => child.settings.configure({ auto: false },
  ctx.fiber)))` opts out of any future auto-generated page, because the plugin ships its own (P3).
- An edit to a volatile field never re-applies the plugin; a stored invalid config fails the
  fiber at startup (the user fixes `cordis.patch.yml`) — documented in the README.
- User-facing copy that names the settings location reads: "Plugins (sidebar) →
  @refkit/dsh-plugin → refkit → Configure" (EN) / 「插件（侧边栏）→ @refkit/dsh-plugin → refkit →
  配置」 (ZH), in tool errors, `cordis.patch.yml` comments and READMEs.

### P3 — Settings page (new; replaces D4's settings card)

- The browser half registers keyed slot `plugins.row.config`, key `'@refkit/dsh-plugin#refkit'`,
  registrant `'@refkit/dsh-plugin'`, inside the existing `ctx.inject(['slots'], …)` wiring with the
  same try/catch guards as the toolview. Component: `RefkitSettingsPage(props:
  PluginConfigViewProps)`.
- `view === 'summary'` renders one line: "License-aware reference search · N keys set".
- `view === 'page'` with `form?.state.status === 'ready'` renders two sections:
  - **API keys**: one row per `KEY_FIELDS` entry — label (provider names it enables), a
    set/not-set marker, a password input (never pre-filled; secrets are redacted on the wire),
    **Save** (writes `{ op: 'set', path: [field], value }`) and **Clear** (`{ op: 'unset', path:
    [field] }`). Markers come from `ctx.configForms.describe().getSnapshot().view?.namespaces
    .find(n => n.ns === 'refkit')?.secrets`, reached only through an optional
    `ctx.inject(['configForms'], …)` child; without it markers read "unknown".
  - **Search**: `sources` as a checkbox list of the 23 provider ids (empty = all enabled), `limit`,
    `poolFactor`, `deadlineMs`, `timeoutMs` as numeric inputs with the schema bounds, `rerank` and
    `sourceConfidence` as switches, `userAgent` as a text input; one **Save** that writes only the
    changed paths with `form.state.revision`; **Reset** unsets them.
  - `form.mutate` resolving `false` (refused by the Host) shows an inline error; success shows a
    transient "Saved".
- Otherwise (no form, loading, failed fiber) the page shows a short explanatory line and never
  throws.
- UI primitives: `Button`, `Input`, `Switch` from `@deepseek-ai/dsh-client-ui-primitives` (a
  platform seed module, value import allowed); everything else type-only.
- Pure logic lives in `src/client/settings-model.ts` (DOM-free, unit-tested): building the draft
  from `form.state`, diffing a draft into `SettingsPathOp[]`, validating numeric bounds, the
  summary text.

### P4 — Client types and bundle (amends D5, D9)

- `ClientContext` → `Context` from `@deepseek-ai/cordis`; `ctx.slots` typing from
  `@deepseek-ai/dsh-client-ui-renderer/client`; `ToolCallBlock` from
  `@deepseek-ai/dsh-client-ui-conversation/client`.
- `RefkitCard` narrows on `props.phase`: `'preparing'` renders a one-line "Preparing refkit
  search…", `'start'` renders the existing skeleton grid, `'result'` the existing logic.
- `CLIENT_EXTERNALS` (and the bundle check's allow-list) become exactly the dsh web shell's seed
  table: `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@deepseek-ai/cordis`,
  `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots`,
  `@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/dsh-client-ui-dockkit` (§4).

### P5 — Thumbnail size

- The registry builds Wikimedia Commons with `thumbWidth: 500` (a standard Wikimedia thumbnail
  step), so tiles load a ~500 px image instead of 1280 px. The implementer confirms live that the
  API returns a 500-wide `thumburl`.

### P6 — refkit patch dependency

- `@refkit/provider-openverse` `^0.5.1` and `@refkit/provider-artic` `^0.4.1` (anonymous Openverse
  `page_size` ≤ 20; ARTIC `limit` ≤ 100 — refkitjs/refkit#29). Applied only after both are on npm.

## Testing

- Unit: `Config({})` yields references with the `DEFAULTS` values; `Config({ sources: ['unsplsh']
  })` throws naming the valid ids; `readConfig` snapshots; the index test drives a fake context
  with `on('loader/volatile-update')` and a `liveConfig` helper whose references read a mutable
  object, proving a settings edit swaps the client without re-apply; `configure({ auto: false })`
  is registered when a settings service exists; settings-model diff/validation/summary.
- Build: bundle check with the corrected allow-list; `lib/` fresh.
- Live acceptance on dsh 0.1.7-rc.2 (controller, in the Browser pane): the row shows **配置**,
  the page renders populated, saving a key flips its marker to "set" without restart and enables
  the source on the next search, clearing it flips back, an invalid bound is refused with the
  inline error, the card renders across phases, Openverse returns results.

## Open risks

- The `plugins.row.config` key format and the row id are documented, not yet observed live (§Open
  risks); acceptance verifies them.
- Keys are stored in plaintext in the profile's `cordis.patch.yml` (mode 0600), as with every
  volatile secret in 0.1.7; README says so.
