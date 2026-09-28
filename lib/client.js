window.__ModuleLoader__.load({
	id: "@refkit/dsh-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
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
		/** UI strings for the card. One object so a locale swap is one file. */
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
			untitled: "(untitled)"
		};
		//#endregion
		//#region src/client/styles.ts
		/**
		* Card stylesheet, injected once as <style data-refkit-css> the first time the
		* card module evaluates. Classes are prefixed rk-; colours read the shell's
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
@media (prefers-color-scheme: dark) {
  .rk-root { color: var(--dsw-alias-label-primary, inherit); }
  .rk-head-meta, .rk-legend, .rk-credit { color: var(--dsw-alias-label-secondary, #9198a1); }
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
		//#region src/client/index.tsx
		const name = "refkit-client";
		const inject = ["slots"];
		function apply(ctx) {
			try {
				ctx.inject(["slots"], (scope) => {
					try {
						scope.slots.inject("tool.call.toolview", () => {
							try {
								return scope.slots.register({
									name: "tool.call.toolview",
									key: "refkit_search",
									priority: 0,
									registrant: "@refkit/dsh-plugin"
								}, RefkitCard);
							} catch (error) {
								console.warn("[refkit] toolview registration failed", error);
								return () => {};
							}
						});
					} catch (error) {
						console.warn("[refkit] toolview registration failed", error);
					}
				});
			} catch (error) {
				console.warn("[refkit] client apply failed", error);
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