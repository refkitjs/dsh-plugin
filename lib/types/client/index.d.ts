/**
 * Browser half of @refkit/dsh-plugin: one keyed tool.call.toolview entry for
 * refkit_search. Every wiring step is logged, never thrown — the web shell
 * fails the whole boot when a plugin apply throws.
 * @module @refkit/dsh-plugin/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
export declare const name = "refkit-client";
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map