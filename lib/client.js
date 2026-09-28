window.__ModuleLoader__.load({
	id: "@refkit/dsh-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
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
		//#region src/client/badges.ts
		const LICENSE_CHARS = 20;
		function verdictBadge(decision) {
			switch (decision) {
				case "allowed": return {
					className: "rk-badge rk-badge-allowed",
					label: "Allowed"
				};
				case "allowed-with-attribution": return {
					className: "rk-badge rk-badge-attribution",
					label: "Credit required"
				};
				case "denied": return {
					className: "rk-badge rk-badge-denied",
					label: "Not allowed"
				};
				case "needs-review": return {
					className: "rk-badge rk-badge-review",
					label: "Needs review"
				};
			}
		}
		function licenseLabel(tile) {
			const base = tile.licenseVersion ? `${tile.license} ${tile.licenseVersion}` : tile.license;
			const points = Array.from(base);
			return points.length > LICENSE_CHARS ? points.slice(0, LICENSE_CHARS).join("") + "…" : base;
		}
		function summarizeSources(sources) {
			return {
				fulfilled: sources.filter((s) => s.status === "fulfilled"),
				failed: sources.filter((s) => s.status === "failed"),
				skipped: sources.filter((s) => s.status === "skipped")
			};
		}
		/** CSS `aspect-ratio` value for a tile. */
		function aspectRatio(tile) {
			return tile.width && tile.height && tile.width > 0 && tile.height > 0 ? `${tile.width} / ${tile.height}` : "4 / 3";
		}
		//#endregion
		//#region src/client/copy.ts
		/** UI strings for the card and the settings page. One object so a locale swap is one file. */
		const COPY = {
			searching: "Searching refkit sources…",
			refsFor: (count, query) => `${count} reference${count === 1 ? "" : "s"} for “${query}”`,
			intent: (intent) => `intent: ${intent}`,
			more: "more available — ask for the next page",
			failed: (n) => `${n} source${n === 1 ? "" : "s"} failed`,
			skipped: (n) => `${n} skipped`,
			open: "Open",
			copyCredit: "Copy credit",
			copied: "Copied",
			copyFailed: "Select and copy:",
			empty: "No results. Try broader terms, another modality, or fewer controls.",
			legend: "Verdict:",
			untitled: "(untitled)",
			settings: {
				summary: (configured, total) => `License-aware reference search · ${configured} of ${total} keys set`,
				unavailable: "refkit is not running, so it cannot be configured right now.",
				readOnly: "This deployment stores settings read-only.",
				saveFailed: "The deployment did not accept these values; they were left for you to correct.",
				save: "Save",
				saving: "Saving…",
				overridden: "Overridden",
				reset: "Reset to default",
				keysHeading: "API keys",
				keysNote: "Each key enables the sources named beside it; keyless sources need none. Keys are stored in plain text in this profile’s cordis.patch.yml (file mode 0600) and apply on the next search.",
				keyHint: (env) => `Leave blank to keep the stored key. Environment fallback: ${env.join(" / ")}.`,
				keySet: "Set",
				keyUnset: "Not set",
				remove: "Remove",
				removeLabel: (label) => `Remove the ${label} key`,
				removing: "Removing…",
				removeBlocked: "Save your other edits first: removing a key writes immediately.",
				removeFailed: "Not removed; try again.",
				searchHeading: "Search",
				limit: "Results per call",
				limitHint: "Also caps per-item detail fetches for met, rijksmuseum and polyhaven.",
				poolFactor: "Fusion pool factor",
				poolFactorHint: "Rank-fusion pool multiplier.",
				deadlineMs: "Search deadline (ms)",
				deadlineMsHint: "Whole-search deadline.",
				timeoutMs: "Per-source timeout (ms)",
				timeoutMsHint: "How long one source may take.",
				range: (hint, bounds) => `${hint} ${bounds.min}–${bounds.max}, default ${bounds.default}.`,
				invalidRange: (bounds) => `Enter a whole number from ${bounds.min} to ${bounds.max}, or leave blank for the default.`,
				sources: "Sources",
				sourcesHint: "Comma-separated provider ids. A keyed source also needs its key.",
				sourcesPlaceholder: "empty = all enabled sources",
				sourcesHelp: "Source ids",
				sourcesInvalid: "Unknown source id. Use the ids listed under the info button.",
				userAgent: "User-Agent",
				userAgentHint: "Sent with provider requests. Blank uses refkit-dsh-plugin/<version>.",
				rerank: "Lexical rerank",
				rerankHint: "Rerank fused results over title, description, tags and excerpt.",
				sourceConfidence: "Source confidence",
				sourceConfidenceHint: "Down-weight sources whose batch never mentions the query."
			}
		};
		//#endregion
		//#region src/client/styles.ts
		/**
		* Card and settings-page stylesheet, injected once as <style data-refkit-css>
		* the first time either module evaluates. Classes are prefixed rk-; colours read the shell's
		* alias tokens with neutral fallbacks and adapt to prefers-color-scheme.
		* @module @refkit/dsh-plugin/client/styles
		*/
		const CSS = `
.rk-root { font-family: inherit; color: var(--dsw-alias-label-primary, inherit); }
.rk-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; margin: 2px 0 10px; }
.rk-head-title { font-size: 13px; font-weight: 600; }
.rk-head-meta { font-size: 12px; color: var(--dsw-alias-label-secondary, #656d76); }
.rk-chip { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; line-height: 16px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.14)); color: var(--dsw-alias-label-secondary, #656d76); background: var(--dsw-alias-bg-base, rgba(127,127,127,.08)); }
.rk-chip-muted { opacity: .65; }
.rk-legend { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 11px; color: var(--dsw-alias-label-secondary, #656d76); margin: 0 0 10px; }
.rk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.rk-tile { position: relative; display: flex; flex-direction: column; border-radius: 10px; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); background: var(--dsw-alias-bg-base, rgba(127,127,127,.06)); }
.rk-media { position: relative; width: 100%; background: var(--dsw-alias-bg-base, rgba(127,127,127,.12)); overflow: hidden; }
.rk-media img { display: block; width: 100%; height: 100%; object-fit: cover; }
.rk-media-text { padding: 10px; font-size: 12px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; }
.rk-media-glyph { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 28px; color: var(--dsw-alias-label-tertiary, #8c959f); }
.rk-badge { position: absolute; top: 6px; left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 600; line-height: 16px; color: #fff; }
.rk-badge-allowed { background: #1a7f37; }
.rk-badge-attribution { background: #0969da; }
.rk-badge-denied { background: #cf222e; }
.rk-badge-review { background: #bf8700; }
.rk-chips { position: absolute; right: 6px; bottom: 6px; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; max-width: calc(100% - 12px); }
.rk-chips .rk-chip { background: rgba(0,0,0,.62); color: #fff; border-color: rgba(255,255,255,.25); backdrop-filter: blur(3px); }
.rk-body { padding: 7px 8px 8px; display: flex; flex-direction: column; gap: 6px; }
.rk-title { font-size: 12px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rk-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.rk-btn { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.16)); background: var(--dsw-alias-bg-base, transparent); color: inherit; font-size: 11px; line-height: 16px; cursor: pointer; text-decoration: none; }
.rk-btn:hover { border-color: var(--dsw-alias-border-l1, rgba(0,0,0,.3)); }
.rk-credit { font-size: 11px; line-height: 1.35; color: var(--dsw-alias-label-secondary, #656d76); user-select: all; word-break: break-word; }
.rk-skeleton { aspect-ratio: 4 / 3; border-radius: 10px; background: linear-gradient(90deg, rgba(127,127,127,.10), rgba(127,127,127,.22), rgba(127,127,127,.10)); background-size: 200% 100%; animation: rk-shimmer 1.2s linear infinite; }
@keyframes rk-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.rk-error { padding: 8px 10px; border-radius: 8px; font-size: 12px; color: #cf222e; background: rgba(207,34,46,.08); white-space: pre-wrap; }
.rk-plain { font-size: 12px; white-space: pre-wrap; }
.rk-set-group { display: flex; flex-direction: column; gap: 14px; margin: 0 0 22px; }
.rk-set-heading { margin: 0; font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); }
.rk-set-note { margin: -6px 0 0; font-size: 12px; line-height: 1.45; color: var(--dsw-alias-label-secondary, #656d76); }
.rk-set-key-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: -6px; }
.rk-set-error { font-size: 12px; color: #cf222e; }
.rk-set-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.rk-set-toggle-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rk-set-toggle-label { font-size: 13px; color: var(--dsw-alias-label-primary, inherit); }
.rk-set-toggle-hint { font-size: 12px; color: var(--dsw-alias-label-secondary, #656d76); }
.rk-set-toggle-side { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.rk-set-ids { margin: 0; font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.6; }
@media (prefers-color-scheme: dark) {
  .rk-root { color: var(--dsw-alias-label-primary, inherit); }
  .rk-head-meta, .rk-legend, .rk-credit, .rk-set-note, .rk-set-toggle-hint { color: var(--dsw-alias-label-secondary, #9198a1); }
  .rk-tile { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.12)); background: var(--dsw-alias-bg-base, rgba(255,255,255,.04)); }
  .rk-chip { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.14)); color: var(--dsw-alias-label-secondary, #9198a1); }
  .rk-btn { border-color: var(--dsw-alias-border-l2, rgba(255,255,255,.16)); }
}
`;
		/** Inject the stylesheet once per page load; idempotent by data attribute. */
		function ensureStyle() {
			if (typeof document === "undefined") return;
			const head = document.head ?? document.documentElement;
			if (head.querySelector("style[data-refkit-css]") !== null) return;
			const tag = document.createElement("style");
			tag.setAttribute("data-refkit-css", "1");
			tag.textContent = CSS;
			head.appendChild(tag);
		}
		//#endregion
		//#region src/client/Card.tsx
		/**
		* Keyed tool.call.toolview entry for refkit_search. Parses the settled block's
		* presentation metadata into a SearchOutcome and renders a thumbnail grid:
		* license chip on every tile, a coloured use-verdict badge when the call
		* carried an intent, and a one-click credit copy. Every failure path degrades
		* to plain text — the chat row never breaks.
		* @module @refkit/dsh-plugin/client/Card
		*/
		ensureStyle();
		function textOf(block) {
			if (!("kind" in block)) return "";
			const parts = [];
			for (const item of block.content) if (item.type === "text" && typeof item.text === "string") parts.push(item.text);
			return parts.join("\n");
		}
		function outcomeOf(block) {
			if (!("kind" in block)) return null;
			const fromMeta = narrowOutcome(block.meta);
			if (fromMeta !== null) return fromMeta;
			const text = textOf(block).trim();
			if (text.length === 0 || text[0] !== "{") return null;
			try {
				return narrowOutcome(JSON.parse(text));
			} catch {
				return null;
			}
		}
		function RunningGrid() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "rk-root",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rk-head",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "rk-head-meta",
						children: COPY.searching
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rk-grid",
					children: Array.from({ length: 6 }, (_, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "rk-skeleton" }, i))
				})]
			});
		}
		function CreditButton({ text }) {
			const [state, setState] = (0, react.useState)("idle");
			const copy = () => {
				const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : void 0;
				if (!clipboard) {
					setState("failed");
					return;
				}
				clipboard.writeText(text).then(() => setState("copied"), () => setState("failed"));
			};
			if (state === "failed") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "rk-credit",
				children: [
					COPY.copyFailed,
					" ",
					text
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "rk-btn",
				onClick: copy,
				children: state === "copied" ? COPY.copied : COPY.copyCredit
			});
		}
		function Tile({ tile }) {
			const image = tile.thumbnail ?? tile.preview;
			const badge = tile.useVerdict ? verdictBadge(tile.useVerdict.decision) : null;
			let media;
			if (tile.modality === "image" && image) media = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
				src: image,
				alt: tile.title ?? "",
				loading: "lazy",
				referrerPolicy: "no-referrer",
				onError: (e) => {
					e.currentTarget.style.display = "none";
				}
			});
			else if (tile.modality === "text") media = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "rk-media-text",
				children: tile.excerpt ?? tile.description ?? tile.title ?? COPY.untitled
			});
			else media = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "rk-media-glyph",
				"aria-label": tile.modality,
				children: tile.modality === "audio" ? "♪" : tile.modality === "video" ? "▶" : "▦"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "rk-tile",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "rk-media",
					style: { aspectRatio: aspectRatio(tile) },
					children: [
						media,
						badge && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: badge.className,
							title: tile.useVerdict?.reason,
							children: badge.label
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "rk-chips",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "rk-chip",
								title: tile.provider,
								children: tile.provider
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "rk-chip",
								title: tile.license,
								children: licenseLabel(tile)
							})]
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "rk-body",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "rk-title",
						title: tile.title,
						children: tile.title ?? COPY.untitled
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "rk-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							className: "rk-btn",
							href: tile.canonicalUrl,
							target: "_blank",
							rel: "noopener noreferrer",
							children: COPY.open
						}), tile.attribution && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CreditButton, { text: tile.attribution })]
					})]
				})]
			});
		}
		function Header({ outcome }) {
			const { fulfilled, failed, skipped } = summarizeSources(outcome.sources);
			const failedTitle = failed.map((s) => outcome.warnings.find((w) => w.startsWith(`${s.id}: `)) ?? s.id).join("\n");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "rk-head",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "rk-head-title",
						children: COPY.refsFor(outcome.count, outcome.query)
					}),
					outcome.intent && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "rk-head-meta",
						children: COPY.intent(outcome.intent)
					}),
					fulfilled.map((s) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "rk-chip",
						children: [s.id, s.returned !== void 0 ? ` ${s.returned}` : ""]
					}, s.id)),
					failed.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "rk-chip rk-chip-muted",
						title: failedTitle,
						children: COPY.failed(failed.length)
					}),
					skipped.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "rk-chip rk-chip-muted",
						title: skipped.map((s) => `${s.id}${s.reason ? ` (${s.reason})` : ""}`).join(", "),
						children: COPY.skipped(skipped.length)
					}),
					outcome.nextCursor && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "rk-head-meta",
						children: COPY.more
					})
				]
			}), outcome.intent && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "rk-legend",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: COPY.legend }), [
					"allowed",
					"allowed-with-attribution",
					"denied",
					"needs-review"
				].map((d) => {
					const b = verdictBadge(d);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: b.className,
						style: { position: "static" },
						children: b.label
					}, d);
				})]
			})] });
		}
		/** The slot component: dispatch by call phase, degrade safely. */
		function RefkitCard(props) {
			if (props.phase !== "result") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RunningGrid, {});
			const block = props.block;
			if (block.isError) {
				const text = textOf(block);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rk-error",
					children: text.length > 0 ? text : `${block.error?.name ?? "Error"}: ${block.error?.code ?? "unknown"}`
				});
			}
			const outcome = outcomeOf(block);
			if (outcome === null) {
				const text = textOf(block);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rk-plain",
					children: text.length > 0 ? text : JSON.stringify(block.content, null, 2)
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "rk-root",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Header, { outcome }), outcome.references.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rk-head-meta",
					children: outcome.note ?? COPY.empty
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "rk-grid",
					children: outcome.references.map((tile) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, { tile }, tile.id))
				})]
			});
		}
		//#endregion
		//#region src/client/settings-model.ts
		/** The Host settings namespace: the plugin's row id in `cordis.patch.yml`. */
		const SETTINGS_NS = "refkit";
		/** Secret field → the providers it enables. Key order is the page's display order. */
		const KEY_LABELS = {
			unsplashAccessKey: "Unsplash (images)",
			pexelsApiKey: "Pexels (images, video)",
			pixabayKey: "Pixabay (images, video)",
			flickrApiKey: "Flickr (images)",
			smithsonianApiKey: "Smithsonian (images)",
			braveToken: "Brave Search (images)",
			freesoundToken: "Freesound (audio)",
			jamendoClientId: "Jamendo (audio)",
			europeanaApiKey: "Europeana (images)",
			openverseToken: "Openverse (optional; higher rate limits)"
		};
		/** The secret fields, in display order. */
		const KEY_FIELDS_CLIENT = Object.keys(KEY_LABELS);
		/** Environment fallbacks per key, first match wins (mirrors `KEY_ENV`). */
		const KEY_ENV_HINT = {
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
		/** Every provider id `sources` accepts (mirrors `PROVIDER_IDS`). */
		const SOURCE_IDS = [
			"artic",
			"brave",
			"europeana",
			"flickr",
			"freesound",
			"gutendex",
			"internet-archive",
			"jamendo",
			"met",
			"nailbook",
			"openverse",
			"openverse-audio",
			"pexels",
			"pexels-video",
			"pixabay",
			"pixabay-video",
			"poetrydb",
			"polyhaven",
			"ambientcg",
			"rijksmuseum",
			"smithsonian",
			"unsplash",
			"wikimedia-commons"
		];
		/** The number fields' schema bounds and defaults (mirrors the `Config` schema). */
		const NUMBER_BOUNDS = {
			limit: {
				min: 1,
				max: 30,
				default: 12
			},
			poolFactor: {
				min: 1,
				max: 4,
				default: 2
			},
			deadlineMs: {
				min: 1e3,
				max: 6e4,
				default: 15e3
			},
			timeoutMs: {
				min: 1e3,
				max: 6e4,
				default: 1e4
			}
		};
		/**
		* A boolean field staged as `on` / `off` text, so a switch can drive the
		* shared text-staging model. A blank draft clears the field.
		* @param field - field name inside the namespace section.
		* @returns the field's conversion spec.
		*/
		function settingsBooleanField(field) {
			return {
				field,
				format: (value) => value === true ? "on" : value === false ? "off" : "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					if (trimmed === "on") return {
						kind: "set",
						value: true
					};
					if (trimmed === "off") return {
						kind: "set",
						value: false
					};
				}
			};
		}
		/**
		* A provider-id list staged as comma-separated text. Ids are matched
		* case-insensitively and deduplicated in order; an unknown id makes the draft
		* invalid, which blocks the save. A blank draft clears the field (every
		* enabled source).
		* @param field - field name inside the namespace section.
		* @param ids - the ids the field accepts.
		* @returns the field's conversion spec.
		*/
		function settingsSourcesField(field, ids) {
			const known = new Set(ids);
			return {
				field,
				format: (value) => Array.isArray(value) ? value.filter((id) => typeof id === "string").join(", ") : "",
				parse: (text) => {
					const tokens = text.split(/[\s,]+/).map((token) => token.toLowerCase()).filter((token) => token.length > 0);
					if (tokens.length === 0) return { kind: "clear" };
					if (tokens.some((token) => !known.has(token))) return void 0;
					return {
						kind: "set",
						value: [...new Set(tokens)]
					};
				}
			};
		}
		/**
		* A whole-number field that refuses a draft outside its bounds, so the page
		* marks the field instead of sending a write the Host would refuse. Formats
		* like the shared `settingsNumberField`; a blank draft clears the field.
		* @param field - field name inside the namespace section.
		* @param bounds - inclusive minimum and maximum.
		* @returns the field's conversion spec.
		*/
		function settingsBoundedNumberField(field, bounds) {
			return {
				field,
				format: (value) => typeof value === "number" ? String(value) : "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					const value = Number(trimmed);
					return Number.isSafeInteger(value) && value >= bounds.min && value <= bounds.max ? {
						kind: "set",
						value
					} : void 0;
				}
			};
		}
		/**
		* A write-only key control. The key lives in the `refkit` section itself, so
		* its staged text is written as one path op through the same form's `mutate`;
		* the model only calls this for a non-blank draft, so a blank field keeps the
		* stored key.
		* @param field - the secret field.
		* @param write - the form's mutate, bound by the caller.
		* @returns the secret spec.
		*/
		function secretSpec(field, write) {
			return {
				field,
				write: (text) => write([{
					op: "set",
					path: [field],
					value: text
				}])
			};
		}
		/**
		* The keys the Host reports as stored for one namespace, from the describe
		* mirror's presence markers (values never ride the wire).
		* @param namespaces - the mirror's namespaces; undefined before its first answer.
		* @param ns - the namespace to read.
		* @param fields - the secret fields, in the order to report them.
		* @returns the stored fields, in `fields` order.
		*/
		function configuredKeys(namespaces, ns, fields) {
			const secrets = namespaces?.find((view) => view.ns === ns)?.secrets ?? [];
			const set = new Set(secrets.filter((secret) => secret.set && secret.path.length === 1).map((secret) => secret.path[0]));
			return fields.filter((field) => set.has(field));
		}
		/**
		* The row's one-liner on the Plugins page.
		* @param configured - keys the Host holds.
		* @param total - keys the plugin accepts.
		* @returns the summary line.
		*/
		function summaryText(configured, total) {
			return COPY.settings.summary(configured, total);
		}
		//#endregion
		//#region src/client/settings-controller.ts
		const NUMBER_FIELDS = [
			"limit",
			"poolFactor",
			"deadlineMs",
			"timeoutMs"
		];
		const TOGGLE_FIELDS = ["rerank", "sourceConfidence"];
		const SEARCH_FIELDS = [
			...NUMBER_FIELDS,
			"sources",
			"userAgent",
			...TOGGLE_FIELDS
		];
		/**
		* Bind the `refkit` namespace's shared form and stage the page's edits over it.
		* @param configForms - the settings domain service (`ctx.configForms`).
		* @returns the page face and its disposer.
		*/
		function createSettingsController(configForms) {
			const scope = configForms.get(SETTINGS_NS);
			const describe = configForms.describe();
			const write = (ops) => scope.mutate(ops);
			const model = new _deepseek_ai_dsh_client_ui_primitives.SettingsFormModel(scope, [
				...NUMBER_FIELDS.map((field) => settingsBoundedNumberField(field, NUMBER_BOUNDS[field])),
				settingsSourcesField("sources", SOURCE_IDS),
				(0, _deepseek_ai_dsh_client_ui_primitives.settingsTextField)("userAgent"),
				...TOGGLE_FIELDS.map((field) => settingsBooleanField(field))
			], KEY_FIELDS_CLIENT.map((field) => secretSpec(field, write)));
			const readConfigured = () => configuredKeys(describe.getSnapshot().view?.namespaces, SETTINGS_NS, KEY_FIELDS_CLIENT);
			let configured = readConfigured();
			let removing = null;
			let removeFailed = null;
			let disposed = false;
			const project = () => ({
				...model.shell(),
				fields: Object.fromEntries(SEARCH_FIELDS.map((field) => [field, model.field(field)])),
				keys: Object.fromEntries(KEY_FIELDS_CLIENT.map((field) => [field, model.field(field)])),
				configured,
				removing,
				removeFailed
			});
			const store = model.bind(project);
			const publish = () => {
				if (!disposed) store.set(project());
			};
			const offDescribe = describe.subscribe(() => {
				const next = readConfigured();
				if (next.length === configured.length && next.every((field, i) => field === configured[i])) return;
				configured = next;
				publish();
			});
			const actions = model.actions();
			/** True while a removal is crossing the wire: the form takes no edits until it settles. */
			const locked = () => removing !== null;
			const remove = (field) => {
				const shell = model.shell();
				if (disposed || locked() || !KEY_FIELDS_CLIENT.includes(field) || !shell.available || !shell.writable || shell.dirty || shell.saving) return;
				actions.discard();
				removing = field;
				removeFailed = null;
				publish();
				const settle = (accepted) => {
					removing = null;
					removeFailed = accepted ? null : field;
					publish();
				};
				write([{
					op: "unset",
					path: [field]
				}]).then(settle, (error) => {
					console.warn("[refkit] removing the stored key failed", field, error);
					settle(false);
				});
			};
			return {
				face: {
					hooks: { refkitSettings: store },
					...actions,
					edit: (field, text) => {
						if (!locked()) actions.edit(field, text);
					},
					resetField: (field) => {
						if (!locked()) actions.resetField(field);
					},
					save: () => {
						if (!locked()) actions.save();
					},
					discard: () => {
						const stale = removeFailed !== null;
						removeFailed = null;
						actions.discard();
						if (stale) publish();
					},
					remove
				},
				dispose: () => {
					if (disposed) return;
					disposed = true;
					offDescribe();
					model.dispose();
				}
			};
		}
		//#endregion
		//#region src/client/SettingsPage.tsx
		ensureStyle();
		const S = COPY.settings;
		const FORM_LABELS = {
			unavailable: S.unavailable,
			readOnly: S.readOnly,
			saveFailed: S.saveFailed,
			save: S.save,
			saving: S.saving
		};
		const fieldId = (field) => `refkit-settings-${field}`;
		/**
		* Render the row's one-liner or its settings form, as the Plugins page asks.
		* @param props - the view asked for, the page snapshot hook, and the form actions.
		* @returns the one-liner, or the form.
		*/
		function RefkitSettingsPage(props) {
			const state = props.useRefkitSettings((snapshot) => snapshot);
			if (props.view === "summary") return summaryText(state.configured.length, KEY_FIELDS_CLIENT.length);
			const disabled = !state.writable || state.removing !== null;
			const common = {
				overriddenLabel: S.overridden,
				resetLabel: S.reset,
				disabled
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.SettingsForm, {
				labels: FORM_LABELS,
				state,
				onSave: props.save,
				onDiscard: props.discard,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "rk-set-group",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
							className: "rk-set-heading",
							children: S.keysHeading
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "rk-set-note",
							children: S.keysNote
						}),
						KEY_FIELDS_CLIENT.map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(KeyRow, {
							field,
							state,
							disabled,
							actions: props
						}, field))
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "rk-set-group",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
							className: "rk-set-heading",
							children: S.searchHeading
						}),
						NUMBER_FIELDS.map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsValueField, {
							id: fieldId(field),
							label: S[field],
							hint: S.range(S[`${field}Hint`], NUMBER_BOUNDS[field]),
							invalidLabel: S.invalidRange(NUMBER_BOUNDS[field]),
							numeric: true,
							...common,
							...state.fields[field],
							onEdit: (text) => {
								props.edit(field, text);
							},
							onReset: () => {
								props.resetField(field);
							}
						}, field)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsValueField, {
							id: fieldId("sources"),
							label: S.sources,
							hint: S.sourcesHint,
							placeholder: S.sourcesPlaceholder,
							help: {
								label: S.sourcesHelp,
								content: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "rk-set-ids",
									children: SOURCE_IDS.join(", ")
								})
							},
							invalidLabel: S.sourcesInvalid,
							...common,
							...state.fields.sources,
							onEdit: (text) => {
								props.edit("sources", text);
							},
							onReset: () => {
								props.resetField("sources");
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsValueField, {
							id: fieldId("userAgent"),
							label: S.userAgent,
							hint: S.userAgentHint,
							invalidLabel: "",
							...common,
							...state.fields.userAgent,
							onEdit: (text) => {
								props.edit("userAgent", text);
							},
							onReset: () => {
								props.resetField("userAgent");
							}
						}),
						TOGGLE_FIELDS.map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
							field,
							state,
							disabled,
							actions: props
						}, field))
					]
				})]
			});
		}
		/** One key: the shared write-only control, and Remove while the Host holds a value. */
		function KeyRow({ field, state, disabled, actions }) {
			const configured = state.configured.includes(field);
			const removing = state.removing === field;
			const label = KEY_LABELS[field] ?? field;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "rk-set-key",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsSecretField, {
					id: fieldId(field),
					label,
					hint: S.keyHint(KEY_ENV_HINT[field] ?? []),
					text: state.keys[field]?.text ?? "",
					configured,
					stateLabel: configured ? S.keySet : S.keyUnset,
					disabled,
					onEdit: (text) => {
						actions.edit(field, text);
					}
				}), configured || removing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "rk-set-key-actions",
					children: [state.removeFailed === field ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "rk-set-error",
						role: "status",
						children: S.removeFailed
					}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						size: "sm",
						"aria-label": S.removeLabel(label),
						title: state.dirty ? S.removeBlocked : void 0,
						disabled: disabled || state.dirty || state.saving,
						onClick: () => {
							actions.remove(field);
						},
						children: removing ? S.removing : S.remove
					})]
				}) : null]
			});
		}
		/** One boolean: a switch staging `on` / `off`, with the same Overridden badge and reset as the value fields. */
		function ToggleRow({ field, state, disabled, actions }) {
			const staged = state.fields[field];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "rk-set-toggle",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "rk-set-toggle-text",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "rk-set-toggle-label",
						children: S[field]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "rk-set-toggle-hint",
						children: S[`${field}Hint`]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "rk-set-toggle-side",
					children: [staged.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
						tone: "neutral",
						children: S.overridden
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						size: "sm",
						disabled,
						onClick: () => {
							actions.resetField(field);
						},
						children: S.reset
					})] }) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
						checked: staged.text === "on",
						label: S[field],
						disabled,
						onChange: (next) => {
							actions.edit(field, next ? "on" : "off");
						}
					})]
				})]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		const name = "refkit-client";
		const inject = ["slots"];
		const REGISTRANT = "@refkit/dsh-plugin";
		/** The refkit row's key on the Plugins page: `<package name>#<row id>` (row id = SETTINGS_NS). */
		const ROW_CONFIG_KEY = "@refkit/dsh-plugin#refkit";
		function apply(ctx) {
			try {
				ctx.inject(["slots"], (scope) => {
					registerToolview(scope);
					registerSettingsPage(scope);
				});
			} catch (error) {
				console.warn("[refkit] client apply failed", error);
			}
		}
		function registerToolview(scope) {
			try {
				scope.slots.inject("tool.call.toolview", () => {
					try {
						return scope.slots.register({
							name: "tool.call.toolview",
							key: "refkit_search",
							priority: 0,
							registrant: REGISTRANT
						}, RefkitCard);
					} catch (error) {
						console.warn("[refkit] toolview registration failed", error);
						return () => {};
					}
				});
			} catch (error) {
				console.warn("[refkit] toolview registration failed", error);
			}
		}
		/**
		* The settings page, wired in an optional child: a required top-level
		* `configForms` inject would leave this entry pending — and fail the web boot —
		* wherever the settings domain is absent. As dsh's own settings pages do, the
		* page is registered only while the Host serves the `refkit` namespace.
		*/
		function registerSettingsPage(scope) {
			try {
				scope.inject(["configForms"], (child) => {
					let controller;
					try {
						const live = createSettingsController(child.configForms);
						controller = live;
						child.effect(() => () => {
							live.dispose();
						}, "refkit: settings form");
						child.effect(() => child.configForms.whileServed([SETTINGS_NS], () => mountSettingsPage(child, live)), "refkit: settings page");
					} catch (error) {
						controller?.dispose();
						console.warn("[refkit] settings page wiring failed", error);
					}
				});
			} catch (error) {
				console.warn("[refkit] settings page wiring failed", error);
			}
		}
		/** Runs inside the settings mirror's notification, so it must never throw into it. */
		function mountSettingsPage(child, controller) {
			try {
				return child.slots.inject("plugins.row.config", () => {
					try {
						return child.slots.register({
							name: "plugins.row.config",
							key: ROW_CONFIG_KEY,
							registrant: REGISTRANT,
							inject: () => controller.face
						}, RefkitSettingsPage);
					} catch (error) {
						console.warn("[refkit] settings page registration failed", error);
						return () => {};
					}
				});
			} catch (error) {
				console.warn("[refkit] settings page registration failed", error);
				return () => {};
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map