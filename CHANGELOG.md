# Changelog

## 0.3.0

Built on refkit core 0.10 and the provider releases that go with it; they come in as dependencies, nothing to install by hand.

- **24 sources.** The new `polyhaven-hdri` source searches Poly Haven's HDRIs (no key needed), next to `polyhaven` for its textures.
- **Durations.** Audio and video results carry `durationSec`. The card shows it as an `m:ss` badge, and the result text the model reads names it after the source (`freesound — 1:05`). The sources that report a length are openverse-audio, freesound, jamendo, pexels-video and pixabay-video.
- **Album art and video posters on the card.** A video tile shows its poster under a ▶ mark, never the video file. An audio tile shows its album art and falls back to ♪ when there is none.
- **Honest sizes.** `width` and `height` are the original's size. When a source only knows the size of its preview (flickr, pixabay-video), the tile uses that, so it keeps its aspect ratio.
- Settings, the tool description and the docs say "source ids" instead of "provider ids" (dsh uses "provider" for LLM providers).

### Breaking

- The `PROVIDER_IDS` export is now `SOURCE_IDS`. The retired-id list is `RETIRED_SOURCE_IDS` (it was the unexported `RETIRED_IDS`), and it is now exported as well.
- In the `refkit_search` output, each reference names its source in `source` instead of `provider`. Cards saved in conversations by 0.2.0 still render.
- With `explain`, `meta` is core 0.10's search metadata and uses its key names: `sources` (was `providers`), `sourceId` in each entry (was `providerId`), `controls.appliedBySource` / `ignoredBySource` (were `appliedByProvider` / `ignoredByProvider`) and `sourceOptions` (was `providerOptions`).
- Requires `@refkit/core` 0.10. A client built with an older core, for example one passed to `applyWith`, no longer fits.

## 0.2.0

- Ported to dsh 0.1.7 (requires `^0.1.7-rc.2`). Settings are live: an edit applies on the next call without a restart, and an unknown `sources` id is refused when saving.
- A settings page on dsh's Plugins page (Plugins (sidebar) → refkit → Components → refkit) for the API keys, which are write-only and shown as Set / Not set, and for search tuning.
- Display metadata on the Plugins page: title, English and Chinese description, icon.
- The card follows the call through preparing, searching and the result. Wikimedia Commons thumbnails are 500 px.
- The first version published to npm.

## 0.1.0

- First release, for dsh 0.1.5-rc.2. `refkit_search` searches up to 23 sources, normalizes their licenses, and can annotate each result with a use-verdict and a credit line, or keep only the usable ones. `refkit_rights` re-checks one license for another intent. A web card shows license chips and verdict badges. Keys come from the settings or from the same environment variables as `@refkit/mcp`.
