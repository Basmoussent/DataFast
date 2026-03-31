/**
 * Browser-side helpers for DataFast + CREEM integration.
 *
 * This module is safe to import in browser environments — it has no Node.js
 * dependencies. Import it as `creem-datafast/browser`.
 *
 * @example
 * ```typescript
 * import { getDataFastVisitorId, appendVisitorIdToCheckoutUrl } from "creem-datafast/browser";
 *
 * // Read the visitor ID (set by DataFast's tracking script)
 * const visitorId = getDataFastVisitorId();
 *
 * // Append it to a server-generated checkout URL before redirecting
 * const checkoutUrl = appendVisitorIdToCheckoutUrl(rawCheckoutUrl);
 * window.location.href = checkoutUrl;
 * ```
 */

const COOKIE_NAME = "datafast_visitor_id";

/**
 * Reads the `datafast_visitor_id` cookie from the browser.
 * Returns `null` if the cookie is not set or the environment is not a browser.
 */
export function getDataFastVisitorId(): string | null {
  if (typeof document === "undefined") return null;

  for (const part of document.cookie.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (!rawKey) continue;
    if (rawKey.trim() === COOKIE_NAME) {
      const val = rest.join("=").trim();
      return val.length > 0 ? decodeURIComponent(val) : null;
    }
  }

  return null;
}

/**
 * Appends `datafast_visitor_id` as a query parameter to the given URL
 * (typically a CREEM checkout URL). Use this when you want the visitor ID
 * passed via URL rather than server-side cookie.
 *
 * If no visitor ID is found, the URL is returned unchanged.
 */
export function appendVisitorIdToCheckoutUrl(checkoutUrl: string): string {
  const visitorId = getDataFastVisitorId();
  if (!visitorId) return checkoutUrl;

  const url = new URL(checkoutUrl);
  url.searchParams.set(COOKIE_NAME, visitorId);
  return url.toString();
}

/**
 * Reads `datafast_visitor_id` from the current page's URL query parameters.
 * Useful if the visitor ID is passed through the checkout success redirect URL.
 */
export function getVisitorIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(COOKIE_NAME);
}
