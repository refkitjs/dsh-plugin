# @refkit/dsh-plugin

English | [中文](README.zh.md)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin for [refkit](https://github.com/refkitjs/refkit): license-normalized creative reference search as native agent tools, with a web card that shows the license and the use-verdict on every result.

- **`refkit_search`** — one call fans out to up to 24 sources (Openverse images and audio, Met, Art Institute of Chicago, Wikimedia Commons, Rijksmuseum, Smithsonian, Internet Archive, Project Gutenberg, PoetryDB, Poly Haven textures and HDRIs, ambientCG, Europeana, Unsplash, Pexels, Pixabay, Flickr, Freesound, Jamendo, Brave, nailbook), merges and reranks the results, and returns each with its source id, license id, canonical link, the length of audio and video clips where the source reports it, and — when you pass an `intent` — a use-verdict and a ready credit line.
- **`refkit_rights`** — re-check one license for a different intent without searching again.
- **Web card** — thumbnail grid; source and license chips on every tile; video posters with a play mark, album art on audio, and an `m:ss` length badge on both; green / blue / red / amber badges for allowed / credit required / not allowed / needs review; one-click credit copy.

Thirteen of the 24 sources work with no key at all (Openverse images and audio, Met, Art Institute of Chicago, Wikimedia Commons, Rijksmuseum, Internet Archive, Project Gutenberg, PoetryDB, Poly Haven textures and HDRIs, ambientCG, nailbook). Add free keys for the rest under **Plugins (sidebar) → refkit → Components → refkit**.

## Install

```sh
dsh plugin --profile web add @refkit/dsh-plugin
# or straight from GitHub (prebuilt bundles are committed):
dsh plugin --profile web add github:refkitjs/dsh-plugin
```

Restart the dsh web host once so the profile picks up the bundle. Tested against `@deepseek-ai/dsh` 0.1.7-rc.2 and 0.2.1-rc.2. Requires dsh 0.1.x from 0.1.7-rc.2 on, or 0.2.x from 0.2.1-rc.2 on (`^0.1.7-rc.2 || ^0.2.1-rc.2`); dsh refuses to load it on older releases and on the 0.2.0 pre-releases. dsh is in developer preview and its plugin API changes between release candidates.

Upgraded dsh to 0.2.1 with refkit 0.2.0 installed? dsh 0.2.1 refuses 0.2.0, so remove it and add it again: `dsh plugin --profile web remove @refkit/dsh-plugin`, then `dsh plugin --profile web add @refkit/dsh-plugin`.

## Configuration

Keys and tuning are set on **Plugins (sidebar) → refkit → Components → refkit** (namespace `refkit`); changes apply on the next call, no restart needed. Keys are `secret` fields: never shown on the settings page (only a Set / Not set marker), never logged, never returned to the model, and stored in the profile's `cordis.patch.yml` (file mode 0600, plaintext). Each key left empty falls back to the environment variables in the table below (`REFKIT_*` first) — the same names `@refkit/mcp` reads, so one `.env` serves both. An invalid hand-edited `cordis.patch.yml` stops the plugin at startup until it's fixed.

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
| `sources` | `[]` | Source ids to enable; empty = every source whose key is present |
| `limit` | `12` | Default results per call (1–30); also caps per-item detail fetches for met, rijksmuseum, polyhaven, polyhaven-hdri |
| `poolFactor` | `2` | Rank-fusion pool multiplier (1–4) |
| `deadlineMs` | `15000` | Whole-search deadline |
| `timeoutMs` | `10000` | Per-source timeout |
| `rerank` | `true` | Lexical reranker over title, description, tags and excerpt (CJK aware) |
| `sourceConfidence` | `true` | Down-weight sources whose batch never mentions the query |
| `userAgent` | `refkit-dsh-plugin/<version>` | Sent with source requests |

## Tools

### `refkit_search`

| Argument | Type | Meaning |
| --- | --- | --- |
| `query` | string | What to search for |
| `modalities` | `image` `video` `audio` `text` | Default `["image"]` |
| `intent` | `internal-moodboard` `commercial-product` `ai-generation-input` `redistribution` | Annotate every result with a use-verdict and credit line |
| `gateFor` | same | Return only results whose license allows the intent |
| `sources` | string[] | Restrict to source ids (`polyhaven-hdri` for HDRIs, `openverse-audio` for audio, …) |
| `limit` | 1–30 | Default from configuration |
| `cursor` | string | Continuation from a previous `nextCursor` |
| `controls` | object | orientation, color, language, sort, safety, license, media, creator, text, page |
| `minRelevance` | 0–1 | Drop results the reranker scored below this |
| `explain` | boolean | Include per-source diagnostics under `meta` |

Each result names its `source` id and carries its license, canonical link, thumbnail (a video's poster, a track's album art) and, for audio and video when the source reports it, `durationSec`; `width`/`height` are the original's size, or the preview's when the source does not report it.

Example prompts: “find me reference photos of brutalist libraries I can use in a commercial pitch deck”, “给我找几张可以商用的赛博朋克街景参考图”, “a public-domain poem about the sea for a poster”, “an outdoor HDRI for lighting a product render”, “a short rain sound effect for a game trailer”.

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
