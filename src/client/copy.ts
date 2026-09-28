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
