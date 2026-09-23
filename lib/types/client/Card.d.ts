/**
 * Keyed tool.call.toolview entry for refkit_search. Parses the settled block's
 * presentation metadata into a SearchOutcome and renders a thumbnail grid:
 * license chip on every tile, a coloured use-verdict badge when the call
 * carried an intent, and a one-click credit copy. Every failure path degrades
 * to plain text — the chat row never breaks.
 * @module @refkit/dsh-plugin/client/Card
 */
import { type ReactNode } from 'react';
import type { ToolCallOwnerProps } from '@deepseek-ai/dsh-client-ui-tool/client';
/** The slot component: dispatch by block lifecycle, degrade safely. */
export declare function RefkitCard(props: ToolCallOwnerProps): ReactNode;
export default RefkitCard;
//# sourceMappingURL=Card.d.ts.map