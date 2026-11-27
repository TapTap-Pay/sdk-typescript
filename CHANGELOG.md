# Changelog

All notable changes to the TapTap-Pay TypeScript SDK are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
`gen/` is regenerated from the
[TapTap-Pay monorepo](https://github.com/TapTap-Pay/monorepo) after each of
its releases.

## [Unreleased]

### Changed (breaking)

- The SDK now targets the contract the monorepo generates: proto packages
  `taptap.<context>.programmatic.v1`, modules under `gen/taptap/`.
- `TapTap` properties follow the new services: `banking`, `customers`,
  `inboundDocuments`, `invoices`, `paymentLinks`, `payments`, `refunds`,
  `subvendors`, `transactions`, `wallets`, `webhooks`. `payIns`, `payOuts`
  and `transfers` are gone; payouts are read through `banking`.
- Every request names the vendor in `vendorId`.
- Pagination is cursor based: `FetchPageFn` takes a page token and returns
  `nextPageToken`, and `Page` carries `nextPageToken` instead of `meta`.

### Added

- `errorInfo` and `errorCode` decode the `taptap.common.v1.ErrorInfo`
  detail attached to every refusal.
- `isAborted`, for an idempotency key reused with different content.

### Fixed

- `import { TapTap } from "@taptap-pay/sdk"` resolves: `main`, `types` and
  the root export point at `dist/src/index.js`, where `tsc` emits it.
- Generated modules under `@taptap-pay/sdk/gen/` can be imported with or
  without a `.js` suffix.
