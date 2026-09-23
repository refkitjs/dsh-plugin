# @refkit/dsh-plugin

English | [中文](README.zh.md)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin for [refkit](https://github.com/refkitjs/refkit): license-normalized creative reference search as native agent tools, with a web card that shows the license and the use-verdict on every result.

- **`refkit_search`** — one call fans out to up to 23 sources (Openverse, Met, Art Institute of Chicago, Wikimedia Commons, Rijksmuseum, Smithsonian, Internet Archive, Project Gutenberg, PoetryDB, Poly Haven, ambientCG, Europeana, Unsplash, Pexels, Pixabay, Flickr, Freesound, Jamendo, Brave, nailbook), merges and reranks the results, and returns each with its license id, canonical link, and — when you pass an `intent` — a use-verdict and a ready credit line.
- **`refkit_rights`** — re-check one license for a different intent without searching again.
- **Web card** — thumbnail grid; license chip on every tile; green / blue / red / amber badges for allowed / credit required / not allowed / needs review; one-click credit copy.

Eleven sources work with no key at all (Openverse, Met, Art Institute of Chicago, Wikimedia Commons, Rijksmuseum, Internet Archive, Project Gutenberg, PoetryDB, Poly Haven, ambientCG, nailbook). Add free keys for the rest under Settings → Plugins → refkit.

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
