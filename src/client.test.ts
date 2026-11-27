import assert from "node:assert/strict";
import { test } from "node:test";

import { create, toBinary } from "@bufbuild/protobuf";

import { ErrorInfoSchema } from "../gen/taptap/common/v1/error_pb.js";
import {
  TapTap,
  errorCode,
  errorInfo,
  isNotFound,
  items,
  iter,
} from "./index.js";

const API_KEY = "taptap_live_000000000000.test";
const VENDOR_ID = "ven_00000000-0000-0000-0000-000000000001";

interface Seen {
  url: string;
  authorization: string | null;
  body: Record<string, unknown>;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A stand-in for the API: records each call and answers from `reply`. */
function stubClient(reply: (seen: Seen) => Response): {
  client: TapTap;
  calls: Seen[];
} {
  const calls: Seen[] = [];
  const fetchStub: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const seen: Seen = {
      url: request.url,
      authorization: request.headers.get("Authorization"),
      body: JSON.parse(await request.text()),
    };
    calls.push(seen);
    return reply(seen);
  };
  const client = new TapTap({
    apiKey: API_KEY,
    baseUrl: "https://api.example.test",
    fetch: fetchStub,
    retryBaseDelayMs: 1,
  });
  return { client, calls };
}

test("errorInfo decodes the refusal detail", async () => {
  const detail = toBinary(
    ErrorInfoSchema,
    create(ErrorInfoSchema, {
      code: "PAYMENT_LINK_NOT_FOUND",
      params: { payment_link_id: "plink_missing" },
      message: "payment link: not found",
    }),
  );
  const { client, calls } = stubClient(() =>
    json(404, {
      code: "not_found",
      message: "payment link: not found",
      details: [
        {
          type: "taptap.common.v1.ErrorInfo",
          value: Buffer.from(detail).toString("base64").replace(/=+$/, ""),
        },
      ],
    }),
  );

  const err = await client.paymentLinks
    .getPaymentLink({ vendorId: VENDOR_ID, paymentLinkId: "plink_missing" })
    .then(
      () => undefined,
      (e: unknown) => e,
    );

  assert.ok(isNotFound(err));
  assert.equal(errorInfo(err)?.code, "PAYMENT_LINK_NOT_FOUND");
  assert.deepEqual(errorInfo(err)?.params, {
    payment_link_id: "plink_missing",
  });
  assert.equal(errorCode(err), "PAYMENT_LINK_NOT_FOUND");
  assert.equal(calls.length, 1, "not_found is not retried");
  assert.equal(calls[0].authorization, `Bearer ${API_KEY}`);
  assert.equal(
    calls[0].url,
    "https://api.example.test/taptap.payment.programmatic.v1.PaymentLinkService/GetPaymentLink",
  );
  assert.equal(calls[0].body.vendorId, VENDOR_ID);
});

test("errorInfo is undefined without a detail", () => {
  assert.equal(errorInfo(new Error("fetch failed")), undefined);
  assert.equal(errorCode(new Error("fetch failed")), undefined);
  assert.equal(errorInfo(undefined), undefined);
});

test("iter follows nextPageToken until it is empty", async () => {
  const { client, calls } = stubClient((seen) =>
    seen.body.pageToken === "page-2"
      ? json(200, { paymentLinks: [{ id: "plink_3" }] })
      : json(200, {
          paymentLinks: [{ id: "plink_1" }, { id: "plink_2" }],
          nextPageToken: "page-2",
        }),
  );

  const ids: string[] = [];
  for await (const link of items(
    iter(async (pageToken) => {
      const res = await client.paymentLinks.listPaymentLinks({
        vendorId: VENDOR_ID,
        pageToken,
      });
      return { items: res.paymentLinks, nextPageToken: res.nextPageToken };
    }),
  )) {
    ids.push(link.id);
  }

  assert.deepEqual(ids, ["plink_1", "plink_2", "plink_3"]);
  assert.deepEqual(
    calls.map((c) => c.body.pageToken),
    [undefined, "page-2"],
  );
});

test("unavailable is retried", async () => {
  let attempts = 0;
  const { client } = stubClient(() => {
    attempts++;
    return attempts < 3
      ? json(503, { code: "unavailable", message: "down" })
      : json(200, { wallets: [] });
  });

  const res = await client.wallets.listWallets({ vendorId: VENDOR_ID });

  assert.deepEqual(res.wallets, []);
  assert.equal(attempts, 3);
});
