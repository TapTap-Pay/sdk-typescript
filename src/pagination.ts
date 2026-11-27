/**
 * One page of items returned by a List endpoint plus the cursor the
 * server returned for the page after it (empty on the last page).
 */
export interface Page<T> {
  items: T[];
  nextPageToken: string;
}

/**
 * Per-page callback supplied to `iter`. Receives the cursor of the page
 * to fetch (empty for the first page) and returns the items plus the
 * cursor of the next page, empty when there are no more.
 *
 * The cursor is spelled differently across the List endpoints, which is
 * why the callback does the mapping: most requests take `pageToken` and
 * answer `nextPageToken`; `listInvoices` and `listInboundDocuments` take
 * `cursor` and answer `nextCursor`; `listSubvendors` takes
 * `page: { pageToken }` and answers `page?.nextPageToken`.
 */
export type FetchPageFn<T> = (pageToken: string) => Promise<{
  items: T[];
  nextPageToken: string | undefined;
}>;

/**
 * Walks every page of a List endpoint, surfacing one Page at a time.
 *
 * @example
 * for await (const page of iter((pageToken) =>
 *   client.paymentLinks.listPaymentLinks({ vendorId, pageSize: 100, pageToken })
 *     .then(r => ({ items: r.paymentLinks, nextPageToken: r.nextPageToken }))
 * )) {
 *   for (const link of page.items) console.log(link.id);
 * }
 */
export async function* iter<T>(fetch: FetchPageFn<T>): AsyncGenerator<Page<T>> {
  let pageToken = "";
  while (true) {
    const { items, nextPageToken } = await fetch(pageToken);
    const next = nextPageToken ?? "";
    yield { items, nextPageToken: next };
    if (next === "") return;
    pageToken = next;
  }
}

/**
 * Flattens a paged iterator to one item at a time.
 *
 * @example
 * for await (const link of items(iter(fetchPage))) console.log(link.id);
 */
export async function* items<T>(
  pages: AsyncGenerator<Page<T>>,
): AsyncGenerator<T> {
  for await (const page of pages) {
    yield* page.items;
  }
}
