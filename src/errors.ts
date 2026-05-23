import { Code, ConnectError } from "@connectrpc/connect";

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
