import type { Interceptor } from "@connectrpc/connect";

import { VERSION } from "./version.js";

/**
 * Stamps every outgoing request with `Authorization: Bearer <apiKey>`.
 */
export function authInterceptor(apiKey: string): Interceptor {
  return (next) => async (req) => {
    req.header.set("Authorization", `Bearer ${apiKey}`);
    return next(req);
  };
}

/**
 * Identifies the SDK in the User-Agent header for support attribution
 * and to surface SDK version issues. Caller-supplied `extra` (e.g.
 * "my-app/1.4.0") is appended if present.
 */
export function userAgentInterceptor(extra?: string): Interceptor {
  const runtime =
    typeof process !== "undefined" && process.versions?.node
      ? `node/${process.versions.node}`
      : typeof navigator !== "undefined"
        ? "browser"
        : "unknown";
  const ua = [`taptap-sdk-ts/${VERSION}`, `(${runtime})`, extra]
    .filter(Boolean)
    .join(" ");

  return (next) => async (req) => {
    req.header.set("User-Agent", ua);
    return next(req);
  };
}
