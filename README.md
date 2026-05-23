# TapTap-Pay TypeScript SDK

[![License](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](LICENSE)

The official TypeScript SDK for the [TapTap-Pay](https://taptap.rs) API.

Wraps the generated [Connect-ES](https://connectrpc.com/) clients with
API-key authentication, transient-error retries with exponential
backoff + jitter, typed error guards, and an async-iterator pagination
helper. Works in modern Node.js (18+, native `fetch`), browsers,
Bun, Deno, and Cloudflare Workers.

The SDK exposes only the `programmatic/*` API surface — the API-key
authenticated endpoints meant for server-to-server integrations.

## Install

The SDK is published to GitHub Packages. Add the registry once:

```bash
echo "@taptap-pay:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GH_TOKEN" >> ~/.npmrc
```

Then:

```bash
npm install @taptap-pay/sdk
```

Requires Node.js 18+ (or any runtime with native `fetch`).

## Quick start

```ts
import { TapTap } from "@taptap-pay/sdk";

const client = new TapTap({ apiKey: process.env.TAPTAP_SECRET! });

const { link } = await client.paymentLinks.createPaymentLink({
  title: "Premium plan",
  amount: { amountMinor: 2999n, currency: "EUR" },
  targetWalletId: process.env.TAPTAP_WALLET_ID!,
});

console.log(link?.id);
```

## Authentication

API keys are minted in the [dashboard](https://app.taptap.rs). Sandbox
keys are prefixed `sk_test_`, live keys `sk_live_`. The SDK sends them
as `Authorization: Bearer <key>` on every request.

## Configuration

```ts
const client = new TapTap({
  apiKey: "sk_live_...",            // required
  baseUrl: "https://api.taptap.rs", // optional override
  maxRetries: 3,                    // default 3
  retryBaseDelayMs: 500,            // default 500ms
  userAgent: "my-app/1.4.0",        // optional, appended to SDK UA
  fetch: customFetch,               // optional, defaults to global fetch
});
```

## Idempotency

Every state-changing RPC accepts an `idempotencyKey` field on its
request. Send the same key to safely retry a write — the API dedupes
and returns the original result.

```ts
import { TapTap, newIdempotencyKey } from "@taptap-pay/sdk";

const client = new TapTap({ apiKey: process.env.TAPTAP_SECRET! });

const key = newIdempotencyKey(); // UUID v4 from crypto.randomUUID
const payment = await client.payments.requestPayment({
  idempotencyKey: key,
  // ...
});
```

The SDK's retry layer re-sends the same request on each attempt, so
the key is preserved naturally across automatic retries.

## Retries

Transient errors (`Unavailable`, `DeadlineExceeded`, `ResourceExhausted`,
network failures) are retried up to `maxRetries` times with exponential
backoff and full jitter. All other Connect codes surface to the caller
on the first attempt. Streaming RPCs are not retried — Connect bidi
streams aren't safely replayable without application-level checkpoints.

## Errors

```ts
import {
  isNotFound,
  isInvalidArgument,
  isRateLimited,
  isFailedPrecondition,
} from "@taptap-pay/sdk";

try {
  const link = await client.paymentLinks.getPaymentLink({ id });
} catch (err) {
  if (isNotFound(err)) {
    // 404
  } else if (isInvalidArgument(err)) {
    // protovalidate rejected the request
  } else if (isRateLimited(err)) {
    // 429 — retry budget exhausted
  } else if (isFailedPrecondition(err)) {
    // resource in wrong state for the operation
  } else {
    throw err;
  }
}
```

The raw `ConnectError` is reachable directly — every guard checks
`err instanceof ConnectError` under the hood.

## Pagination

List endpoints return one page at a time. Use the SDK's async iterator
to walk every page or every item lazily:

```ts
import { TapTap, iter, items } from "@taptap-pay/sdk";

const client = new TapTap({ apiKey: process.env.TAPTAP_SECRET! });

for await (const link of items(
  iter(async (page) => {
    const res = await client.paymentLinks.listPaymentLinks({
      pagination: { page, pageSize: 100 },
    });
    return { items: res.links, meta: res.meta };
  }),
)) {
  console.log(link.id);
}
```

## Versioning

Releases follow the upstream [TapTap-Pay API](https://github.com/TapTap-Pay/api)
tag exactly — `0.0.32` of the API ships as `0.0.32` of every SDK.
Generated code is regenerated and pushed on each API release; the
hand-written ergonomics layer is left untouched.

## Contributing

The generated code in `gen/` is overwritten by CI on every release.
Don't hand-edit it — change the source `.proto` in the
[`api`](https://github.com/TapTap-Pay/api) repo instead.

Hand-written ergonomics (everything in `src/`) is fair game for PRs.

## License

Apache 2.0 — see [LICENSE](LICENSE).
