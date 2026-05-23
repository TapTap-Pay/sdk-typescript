import type { PaginatedResponseMeta } from "../gen/v1/common/response_pb.js";

/** One page of items returned by a List endpoint plus the meta. */
export interface Page<T> {
  items: T[];
  meta: PaginatedResponseMeta | undefined;
}

/**
 * Per-page callback supplied to `iter`. Receives a 1-indexed page
 * number and returns items + meta.
 */
export type FetchPageFn<T> = (page: number) => Promise<{
  items: T[];
  meta: PaginatedResponseMeta | undefined;
}>;

/**
 * Walks every page of a List endpoint, surfacing one Page at a time.
 *
 * @example
 * for await (const page of iter((p) =>
 *   client.paymentLinks.listPaymentLinks({ pagination: { page: p, pageSize: 100n } })
 *     .then(r => ({ items: r.links, meta: r.meta }))
 * )) {
 *   for (const link of page.items) console.log(link.id);
 * }
 */
export async function* iter<T>(fetch: FetchPageFn<T>): AsyncGenerator<Page<T>> {
  let page = 1;
  while (true) {
    const { items, meta } = await fetch(page);
    yield { items, meta };
    if (!meta || page >= meta.totalPages) return;
    page++;
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
