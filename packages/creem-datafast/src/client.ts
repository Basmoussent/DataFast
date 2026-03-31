import { Creem } from "creem";
import { DataFastClient } from "./datafast.js";
import { WebhookProcessor } from "./webhook.js";
import type {
  CreemDataFastConfig,
  CreateCheckoutParams,
  CheckoutResult,
  WebhookHandlers,
} from "./types.js";
import { DATAFAST_COOKIE_NAME, DATAFAST_METADATA_KEY } from "./types.js";

/**
 * CreemDataFast wraps the CREEM SDK and automatically attributes revenue
 * to DataFast visitor sessions.
 *
 * @example
 * ```typescript
 * const client = new CreemDataFast({
 *   creemApiKey: process.env.CREEM_API_KEY!,
 *   datafastApiKey: process.env.DATAFAST_API_KEY!,
 *   webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
 * });
 *
 * // Server-side checkout creation — reads datafast_visitor_id cookie automatically
 * const { checkoutUrl } = await client.createCheckout(
 *   { productId: "prod_xxx", successUrl: "https://myapp.com/success" },
 *   { cookies: req.headers.cookie }
 * );
 * ```
 */
export class CreemDataFast {
  readonly creem: Creem;

  private readonly datafast: DataFastClient;
  private readonly webhookProcessor: WebhookProcessor;
  private readonly defaultSuccessUrl: string | undefined;

  constructor(config: CreemDataFastConfig) {
    this.defaultSuccessUrl = config.appUrl
      ? `${config.appUrl.replace(/\/$/, "")}/success`
      : undefined;

    this.creem = new Creem({
      apiKey: config.creemApiKey,
      serverIdx: config.testMode === true ? 1 : 0,
    });

    this.datafast = new DataFastClient(
      config.datafastApiKey,
      config.datafastApiUrl
    );

    this.webhookProcessor = new WebhookProcessor(
      config.webhookSecret,
      this.datafast,
      config.logger
    );
  }

  /**
   * Creates a CREEM checkout session, automatically injecting the DataFast
   * visitor ID from the request cookies into the checkout metadata.
   *
   * @param params - CREEM checkout parameters
   * @param options.cookies - Raw cookie string (e.g. `req.headers.cookie`)
   *   or a key/value cookie map. Used to read `datafast_visitor_id`.
   */
  async createCheckout(
    params: CreateCheckoutParams,
    options: {
      cookies?: string | Record<string, string>;
      /** URL query parameters — used as fallback when the visitor ID is not in cookies */
      searchParams?: string | URLSearchParams | Record<string, string>;
    } = {}
  ): Promise<CheckoutResult> {
    const visitorId =
      readVisitorIdFromCookies(options.cookies) ??
      readVisitorIdFromSearchParams(options.searchParams);

    const metadata: Record<string, unknown> = { ...params.metadata };
    if (visitorId) {
      metadata[DATAFAST_METADATA_KEY] = visitorId;
    }

    const checkout = await this.creem.checkouts.create({
      successUrl: this.defaultSuccessUrl,
      ...params,
      metadata,
    });

    if (!checkout.checkoutUrl) {
      throw new Error(
        `CREEM returned a checkout without a checkoutUrl (status: ${checkout.status})`
      );
    }

    return {
      checkoutUrl: checkout.checkoutUrl,
      checkout,
      visitorIdCaptured: visitorId !== undefined,
    };
  }

  /**
   * Processes an incoming CREEM webhook: verifies the signature, tracks
   * attribution in DataFast, and calls your handlers.
   *
   * Returns `{ ok: true }` on success or `{ ok: false, error }` on failure.
   */
  async handleWebhook(
    rawBody: string,
    signature: string,
    handlers?: WebhookHandlers
  ): Promise<{ ok: boolean; error?: string }> {
    return this.webhookProcessor.process(rawBody, signature, handlers);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Parses `datafast_visitor_id` from a raw cookie string or cookie map.
 */
function readVisitorIdFromCookies(
  cookies: string | Record<string, string> | undefined
): string | undefined {
  if (!cookies) return undefined;

  if (typeof cookies === "object") {
    const val = cookies[DATAFAST_COOKIE_NAME];
    return typeof val === "string" && val.length > 0 ? val : undefined;
  }

  // Parse raw cookie header: "foo=bar; datafast_visitor_id=abc123; baz=qux"
  for (const part of cookies.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (!rawKey) continue;
    const key = rawKey.trim();
    if (key === DATAFAST_COOKIE_NAME) {
      const val = rest.join("=").trim();
      return val.length > 0 ? decodeURIComponent(val) : undefined;
    }
  }

  return undefined;
}

/**
 * Reads `datafast_visitor_id` from URL search params.
 * Accepts a raw query string (`?foo=bar`), a `URLSearchParams` object,
 * or a plain key/value map.
 */
function readVisitorIdFromSearchParams(
  searchParams: string | URLSearchParams | Record<string, string> | undefined
): string | undefined {
  if (!searchParams) return undefined;

  let val: string | null | undefined;

  if (typeof searchParams === "string") {
    val = new URLSearchParams(searchParams).get(DATAFAST_COOKIE_NAME);
  } else if (searchParams instanceof URLSearchParams) {
    val = searchParams.get(DATAFAST_COOKIE_NAME);
  } else {
    val = searchParams[DATAFAST_COOKIE_NAME];
  }

  return typeof val === "string" && val.length > 0 ? val : undefined;
}
