import { Code, ConnectError } from "@connectrpc/connect";

import {
  ErrorInfoSchema,
  type ErrorInfo,
} from "../gen/taptap/common/v1/error_pb.js";

function codeOf(err: unknown): Code | undefined {
  return err instanceof ConnectError ? err.code : undefined;
}

export const isNotFound = (err: unknown): boolean =>
  codeOf(err) === Code.NotFound;

export const isAlreadyExists = (err: unknown): boolean =>
  codeOf(err) === Code.AlreadyExists;

export const isInvalidArgument = (err: unknown): boolean =>
  codeOf(err) === Code.InvalidArgument;

export const isPermissionDenied = (err: unknown): boolean =>
  codeOf(err) === Code.PermissionDenied;

export const isUnauthenticated = (err: unknown): boolean =>
  codeOf(err) === Code.Unauthenticated;

/** ResourceExhausted — retry budget exhausted by the SDK. */
export const isRateLimited = (err: unknown): boolean =>
  codeOf(err) === Code.ResourceExhausted;

export const isFailedPrecondition = (err: unknown): boolean =>
  codeOf(err) === Code.FailedPrecondition;

/**
 * Aborted — returned with code IDEMPOTENCY_KEY_CONFLICT when an
 * idempotency key is reused for a request whose content differs.
 */
export const isAborted = (err: unknown): boolean =>
  codeOf(err) === Code.Aborted;

/**
 * Returns the `taptap.common.v1.ErrorInfo` detail the API attaches to
 * every refusal: a stable machine `code` (e.g. PAYMENT_LINK_NOT_FOUND),
 * the `params` around it, and an English debug `message`. Branch on the
 * code, never on the message. Undefined when `err` is not a
 * ConnectError or carries no such detail (e.g. a network failure).
 */
export function errorInfo(err: unknown): ErrorInfo | undefined {
  if (!(err instanceof ConnectError)) {
    return undefined;
  }
  return err.findDetails(ErrorInfoSchema)[0];
}

/** The stable machine code of a refusal, or undefined without one. */
export function errorCode(err: unknown): string | undefined {
  return errorInfo(err)?.code;
}

/**
 * Generate a fresh UUID v4 suitable for use as an `idempotency_key`
 * on state-changing requests. Persist client-side before sending the
 * request so a crash-restart can resend the same key.
 */
export function newIdempotencyKey(): string {
  // Use the platform's crypto.randomUUID when available (Node 19+,
  // all modern browsers, all CF/Bun/Deno). Fallback otherwise.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Minimal RFC 4122 v4 fallback. Not cryptographically secure; the
  // platform's crypto.randomUUID is overwhelmingly the path taken.
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += "-";
    } else if (i === 14) {
      out += "4";
    } else if (i === 19) {
      out += hex[8 + Math.floor(Math.random() * 4)];
    } else {
      out += hex[Math.floor(Math.random() * 16)];
    }
  }
  return out;
}
