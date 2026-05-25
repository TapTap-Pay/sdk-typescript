import { createClient, type Client } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { InvoicesService } from "../gen/v1/programmatic/invoices/invoices_pb.js";
import { PayInsService } from "../gen/v1/programmatic/payins/payins_pb.js";
import { PaymentLinksService } from "../gen/v1/programmatic/payment_links/payment_links_pb.js";
import { PaymentsService } from "../gen/v1/programmatic/payments/payments_pb.js";
import { PayOutsService } from "../gen/v1/programmatic/payouts/payouts_pb.js";
import { RefundsService } from "../gen/v1/programmatic/refunds/refunds_pb.js";
import { TransactionsService } from "../gen/v1/programmatic/transactions/transactions_pb.js";
import { TransfersService } from "../gen/v1/programmatic/transfers/transfers_pb.js";
import { WalletsService } from "../gen/v1/programmatic/wallets/wallets_pb.js";
import { WebhooksService } from "../gen/v1/programmatic/webhooks/webhooks_pb.js";

import { authInterceptor, userAgentInterceptor } from "./auth.js";
import { retryInterceptor } from "./retry.js";

// Environment URLs. CI rewrites these from secrets at release time.
export const PROD_BASE_URL = "https://api.usetaptap.com";
export const SANDBOX_BASE_URL = "https://api.usetaptap.dev";

export type TapTapMode = "production" | "sandbox";

export interface TapTapOptions {
  /** Secret API key. Required. */
  apiKey: string;
  /** "production" (default) or "sandbox". Ignored when baseUrl is set. */
  mode?: TapTapMode;
  /** Explicit override — ignores mode when set. */
  baseUrl?: string;
  /**
   * Cap automatic retries on transient errors (Unavailable,
   * DeadlineExceeded, ResourceExhausted, network failures). Default 3.
   */
  maxRetries?: number;
  /** Initial backoff between retries (ms). Default 500. */
  retryBaseDelayMs?: number;
  /**
   * Appended to the SDK's own User-Agent header. Use this to identify
   * your integration in support requests, e.g. "my-app/1.4.0".
   */
  userAgent?: string;
  /**
   * Custom fetch implementation. Defaults to the platform global. Pass
   * your own to share connection pools, plug in observability, or
   * stub for tests.
   */
  fetch?: typeof fetch;
}

/**
 * Entry point for the TapTap-Pay SDK. Construct once and reuse — the
 * per-service sub-clients are safe for concurrent use.
 *
 * @example
 * const client = new TapTap({ apiKey: process.env.TAPTAP_SECRET! });
 * const { link } = await client.paymentLinks.createPaymentLink({
 *   title: "Premium plan",
 *   amount: { amountMinor: 2999n, currency: "EUR" },
 *   targetWalletId: walletId,
 * });
 */
export class TapTap {
  readonly invoices: Client<typeof InvoicesService>;
  readonly payIns: Client<typeof PayInsService>;
  readonly paymentLinks: Client<typeof PaymentLinksService>;
  readonly payments: Client<typeof PaymentsService>;
  readonly payOuts: Client<typeof PayOutsService>;
  readonly refunds: Client<typeof RefundsService>;
  readonly transactions: Client<typeof TransactionsService>;
  readonly transfers: Client<typeof TransfersService>;
  readonly wallets: Client<typeof WalletsService>;
  readonly webhooks: Client<typeof WebhooksService>;

  constructor(opts: TapTapOptions) {
    if (!opts.apiKey) {
      throw new Error("TapTap: apiKey is required");
    }

    const transport = createConnectTransport({
      baseUrl: opts.baseUrl ?? (opts.mode === "sandbox" ? SANDBOX_BASE_URL : PROD_BASE_URL),
      fetch: opts.fetch,
      interceptors: [
        userAgentInterceptor(opts.userAgent),
        authInterceptor(opts.apiKey),
        retryInterceptor(opts.maxRetries ?? 3, opts.retryBaseDelayMs ?? 500),
      ],
    });

    this.invoices = createClient(InvoicesService, transport);
    this.payIns = createClient(PayInsService, transport);
    this.paymentLinks = createClient(PaymentLinksService, transport);
    this.payments = createClient(PaymentsService, transport);
    this.payOuts = createClient(PayOutsService, transport);
    this.refunds = createClient(RefundsService, transport);
    this.transactions = createClient(TransactionsService, transport);
    this.transfers = createClient(TransfersService, transport);
    this.wallets = createClient(WalletsService, transport);
    this.webhooks = createClient(WebhooksService, transport);
  }
}
