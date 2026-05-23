import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";

/**
 * Retries transient failures with exponential backoff + full jitter.
 *
 * Retried Connect codes: Unavailable, DeadlineExceeded,
 * ResourceExhausted. Non-Connect errors (network failures, fetch
 * rejections) are also retried — they're the same class of problem.
 *
 * Streaming RPCs are not retried; Connect bidi/server streams aren't
 * safely replayable without application-level checkpoints.
 *
 * Idempotency: state-changing TapTap-Pay RPCs take `idempotency_key`
 * as a request-message field. The same request object is re-sent on
 * every attempt, so the server dedupes naturally as long as the
 * caller set the key.
 */
export function retryInterceptor(
  maxRetries: number,
  baseDelayMs: number,
): Interceptor {
  return (next) => async (req) => {
    if (req.stream) {
      return next(req);
    }
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await next(req);
      } catch (err) {
        if (!isRetryable(err)) {
          throw err;
        }
        lastErr = err;
        if (attempt === maxRetries) {
          break;
        }
        await sleep(backoff(baseDelayMs, attempt));
      }
    }
    throw lastErr;
  };
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof ConnectError)) {
    return true;
  }
  switch (err.code) {
    case Code.Unavailable:
    case Code.DeadlineExceeded:
    case Code.ResourceExhausted:
      return true;
    default:
      return false;
  }
}

function backoff(baseMs: number, attempt: number): number {
  const max = baseMs * 2 ** attempt;
  return Math.floor(Math.random() * max);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
