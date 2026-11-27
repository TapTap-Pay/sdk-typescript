# TapTap-Pay TypeScript SDK

[![License](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](LICENSE)

The official TypeScript SDK for the [TapTap-Pay](https://usetaptap.com) API.

Wraps the generated [Connect-ES](https://connectrpc.com/) clients with
API-key authentication, transient-error retries with exponential
backoff + jitter, typed error guards, and an async-iterator pagination
helper. Works in modern Node.js (18+, native `fetch`), browsers,
Bun, Deno, and Cloudflare Workers.

The SDK exposes only the programmatic API surface (the
`taptap.<context>.programmatic.v1` packages) — the API-key authenticated
endpoints meant for server-to-server integrations.

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

const client = new TapTap({ apiKey: process.env.TAPTAP_API_KEY! });

const { paymentLink } = await client.paymentLinks.createPaymentLink({
  vendorId: process.env.TAPTAP_VENDOR_ID!,
  title: "Premium plan",
  amount: { currency: "EUR", amountMinor: 2999n },
  usage: { usage: { case: "unlimited", value: true } },
});

console.log(paymentLink?.id);
```

Amounts in minor units are `bigint` values (the `n` suffix).

## Services

| Client property | Service | Module under `@taptap-pay/sdk/gen/taptap/` |
|---|---|---|
| `banking` | `BankingService` | `banking/programmatic/v1/banking_service_pb` |
| `customers` | `CustomerService` | `payment/programmatic/v1/customer_service_pb` |
| `inboundDocuments` | `InboundDocumentService` | `invoicing/programmatic/v1/inbound_document_service_pb` |
| `invoices` | `InvoiceService` | `invoicing/programmatic/v1/invoice_service_pb` |
| `paymentLinks` | `PaymentLinkService` | `payment/programmatic/v1/payment_link_service_pb` |
| `payments` | `PaymentService` | `payment/programmatic/v1/payment_service_pb` |
| `refunds` | `RefundService` | `payment/programmatic/v1/refund_service_pb` |
| `subvendors` | `SubvendorService` | `marketplace/programmatic/v1/subvendor_service_pb` |
| `transactions` | `TransactionService` | `payment/programmatic/v1/transaction_service_pb` |
| `wallets` | `WalletService` | `payment/programmatic/v1/wallet_service_pb` |
| `webhooks` | `WebhookService` | `developer/programmatic/v1/webhook_service_pb` |

Enums and message schemas are imported from those modules, for example
`import { PaymentPurpose } from "@taptap-pay/sdk/gen/taptap/payment/programmatic/v1/payment_service_pb"`.

## Authentication

API keys are minted in the [dashboard](https://app.usetaptap.com), in your
vendor's settings under API keys. A key looks like `taptap_live_` followed
by a lookup part, a dot and a secret part. The SDK sends it as
`Authorization: Bearer <key>` on every request.

## Vendor id

A key belongs to one vendor, and every request names that vendor in its
`vendorId` field (`ven_` followed by a UUID). The SDK does not fill it in:
set it on each request. Naming a vendor the key does not belong to is
answered like a vendor that does not exist (`not_found`, code
`VENDOR_NOT_FOUND`).

## Configuration

```ts
const client = new TapTap({
  apiKey: "taptap_live_...",        // required
  baseUrl: "https://api.usetaptap.com", // optional override
  maxRetries: 3,                    // default 3
  retryBaseDelayMs: 500,            // default 500ms
  userAgent: "my-app/1.4.0",        // optional, appended to SDK UA
  fetch: customFetch,               // optional, defaults to global fetch
});
```

## Idempotency

State-changing RPCs accept an `idempotencyKey` field on their request
(`refundPayment` calls it `requestKey`). Send the same key to safely
retry a write — the API dedupes and returns the original result.

```ts
import { TapTap, newIdempotencyKey } from "@taptap-pay/sdk";

const client = new TapTap({ apiKey: process.env.TAPTAP_API_KEY! });

const key = newIdempotencyKey(); // UUID v4 from crypto.randomUUID
const { payment } = await client.payments.createPayment({
  vendorId,
  idempotencyKey: key,
  // ...
});
```

The SDK's retry layer re-sends the same request on each attempt, so
the key is preserved naturally across automatic retries. Reusing a key
for a request with different content is refused with `aborted` and the
code `IDEMPOTENCY_KEY_CONFLICT` (`isAborted`).

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
  const { paymentLink } = await client.paymentLinks.getPaymentLink({
    vendorId,
    paymentLinkId,
  });
} catch (err) {
  if (isNotFound(err)) {
    // 404
  } else if (isInvalidArgument(err)) {
    // the request was rejected as malformed
  } else if (isRateLimited(err)) {
    // 429 — retry budget exhausted
  } else if (isFailedPrecondition(err)) {
    // resource in wrong state for the operation
  } else {
    throw err;
  }
}
```

Every refusal also carries a `taptap.common.v1.ErrorInfo` detail: a
stable machine code, the parameters around it, and an English debug
message. Branch on the code, never on the message:

```ts
import { errorCode, errorInfo } from "@taptap-pay/sdk";

try {
  await client.refunds.refundPayment(request);
} catch (err) {
  const info = errorInfo(err);
  console.log(info?.code, info?.params); // e.g. REFUND_EXCEEDS_REMAINDER
  if (errorCode(err) !== "REFUND_EXCEEDS_REMAINDER") throw err;
}
```

The raw `ConnectError` is reachable directly — every guard checks
`err instanceof ConnectError` under the hood.

## Pagination

List endpoints return one page at a time and a cursor for the next. Use
the SDK's async iterator to walk every page or every item lazily. The
callback receives the cursor (empty for the first page) and returns the
items and the next cursor:

```ts
import { TapTap, iter, items } from "@taptap-pay/sdk";

const client = new TapTap({ apiKey: process.env.TAPTAP_API_KEY! });

for await (const link of items(
  iter(async (pageToken) => {
    const res = await client.paymentLinks.listPaymentLinks({
      vendorId,
      pageSize: 100,
      pageToken,
    });
    return { items: res.paymentLinks, nextPageToken: res.nextPageToken };
  }),
)) {
  console.log(link.id);
}
```

The cursor is spelled three ways across the API, and the callback is
where you map it:

| Lists | Request | Response |
|---|---|---|
| Most (`listPayments`, `listPaymentLinks`, `listRefunds`, `listCustomers`, `listUnappliedReceipts`, `listWalletTransactions`, `listBankTransfers`, `listSubscriptions`, `listDeliveries`) | `pageToken` | `nextPageToken` |
| `listInvoices`, `listInboundDocuments` | `cursor` | `nextCursor` |
| `listSubvendors` | `page: { pageToken }` | `page?.nextPageToken` |

`listWallets` returns every wallet in one response.

## Versioning

This package has its own semver versions. After each release of the
[TapTap-Pay monorepo](https://github.com/TapTap-Pay/monorepo), `gen/` is
regenerated from its programmatic protos and pushed here, which cuts the
next SDK release.

## Contributing

The generated code in `gen/` is overwritten by CI on every release.
Don't hand-edit it — change the source `.proto` under
`proto/taptap/*/programmatic/` in the
[`monorepo`](https://github.com/TapTap-Pay/monorepo) instead.

Hand-written ergonomics (everything in `src/`) is fair game for PRs.
Run the tests with `npm test`.

## License

Apache 2.0 — see [LICENSE](LICENSE).
