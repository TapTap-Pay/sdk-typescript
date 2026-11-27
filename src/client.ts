import { createClient, type Client } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { BankingService } from "../gen/taptap/banking/programmatic/v1/banking_service_pb.js";
import { WebhookService } from "../gen/taptap/developer/programmatic/v1/webhook_service_pb.js";
import { InboundDocumentService } from "../gen/taptap/invoicing/programmatic/v1/inbound_document_service_pb.js";
import { InvoiceService } from "../gen/taptap/invoicing/programmatic/v1/invoice_service_pb.js";
import { SubvendorService } from "../gen/taptap/marketplace/programmatic/v1/subvendor_service_pb.js";
import { CustomerService } from "../gen/taptap/payment/programmatic/v1/customer_service_pb.js";
import { PaymentLinkService } from "../gen/taptap/payment/programmatic/v1/payment_link_service_pb.js";
import { PaymentService } from "../gen/taptap/payment/programmatic/v1/payment_service_pb.js";
import { RefundService } from "../gen/taptap/payment/programmatic/v1/refund_service_pb.js";
import { TransactionService } from "../gen/taptap/payment/programmatic/v1/transaction_service_pb.js";
import { WalletService } from "../gen/taptap/payment/programmatic/v1/wallet_service_pb.js";

import { authInterceptor, userAgentInterceptor } from "./auth.js";
import { retryInterceptor } from "./retry.js";

// Environment URLs. CI rewrites these from secrets at release time.
export const PROD_BASE_URL = "https://api.usetaptap.com/";
export const SANDBOX_BASE_URL = "https://api.usetaptap.dev/";

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
 * Every request names the vendor the API key belongs to in `vendorId`
 * (`ven_` followed by a UUID). The SDK does not fill it in.
 *
 * @example
 * const client = new TapTap({ apiKey: process.env.TAPTAP_API_KEY! });
 * const { paymentLink } = await client.paymentLinks.createPaymentLink({
 *   vendorId: process.env.TAPTAP_VENDOR_ID!,
 *   title: "Premium plan",
 *   amount: { currency: "EUR", amountMinor: 2999n },
 *   usage: { usage: { case: "unlimited", value: true } },
 * });
 */
export class TapTap {
  readonly banking: Client<typeof BankingService>;
  readonly customers: Client<typeof CustomerService>;
  readonly inboundDocuments: Client<typeof InboundDocumentService>;
  readonly invoices: Client<typeof InvoiceService>;
  readonly paymentLinks: Client<typeof PaymentLinkService>;
  readonly payments: Client<typeof PaymentService>;
  readonly refunds: Client<typeof RefundService>;
  readonly subvendors: Client<typeof SubvendorService>;
  readonly transactions: Client<typeof TransactionService>;
  readonly wallets: Client<typeof WalletService>;
  readonly webhooks: Client<typeof WebhookService>;

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

    this.banking = createClient(BankingService, transport);
    this.customers = createClient(CustomerService, transport);
    this.inboundDocuments = createClient(InboundDocumentService, transport);
    this.invoices = createClient(InvoiceService, transport);
    this.paymentLinks = createClient(PaymentLinkService, transport);
    this.payments = createClient(PaymentService, transport);
    this.refunds = createClient(RefundService, transport);
    this.subvendors = createClient(SubvendorService, transport);
    this.transactions = createClient(TransactionService, transport);
    this.wallets = createClient(WalletService, transport);
    this.webhooks = createClient(WebhookService, transport);
  }
}
