// Public surface of @taptap-pay/sdk. Generated proto messages are
// re-exported under the `./gen/*` subpath via package.json `exports`.

export { TapTap, PROD_BASE_URL, SANDBOX_BASE_URL } from "./client.js";
export type { TapTapOptions, TapTapMode } from "./client.js";

export {
  isNotFound,
  isAlreadyExists,
  isInvalidArgument,
  isPermissionDenied,
  isUnauthenticated,
  isRateLimited,
  isFailedPrecondition,
  newIdempotencyKey,
} from "./errors.js";

export { iter, items } from "./pagination.js";
export type { Page, FetchPageFn } from "./pagination.js";

export { VERSION } from "./version.js";
