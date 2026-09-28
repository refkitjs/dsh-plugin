import { INTENTS, buildAttribution, ccVersionFor, createRefkit, evaluateUse, licenseFactsSchema } from "@refkit/core";
import z from "@deepseek-ai/schemastery";
import { artic } from "@refkit/provider-artic";
import { brave } from "@refkit/provider-brave";
import { europeana } from "@refkit/provider-europeana";
import { flickr } from "@refkit/provider-flickr";
import { freesound } from "@refkit/provider-freesound";
import { gutendex } from "@refkit/provider-gutendex";
import { internetArchive } from "@refkit/provider-internet-archive";
import { jamendo } from "@refkit/provider-jamendo";
import { met } from "@refkit/provider-met";
import { nailbook } from "@refkit/provider-nailbook";
import { openverse, openverseAudio } from "@refkit/provider-openverse";
import { pexels, pexelsVideo } from "@refkit/provider-pexels";
import { pixabay, pixabayVideo } from "@refkit/provider-pixabay";
import { poetrydb } from "@refkit/provider-poetrydb";
import { ambientcg, polyhaven } from "@refkit/provider-polyhaven";
import { rijksmuseum } from "@refkit/provider-rijksmuseum";
import { smithsonian } from "@refkit/provider-smithsonian";
import { unsplash } from "@refkit/provider-unsplash";
import { wikimediaCommons } from "@refkit/provider-wikimedia-commons";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/config.ts
/** Kept in sync with package.json by tests/config.test.ts. */
const PLUGIN_VERSION = "0.2.0";
const KEY_FIELDS = [
	"unsplashAccessKey",
	"pexelsApiKey",
	"pixabayKey",
	"flickrApiKey",
	"smithsonianApiKey",
	"braveToken",
	"freesoundToken",
	"jamendoClientId",
	"europeanaApiKey",
	"openverseToken"
];
/** Environment names per key, first match wins. The nine keyed sources mirror @refkit/mcp's CLI. */
const KEY_ENV = {
	unsplashAccessKey: ["REFKIT_UNSPLASH_KEY", "UNSPLASH_KEY"],
	pexelsApiKey: ["REFKIT_PEXELS_KEY", "PEXELS_KEY"],
	pixabayKey: ["REFKIT_PIXABAY_KEY", "PIXABAY_KEY"],
	flickrApiKey: ["REFKIT_FLICKR_KEY", "FLICKR_KEY"],
	smithsonianApiKey: ["REFKIT_SMITHSONIAN_KEY", "SI_KEY"],
	braveToken: ["REFKIT_BRAVE_KEY", "BRAVE_TOKEN"],
	freesoundToken: ["REFKIT_FREESOUND_KEY", "FREESOUND_TOKEN"],
	jamendoClientId: ["REFKIT_JAMENDO_CLIENT_ID", "JAMENDO_CLIENT_ID"],
	europeanaApiKey: ["REFKIT_EUROPEANA_KEY", "EUROPEANA_KEY"],
	openverseToken: ["REFKIT_OPENVERSE_TOKEN"]
};
/** Upper bound of the configurable whole-search deadline; the tool's timeout backstop derives from it. */
const MAX_DEADLINE_MS = 6e4;
const DEFAULTS = {
	limit: 12,
	poolFactor: 2,
	deadlineMs: 15e3,
	timeoutMs: 1e4,
	rerank: true,
	sourceConfidence: true
};
function nonEmpty(value) {
	const t = (value ?? "").trim();
	return t.length > 0 ? t : void 0;
}
function clampInt(value, fallback, min, max) {
	return Math.min(max, Math.max(min, Number.isFinite(value) ? Math.floor(value) : fallback));
}
/** Resolve plain settings values plus environment into validated facts with defaults. */
function resolveConfig(config, env = process.env) {
	const keys = {};
	for (const field of KEY_FIELDS) {
		let value = nonEmpty(config[field]);
		if (value === void 0) for (const name of KEY_ENV[field]) {
			value = nonEmpty(env[name]);
			if (value !== void 0) break;
		}
		keys[field] = value;
	}
	return {
		keys,
		sources: Array.isArray(config.sources) ? config.sources.filter((s) => typeof s === "string" && s.length > 0) : [],
		limit: clampInt(config.limit, DEFAULTS.limit, 1, 30),
		poolFactor: clampInt(config.poolFactor, DEFAULTS.poolFactor, 1, 4),
		deadlineMs: clampInt(config.deadlineMs, DEFAULTS.deadlineMs, 1e3, MAX_DEADLINE_MS),
		timeoutMs: clampInt(config.timeoutMs, DEFAULTS.timeoutMs, 1e3, 6e4),
		rerank: config.rerank ?? DEFAULTS.rerank,
		sourceConfidence: config.sourceConfidence ?? DEFAULTS.sourceConfidence,
		userAgent: nonEmpty(config.userAgent) ?? `refkit-dsh-plugin/0.2.0`
	};
}
const k = (cfg, field) => cfg.keys[field] ?? "";
const PROVIDER_REGISTRY = [
	{
		id: "artic",
		modalities: ["image"],
		make: () => artic()
	},
	{
		id: "brave",
		modalities: ["image"],
		key: "braveToken",
		make: (cfg) => brave({ token: k(cfg, "braveToken") })
	},
	{
		id: "europeana",
		modalities: ["image"],
		key: "europeanaApiKey",
		make: (cfg) => europeana({ apiKey: k(cfg, "europeanaApiKey") })
	},
	{
		id: "flickr",
		modalities: ["image"],
		key: "flickrApiKey",
		make: (cfg) => flickr({ apiKey: k(cfg, "flickrApiKey") })
	},
	{
		id: "freesound",
		modalities: ["audio"],
		key: "freesoundToken",
		make: (cfg) => freesound({ apiKey: k(cfg, "freesoundToken") })
	},
	{
		id: "gutendex",
		modalities: ["text"],
		make: () => gutendex()
	},
	{
		id: "internet-archive",
		modalities: ["video", "text"],
		make: () => internetArchive()
	},
	{
		id: "jamendo",
		modalities: ["audio"],
		key: "jamendoClientId",
		make: (cfg) => jamendo({ clientId: k(cfg, "jamendoClientId") })
	},
	{
		id: "met",
		modalities: ["image"],
		make: (cfg) => met({ maxObjects: cfg.limit })
	},
	{
		id: "nailbook",
		modalities: ["image"],
		make: () => nailbook()
	},
	{
		id: "openverse",
		modalities: ["image"],
		make: (cfg) => openverse(cfg.keys.openverseToken ? { token: cfg.keys.openverseToken } : {})
	},
	{
		id: "openverse-audio",
		modalities: ["audio"],
		make: (cfg) => openverseAudio(cfg.keys.openverseToken ? { token: cfg.keys.openverseToken } : {})
	},
	{
		id: "pexels",
		modalities: ["image"],
		key: "pexelsApiKey",
		make: (cfg) => pexels({ apiKey: k(cfg, "pexelsApiKey") })
	},
	{
		id: "pexels-video",
		modalities: ["video"],
		key: "pexelsApiKey",
		make: (cfg) => pexelsVideo({ apiKey: k(cfg, "pexelsApiKey") })
	},
	{
		id: "pixabay",
		modalities: ["image"],
		key: "pixabayKey",
		make: (cfg) => pixabay({ key: k(cfg, "pixabayKey") })
	},
	{
		id: "pixabay-video",
		modalities: ["video"],
		key: "pixabayKey",
		make: (cfg) => pixabayVideo({ key: k(cfg, "pixabayKey") })
	},
	{
		id: "poetrydb",
		modalities: ["text"],
		make: () => poetrydb()
	},
	{
		id: "polyhaven",
		modalities: ["image"],
		make: (cfg) => polyhaven({ maxAssets: cfg.limit })
	},
	{
		id: "ambientcg",
		modalities: ["image"],
		make: (cfg) => ambientcg({ limit: cfg.limit })
	},
	{
		id: "rijksmuseum",
		modalities: ["image"],
		make: (cfg) => rijksmuseum({ maxObjects: cfg.limit })
	},
	{
		id: "smithsonian",
		modalities: ["image"],
		key: "smithsonianApiKey",
		make: (cfg) => smithsonian({ apiKey: k(cfg, "smithsonianApiKey") })
	},
	{
		id: "unsplash",
		modalities: ["image"],
		key: "unsplashAccessKey",
		make: (cfg) => unsplash({ accessKey: k(cfg, "unsplashAccessKey") })
	},
	{
		id: "wikimedia-commons",
		modalities: ["image"],
		make: () => wikimediaCommons({ thumbWidth: 500 })
	}
];
const PROVIDER_IDS = PROVIDER_REGISTRY.map((e) => e.id);
const KEYLESS_IDS = PROVIDER_REGISTRY.filter((e) => e.key === void 0).map((e) => e.id);
const secret = (text) => z.string().role("secret").description(text).volatile();
/**
* Schemastery schema. Every field is volatile: a settings edit commits into the
* same references and emits `loader/volatile-update` instead of remounting the
* plugin. An unknown `sources` id fails validation, so the Host refuses the write.
*/
const Config = z.object({
	unsplashAccessKey: secret("Unsplash access key (free at unsplash.com/developers). Empty disables unsplash. Env: REFKIT_UNSPLASH_KEY / UNSPLASH_KEY."),
	pexelsApiKey: secret("Pexels API key (free at pexels.com/api). Enables pexels and pexels-video. Env: REFKIT_PEXELS_KEY / PEXELS_KEY."),
	pixabayKey: secret("Pixabay API key (free at pixabay.com/api/docs). Enables pixabay and pixabay-video. Env: REFKIT_PIXABAY_KEY / PIXABAY_KEY."),
	flickrApiKey: secret("Flickr API key. Env: REFKIT_FLICKR_KEY / FLICKR_KEY."),
	smithsonianApiKey: secret("api.data.gov key for the Smithsonian Open Access API. Env: REFKIT_SMITHSONIAN_KEY / SI_KEY."),
	braveToken: secret("Brave Search API token (web image discovery). Env: REFKIT_BRAVE_KEY / BRAVE_TOKEN."),
	freesoundToken: secret("Freesound APIv2 token. Env: REFKIT_FREESOUND_KEY / FREESOUND_TOKEN."),
	jamendoClientId: secret("Jamendo client id. Env: REFKIT_JAMENDO_CLIENT_ID / JAMENDO_CLIENT_ID."),
	europeanaApiKey: secret("Europeana API key (free). Env: REFKIT_EUROPEANA_KEY / EUROPEANA_KEY."),
	openverseToken: secret("Optional Openverse OAuth2 token; anonymous works with lower rate limits. Env: REFKIT_OPENVERSE_TOKEN."),
	sources: z.array(z.union(PROVIDER_IDS)).default([]).description("Provider ids to enable (empty = every source whose key is present).").volatile(),
	limit: z.number().step(1).min(1).max(30).default(DEFAULTS.limit).description("Default results per call; also caps per-item detail fetches for met, rijksmuseum and polyhaven.").volatile(),
	poolFactor: z.number().step(1).min(1).max(4).default(DEFAULTS.poolFactor).description("Rank-fusion pool multiplier.").volatile(),
	deadlineMs: z.number().step(1).min(1e3).max(MAX_DEADLINE_MS).default(DEFAULTS.deadlineMs).description("Whole-search deadline in ms.").volatile(),
	timeoutMs: z.number().step(1).min(1e3).max(6e4).default(DEFAULTS.timeoutMs).description("Per-source timeout in ms.").volatile(),
	rerank: z.boolean().default(DEFAULTS.rerank).description("Rerank fused results lexically over title, description, tags and excerpt.").volatile(),
	sourceConfidence: z.boolean().default(DEFAULTS.sourceConfidence).description("Down-weight sources whose batch never mentions the query.").volatile(),
	userAgent: z.string().description("User-Agent for provider requests. Default refkit-dsh-plugin/<version>.").volatile()
});
/**
* The schema's declared field names. `z.object` passes unknown keys through, so a stray key in
* the user's `cordis.patch.yml` entry reaches `apply`; reading only these keeps it ignored.
*/
const CONFIG_FIELDS = Object.keys(Config.dict ?? {});
/** One consistent snapshot; the Loader commits every reference before it emits the event. */
function readConfig(config) {
	return Object.fromEntries(CONFIG_FIELDS.map((field) => {
		const ref = config[field];
		return [field, typeof ref?.get === "function" ? ref.get() : void 0];
	}));
}
/** Providers that are keyless or keyed-and-configured, intersected with the whitelist, in registry order. */
function enabledProviders(cfg) {
	const allow = cfg.sources.length > 0 ? new Set(cfg.sources) : null;
	return PROVIDER_REGISTRY.filter((e) => (e.key === void 0 || cfg.keys[e.key] !== void 0) && (allow === null || allow.has(e.id))).map((e) => e.make(cfg));
}
/** Build the RefkitClient for one resolved configuration. */
function buildClient(cfg, createClient = createRefkit) {
	const providers = enabledProviders(cfg);
	if (providers.length === 0) throw new Error("refkit: no sources enabled — add a key under Plugins (sidebar) → @refkit/dsh-plugin → refkit → Configure or widen `sources`");
	return createClient({
		providers,
		...cfg.rerank ? {} : { rerank: false },
		sourceConfidence: cfg.sourceConfidence,
		resilience: { timeoutMs: cfg.timeoutMs },
		userAgent: cfg.userAgent
	});
}
//#endregion
//#region src/core/outcome.ts
/**
* Canonical result vocabulary shared by the host half (tool output, render,
* presentation metadata) and the browser half (the card). No runtime
* dependencies: plain data plus soft parsers, so a malformed or
* version-drifted payload degrades to text instead of crashing a render.
* @module @refkit/dsh-plugin/core
*/
const MODALITIES = [
	"image",
	"video",
	"audio",
	"text"
];
const DECISIONS = [
	"allowed",
	"allowed-with-attribution",
	"denied",
	"needs-review"
];
const SOURCE_STATUSES = [
	"fulfilled",
	"failed",
	"skipped"
];
const HTTP = /^https?:\/\//i;
function str(v) {
	return typeof v === "string" && v.length > 0 ? v : void 0;
}
function num(v) {
	return typeof v === "number" && Number.isFinite(v) ? v : void 0;
}
/** Shallow copy of `obj` without its undefined-valued own properties (dsh snapshots values as lossless JSON). */
function defined(obj) {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== void 0));
}
/** Cut `text` to `max` code points, appending an ellipsis when anything was removed. */
function trunc(text, max) {
	const points = Array.from(text);
	if (points.length <= max) return text;
	return points.slice(0, Math.max(0, max - 1)).join("") + "…";
}
function narrowVerdict(v) {
	if (typeof v !== "object" || v === null) return void 0;
	const r = v;
	if (!DECISIONS.includes(r.decision)) return void 0;
	if (r.confidence !== "high" && r.confidence !== "low") return void 0;
	return {
		decision: r.decision,
		reason: str(r.reason) ?? "",
		confidence: r.confidence
	};
}
/** Soft-narrow one tile; null for anything unusable. Unknown keys are dropped. */
function narrowTile(value) {
	if (typeof value !== "object" || value === null) return null;
	const r = value;
	const id = str(r.id);
	const provider = str(r.provider);
	const canonicalUrl = str(r.canonicalUrl);
	const license = str(r.license);
	if (id === void 0 || provider === void 0 || license === void 0) return null;
	if (canonicalUrl === void 0 || !HTTP.test(canonicalUrl)) return null;
	if (!MODALITIES.includes(r.modality)) return null;
	const tile = {
		id,
		modality: r.modality,
		provider,
		canonicalUrl,
		license
	};
	for (const key of [
		"title",
		"kind",
		"licenseVersion",
		"author",
		"description",
		"excerpt",
		"attribution"
	]) {
		const s = str(r[key]);
		if (s !== void 0) tile[key] = s;
	}
	for (const key of ["thumbnail", "preview"]) {
		const s = str(r[key]);
		if (s !== void 0 && HTTP.test(s)) tile[key] = s;
	}
	for (const key of ["width", "height"]) {
		const n = num(r[key]);
		if (n !== void 0 && n > 0) tile[key] = n;
	}
	if (Array.isArray(r.tags)) {
		const tags = r.tags.filter((t) => typeof t === "string" && t.length > 0);
		if (tags.length > 0) tile.tags = tags;
	}
	const verdict = narrowVerdict(r.useVerdict);
	if (verdict !== void 0) tile.useVerdict = verdict;
	return tile;
}
function narrowSource(v) {
	if (typeof v !== "object" || v === null) return null;
	const r = v;
	const id = str(r.id);
	if (id === void 0 || !SOURCE_STATUSES.includes(r.status)) return null;
	const out = {
		id,
		status: r.status
	};
	const reason = str(r.reason);
	if (reason !== void 0) out.reason = reason;
	const returned = num(r.returned);
	if (returned !== void 0) out.returned = returned;
	return out;
}
/** Soft-parse a canonical value or presentation metadata; null for the wrong shape. */
function narrowOutcome(value) {
	if (typeof value !== "object" || value === null) return null;
	const r = value;
	const query = typeof r.query === "string" ? r.query : void 0;
	if (query === void 0 || typeof r.count !== "number") return null;
	if (!Array.isArray(r.modalities) || !Array.isArray(r.references) || !Array.isArray(r.sources)) return null;
	if (!Array.isArray(r.warnings)) return null;
	const modalities = r.modalities.filter((m) => MODALITIES.includes(m));
	const references = r.references.map(narrowTile).filter((t) => t !== null);
	const sources = r.sources.map(narrowSource).filter((s) => s !== null);
	const warnings = r.warnings.filter((w) => typeof w === "string");
	const out = {
		query,
		modalities,
		count: r.count,
		references,
		sources,
		warnings
	};
	const intent = str(r.intent);
	if (intent !== void 0) out.intent = intent;
	const nextCursor = str(r.nextCursor);
	if (nextCursor !== void 0) out.nextCursor = nextCursor;
	const note = str(r.note);
	if (note !== void 0) out.note = note;
	if (r.meta !== void 0) out.meta = r.meta;
	return out;
}
//#endregion
//#region src/tools/rights.ts
/**
* The refkit_rights tool: a stateless use-gate check for one license id (or
* a facts row) against an intended use, returning core's verdict and the
* credit line. Lets the model re-check a result for a new intent without
* searching again.
* @module @refkit/dsh-plugin/tools/rights
*/
const RIGHTS_TOOL_NAME = "refkit_rights";
const TRI = { oneOf: [{ type: "boolean" }, {
	type: "string",
	const: "unknown"
}] };
const RIGHTS_PARAMETERS = {
	license: {
		type: "string",
		required: true,
		description: "License id as returned by refkit_search (e.g. CC-BY, CC0-1.0, PD, unsplash). An unknown id without `facts` resolves to needs-review."
	},
	intent: {
		type: "string",
		enum: INTENTS,
		required: true,
		description: "The intended use to evaluate."
	},
	canonicalUrl: {
		type: "string",
		required: true,
		description: "Canonical source link, for the credit line and audit."
	},
	licenseVersion: {
		type: "string",
		description: "CC version such as \"4.0\"; ignored for non-CC ids."
	},
	author: { type: "string" },
	title: { type: "string" },
	editorialOnly: {
		type: "boolean",
		description: "Source marked editorial-only."
	},
	jurisdiction: {
		type: "string",
		description: "Source-declared jurisdiction of a public-domain status."
	},
	userJurisdiction: {
		type: "string",
		description: "Caller's jurisdiction; a mismatch defaults to needs-review."
	},
	facts: {
		type: "object",
		additionalProperties: false,
		description: "Override the license table with source-declared facts (all five fields required when present).",
		properties: {
			commercialUse: TRI,
			derivatives: TRI,
			redistribution: TRI,
			attributionRequired: { type: "boolean" },
			shareAlike: { type: "boolean" }
		}
	}
};
const RIGHTS_OUTPUT = {
	type: "object",
	additionalProperties: false,
	properties: {
		decision: {
			type: "string",
			enum: DECISIONS,
			required: true
		},
		reasons: {
			type: "array",
			items: { type: "string" },
			required: true
		},
		confidence: {
			type: "string",
			enum: ["high", "low"],
			required: true
		},
		attribution: {
			type: "object",
			additionalProperties: false,
			required: true,
			properties: {
				required: {
					type: "boolean",
					required: true
				},
				text: { type: "string" },
				html: { type: "string" }
			}
		},
		disclaimer: {
			type: "string",
			required: true
		}
	}
};
/** Evaluate one license for one intent; pure and synchronous. */
function runRights(args) {
	let facts;
	if (args.facts !== void 0) {
		const parsed = licenseFactsSchema.safeParse(args.facts);
		if (!parsed.success) throw new Error(`refkit_rights: invalid facts — ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
		facts = parsed.data;
	}
	const licenseVersion = ccVersionFor(args.license, args.licenseVersion);
	const verdict = evaluateUse({
		license: args.license,
		rehostPolicy: "cache-allowed",
		raw: {
			sourceTerms: "",
			sourceUrl: args.canonicalUrl
		},
		...facts ? { facts } : {},
		...licenseVersion ? { licenseVersion } : {},
		...args.author ? { author: args.author } : {},
		...args.jurisdiction ? { jurisdiction: args.jurisdiction } : {},
		...args.editorialOnly !== void 0 ? { editorialOnly: args.editorialOnly } : {}
	}, args.intent, args.userJurisdiction ? { userJurisdiction: args.userJurisdiction } : void 0);
	const attribution = buildAttribution({
		license: args.license,
		canonicalUrl: args.canonicalUrl,
		...facts ? { facts } : {},
		...licenseVersion ? { licenseVersion } : {},
		...args.author ? { author: args.author } : {},
		...args.title ? { title: args.title } : {}
	});
	return {
		decision: verdict.decision,
		reasons: verdict.reasons,
		confidence: verdict.confidence,
		attribution: {
			required: attribution.required,
			...verdict.decision !== "denied" && attribution.text ? { text: attribution.text } : {},
			...verdict.decision !== "denied" && attribution.html ? { html: attribution.html } : {}
		},
		disclaimer: verdict.disclaimer
	};
}
/** Model-facing text: verdict line, credit line when required, disclaimer. */
function renderRights(value) {
	const lines = [`${value.decision} (${value.confidence}): ${value.reasons.join("; ") || "license facts allow this use"}`];
	if (value.attribution.required && value.attribution.text) lines.push(`credit: ${value.attribution.text}`);
	lines.push(value.disclaimer);
	return lines.join("\n");
}
function createRightsTool() {
	return defineTool({
		name: RIGHTS_TOOL_NAME,
		description: "Stateless license check: given a license id (or source-declared facts) and an intended use, return a conservative verdict (allowed / allowed-with-attribution / denied / needs-review) with reasons, confidence and a ready credit line. Use it to re-check one refkit_search result for a different intent without searching again. Not legal advice.",
		parameters: RIGHTS_PARAMETERS,
		output: {
			schema: RIGHTS_OUTPUT,
			render: (_args, value) => [{
				type: "text",
				text: renderRights(value)
			}]
		},
		timeoutMs: 5e3,
		isConcurrencySafe: () => true,
		presentCall: (args) => ({
			card: "generic",
			title: "refkit rights check",
			kind: "other",
			rawInput: {
				license: args.license,
				intent: args.intent
			}
		}),
		presentResult: (_args, result) => ({
			card: "generic",
			content: result.content
		}),
		execute: async (args) => runRights(args)
	});
}
//#endregion
//#region src/render.ts
/**
* Model-facing text for refkit_search and the bounded presentation metadata
* the web card reads. Pure functions of the canonical value.
* @module @refkit/dsh-plugin/render
*/
const EXCERPT_CHARS = 160;
const META_CHARS = 2e3;
const DESCRIPTION_CHARS = 200;
const CARD_EXCERPT_CHARS = 600;
/** Collapse whitespace runs (newlines included) so upstream text cannot break the line layout. */
function oneLine(text) {
	return text.replace(/\s+/g, " ").trim();
}
function licenseLabel(tile) {
	return tile.licenseVersion ? `${tile.license} ${tile.licenseVersion}` : tile.license;
}
/**
* One numbered line per reference plus credit/excerpt sub-lines, warnings, the
* cursor hint and, with `explain`, a bounded `meta:` line — dsh sends the model
* only this text, never the canonical value.
*/
function renderSearch(value) {
	const lines = [];
	lines.push(`${value.count} reference(s) for "${value.query}"${value.intent ? ` — intent: ${value.intent}` : ""}`);
	value.references.forEach((tile, i) => {
		const decision = tile.useVerdict ? ` — ${tile.useVerdict.decision}` : "";
		lines.push(`${i + 1}. ${oneLine(tile.title ?? "") || "(untitled)"} — ${tile.provider} — ${licenseLabel(tile)}${decision} — ${tile.canonicalUrl}`);
		const credit = oneLine(tile.attribution ?? "");
		if (credit) lines.push(`   credit: ${credit}`);
		if (tile.modality === "text" && tile.excerpt) lines.push(`   excerpt: ${trunc(oneLine(tile.excerpt), EXCERPT_CHARS)}`);
	});
	if (value.note) lines.push(value.note);
	for (const warning of value.warnings) lines.push(`warning: ${warning}`);
	if (value.nextCursor) lines.push(`more: pass cursor "${value.nextCursor}" to continue`);
	if (value.meta !== void 0) lines.push(`meta: ${trunc(JSON.stringify(value.meta), META_CHARS)}`);
	return lines.join("\n");
}
/** Bounded, replayable card data: no meta, no tags, descriptions and excerpts cut, no undefined values. */
function cardMeta(value) {
	const references = value.references.map((tile) => {
		const { tags: _tags, description, excerpt, ...rest } = defined(tile);
		const out = rest;
		if (description !== void 0) out.description = trunc(description, DESCRIPTION_CHARS);
		if (excerpt !== void 0) out.excerpt = trunc(excerpt, CARD_EXCERPT_CHARS);
		return out;
	});
	const out = {
		query: value.query,
		modalities: value.modalities,
		count: value.count,
		references,
		sources: value.sources.map((source) => defined(source)),
		warnings: value.warnings
	};
	if (value.intent !== void 0) out.intent = value.intent;
	if (value.nextCursor !== void 0) out.nextCursor = value.nextCursor;
	if (value.note !== void 0) out.note = value.note;
	return out;
}
//#endregion
//#region src/tools/controls.ts
const CONTROLS_PARAMETER = {
	type: "object",
	additionalProperties: false,
	description: "Provider-neutral search controls; each source applies the ones it supports and the rest are reported as ignored.",
	properties: {
		orientation: {
			type: "string",
			enum: [
				"landscape",
				"portrait",
				"square"
			]
		},
		color: {
			type: "string",
			description: "dominant colour name or hex"
		},
		language: {
			type: "string",
			description: "BCP-47 tag, e.g. en-US"
		},
		sort: {
			type: "string",
			enum: [
				"relevance",
				"latest",
				"popular",
				"interesting"
			]
		},
		safety: {
			type: "string",
			enum: [
				"strict",
				"moderate",
				"off"
			]
		},
		license: {
			type: "object",
			additionalProperties: false,
			properties: {
				commercial: {
					type: "boolean",
					description: "only licenses allowing commercial use"
				},
				modification: {
					type: "boolean",
					description: "only licenses allowing derivatives"
				},
				allowUnknown: { type: "boolean" }
			}
		},
		media: {
			type: "object",
			additionalProperties: false,
			properties: {
				kind: {
					type: "string",
					description: "photo, illustration, vector, icon, artwork, texture, hdri, 3d-model, film, animation, ..."
				},
				size: {
					type: "string",
					enum: [
						"small",
						"medium",
						"large"
					]
				},
				minWidth: { type: "integer" },
				minHeight: { type: "integer" },
				duration: {
					type: "string",
					enum: [
						"short",
						"medium",
						"long"
					]
				}
			}
		},
		creator: {
			type: "object",
			additionalProperties: false,
			properties: {
				id: { type: "string" },
				name: { type: "string" }
			}
		},
		text: {
			type: "object",
			additionalProperties: false,
			properties: { copyright: {
				type: "string",
				enum: [
					"public-domain",
					"copyrighted",
					"any"
				]
			} }
		},
		page: {
			type: "integer",
			description: "provider-local page (1-based)"
		}
	}
};
//#endregion
//#region src/tools/search.ts
/**
* The refkit_search tool: parameter and output schemas in dsh's DSL, the
* execution that maps core's SearchResult onto the canonical SearchOutcome,
* and the defineTool wrapper. All ranking and rights logic stays in
* @refkit/core; this file only shapes inputs and outputs.
* @module @refkit/dsh-plugin/tools/search
*/
const SEARCH_TOOL_NAME = "refkit_search";
const MAX_LIMIT = 30;
const ERROR_CHARS = 200;
const WARNING_CHARS = 260;
const SEARCH_PARAMETERS = {
	query: {
		type: "string",
		required: true,
		description: "What to search for, e.g. \"cyberpunk alley at night\". Translate to concise English keywords unless the source is language-specific."
	},
	modalities: {
		type: "array",
		items: {
			type: "string",
			enum: MODALITIES
		},
		description: "Default [\"image\"]. text = passages/poems/books; audio = sounds/music; video = clips."
	},
	intent: {
		type: "string",
		enum: INTENTS,
		description: "Annotate every result with a use-verdict (allowed / allowed-with-attribution / denied / needs-review) and a credit line for this intended use. No filtering."
	},
	gateFor: {
		type: "string",
		enum: INTENTS,
		description: "Return only results whose license allows this intended use (also annotates). Prefer over intent when the user needs usable material only."
	},
	sources: {
		type: "array",
		items: { type: "string" },
		description: "Restrict to provider ids (see the tool description). Omit to search every enabled source."
	},
	limit: {
		type: "integer",
		description: "Results to return, 1..30. Default from configuration."
	},
	cursor: {
		type: "string",
		description: "Opaque continuation from a previous result's nextCursor."
	},
	controls: CONTROLS_PARAMETER,
	minRelevance: {
		type: "number",
		description: "Drop results the ranker scored below this (0..1) after reranking. A result matching no query term lands around 0.3 under the default weights, so 0.5 keeps only real matches. Off by default."
	},
	explain: {
		type: "boolean",
		description: "Include core's full search metadata (per-source status, applied/ignored controls, gate and threshold counts) under meta."
	}
};
const SEARCH_OUTPUT = {
	type: "object",
	additionalProperties: false,
	properties: {
		query: {
			type: "string",
			required: true
		},
		modalities: {
			type: "array",
			items: {
				type: "string",
				enum: MODALITIES
			},
			required: true
		},
		intent: { type: "string" },
		count: {
			type: "integer",
			required: true
		},
		references: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				properties: {
					id: {
						type: "string",
						required: true
					},
					modality: {
						type: "string",
						enum: MODALITIES,
						required: true
					},
					provider: {
						type: "string",
						required: true
					},
					canonicalUrl: {
						type: "string",
						required: true
					},
					license: {
						type: "string",
						required: true
					},
					title: { type: "string" },
					kind: { type: "string" },
					licenseVersion: { type: "string" },
					author: { type: "string" },
					thumbnail: { type: "string" },
					preview: { type: "string" },
					width: { type: "number" },
					height: { type: "number" },
					description: { type: "string" },
					excerpt: { type: "string" },
					tags: {
						type: "array",
						items: { type: "string" }
					},
					useVerdict: {
						type: "object",
						additionalProperties: false,
						properties: {
							decision: {
								type: "string",
								enum: DECISIONS,
								required: true
							},
							reason: {
								type: "string",
								required: true
							},
							confidence: {
								type: "string",
								enum: ["high", "low"],
								required: true
							}
						}
					},
					attribution: { type: "string" }
				}
			},
			required: true
		},
		nextCursor: { type: "string" },
		sources: {
			type: "array",
			required: true,
			items: {
				type: "object",
				additionalProperties: false,
				properties: {
					id: {
						type: "string",
						required: true
					},
					status: {
						type: "string",
						enum: SOURCE_STATUSES,
						required: true
					},
					reason: { type: "string" },
					returned: { type: "integer" }
				}
			}
		},
		warnings: {
			type: "array",
			items: { type: "string" },
			required: true
		},
		note: { type: "string" },
		meta: { type: "json" }
	}
};
const DESCRIPTION = `Search license-normalized creative references (images, video, audio, text passages) across up to 23 sources and return them ranked, deduplicated, and each tagged with its license and canonical source link. Use for reference pictures, moodboards, textures/HDRIs, public-domain artworks, sound effects, music, poems and book passages — not for web pages. Pass \`intent\` when the user has said how the material will be used so every result carries a use-verdict and a ready credit line; pass \`gateFor\` to return only usable results. Results are references, not rights clearance. Sources: ${PROVIDER_REGISTRY.map((e) => `${e.id} (${e.modalities.join("/")}${e.key ? ", needs key" : ""})`).join(", ")}. Keyed sources are inactive until their key is set under Plugins (sidebar) → @refkit/dsh-plugin → refkit → Configure.`;
function message(err) {
	return trunc(err instanceof Error ? err.message : String(err), ERROR_CHARS);
}
/** Project one core Reference (plus optional assessment) onto a tile with no undefined keys. */
function toTile(ref, assessment) {
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
		tags: ref.tags && ref.tags.length > 0 ? ref.tags : void 0
	});
	if (assessment) {
		const { verdict, attribution } = assessment;
		tile.useVerdict = {
			decision: verdict.decision,
			reason: verdict.reasons.join("; "),
			confidence: verdict.confidence
		};
		if (verdict.decision !== "denied" && attribution.required && attribution.text) tile.attribution = attribution.text;
	}
	return tile;
}
/** Compact projection of core's per-provider status. */
function toSourceStatus(status) {
	return defined({
		id: status.providerId,
		status: status.status,
		reason: status.reason,
		returned: status.returned
	});
}
/** Why a known provider the call asked for is not enabled; undefined for unknown or enabled ids. */
function disabledHint(id, enabled, cfg) {
	const entry = PROVIDER_REGISTRY.find((e) => e.id === id);
	if (entry === void 0 || enabled.includes(id)) return void 0;
	if (entry.key !== void 0 && cfg.keys[entry.key] === void 0) return `${id}: configure its key under Plugins (sidebar) → @refkit/dsh-plugin → refkit → Configure.`;
	if (cfg.sources.length > 0 && !cfg.sources.includes(id)) return `${id}: excluded by the sources setting under Plugins (sidebar) → @refkit/dsh-plugin → refkit → Configure.`;
}
function sourcesError(err, requested, enabled, cfg) {
	const hints = requested.map((id) => disabledHint(id, enabled, cfg)).filter((h) => h !== void 0);
	return /* @__PURE__ */ new Error(`${message(err)} Enabled source ids: ${enabled.join(", ") || "(none)"}.${hints.map((h) => ` ${h}`).join("")}`);
}
/** Execute one search against the current client and shape the canonical value. */
async function runSearch(args, deps, signal) {
	const query = args.query.trim();
	if (query.length === 0) throw new Error("refkit_search: query must be a non-empty string");
	const cfg = deps.config();
	const client = deps.client();
	const modalities = args.modalities && args.modalities.length > 0 ? [...args.modalities] : ["image"];
	const sources = args.sources && args.sources.length > 0 ? args.sources : void 0;
	const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(args.limit ?? cfg.limit)));
	const intent = args.intent ?? args.gateFor;
	const failures = /* @__PURE__ */ new Map();
	const input = defined({
		query,
		modalities,
		sources,
		controls: args.controls,
		limit,
		cursor: args.cursor,
		poolFactor: cfg.poolFactor,
		deadlineMs: cfg.deadlineMs,
		minRelevance: args.minRelevance,
		gateFor: args.gateFor,
		signal,
		onProviderError: (e) => {
			failures.set(e.providerId, e.error);
		}
	});
	let result;
	try {
		result = await client.searchWithMeta(input);
	} catch (err) {
		if (err instanceof AggregateError) {
			const parts = failures.size > 0 ? [...failures].map(([providerId, error]) => `${providerId}: ${message(error)}`) : err.errors.map((e, i) => `#${i + 1}: ${message(e)}`);
			throw new Error(`all ${err.errors.length} sources failed: ${parts.join("; ")}`);
		}
		if (sources && err instanceof Error && err.message.includes("no configured provider matches")) throw sourcesError(err, sources, client.providers.map((p) => p.id), cfg);
		throw err;
	}
	const references = result.references.map((ref) => intent ? toTile(ref, {
		verdict: client.evaluateUse(ref, intent),
		attribution: client.buildAttribution(ref)
	}) : toTile(ref));
	const outcome = {
		query,
		modalities,
		count: references.length,
		references,
		sources: result.meta.providers.map(toSourceStatus),
		warnings: [...result.meta.providers.filter((p) => p.status === "failed").map((p) => trunc(`${p.providerId}: ${message(p.error ?? "unknown error")}`, WARNING_CHARS)), ...result.meta.warnings.map((w) => trunc(w, WARNING_CHARS))]
	};
	if (intent) outcome.intent = intent;
	if (result.meta.nextCursor) outcome.nextCursor = result.meta.nextCursor;
	if (references.length === 0) outcome.note = "No results; try broader terms, another modality, or fewer controls.";
	if (args.explain) outcome.meta = JSON.parse(JSON.stringify(result.meta));
	return outcome;
}
function presentCall(args) {
	return {
		card: "generic",
		title: "refkit search",
		kind: "search",
		rawInput: defined({
			query: args.query,
			modalities: args.modalities,
			intent: args.intent ?? args.gateFor
		})
	};
}
/** The registered definition. */
function createSearchTool(deps) {
	return defineTool({
		name: SEARCH_TOOL_NAME,
		description: DESCRIPTION,
		parameters: SEARCH_PARAMETERS,
		output: {
			schema: SEARCH_OUTPUT,
			render: (_args, value) => [{
				type: "text",
				text: renderSearch(value)
			}],
			presentationMeta: (_args, value) => cardMeta(value)
		},
		timeoutMs: 65e3,
		isConcurrencySafe: () => true,
		presentCall,
		presentResult: (_args, result) => {
			const meta = narrowOutcome(result.meta);
			return {
				card: "generic",
				title: meta ? `${meta.count} refs for "${meta.query}"` : "refkit search",
				content: result.content
			};
		},
		execute: (args, exec) => runSearch(args, deps, exec.signal)
	});
}
//#endregion
//#region src/index.ts
const name = "refkit";
const inject = ["tools"];
/** Model-facing guidance; registered as prompt section `tool:refkit`. */
const GUIDANCE = "Use refkit_search when the user wants reference material for creative work — reference images, textures, artworks, sound effects, music, poems or book passages — rather than web pages. Pass `intent` when the user has said how the material will be used, and `gateFor` when only usable results should come back; cite each result's canonicalUrl and repeat its credit line whenever a result requires attribution. Use refkit_rights to re-check one license for a different intent without searching again.";
/** Register everything; `deps` exists so tests can observe client construction. Returns the live handles the tools close over. */
function applyWith(ctx, config, deps) {
	const env = deps.env ?? process.env;
	let resolved = resolveConfig(readConfig(config), env);
	let client = null;
	ctx.on("loader/volatile-update", () => {
		resolved = resolveConfig(readConfig(config), env);
		client = null;
	});
	const getConfig = () => resolved;
	const getClient = () => client ??= buildClient(resolved, deps.createClient);
	ctx.inject(["settings"], (child) => {
		child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
	});
	ctx.inject(["systemPrompt"], (scope) => {
		scope.systemPrompt.section({
			name: "tool:refkit",
			order: 115,
			text: GUIDANCE
		});
	});
	ctx.tools.register(createSearchTool({
		client: getClient,
		config: getConfig
	}));
	ctx.tools.register(createRightsTool());
	return {
		getClient,
		getConfig
	};
}
/** Cordis entry point; the Loader always supplies the live references. */
function apply(ctx, config) {
	applyWith(ctx, config, { createClient: createRefkit });
}
//#endregion
export { Config, GUIDANCE, KEYLESS_IDS, PLUGIN_VERSION, PROVIDER_IDS, PROVIDER_REGISTRY, RIGHTS_TOOL_NAME, SEARCH_TOOL_NAME, apply, applyWith, buildClient, cardMeta, createRightsTool, createSearchTool, inject, name, narrowOutcome, narrowTile, readConfig, renderSearch, resolveConfig, runRights, runSearch };
