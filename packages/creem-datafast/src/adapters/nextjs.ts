import { WebhookProcessor } from "../webhook.js";
import { DataFastClient } from "../datafast.js";
import type { WebhookHandlers } from "../types.js";

export interface NextJsWebhookConfig {
  webhookSecret: string;
  datafastApiKey: string;
  datafastApiUrl?: string;
  logger?: { warn: (msg: string) => void };
}

/**
 * Creates a Next.js App Router route handler for CREEM webhooks with
 * automatic DataFast attribution tracking.
 *
 * @example
 * ```typescript
 * // app/api/webhooks/creem/route.ts
 * import { createNextJsWebhookHandler } from "creem-datafast/adapters/nextjs";
 *
 * export const POST = createNextJsWebhookHandler(
 *   {
 *     webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
 *     datafastApiKey: process.env.DATAFAST_API_KEY!,
 *   },
 *   {
 *     onCheckoutCompleted: async (object, ctx) => {
 *       console.log("New purchase!", object.customer.email, ctx.visitorId);
 *     },
 *   }
 * );
 * ```
 */
export function createNextJsWebhookHandler(
  config: NextJsWebhookConfig,
  handlers?: WebhookHandlers
): (req: Request) => Promise<Response> {
  const processor = new WebhookProcessor(
    config.webhookSecret,
    new DataFastClient(config.datafastApiKey, config.datafastApiUrl),
    config.logger
  );

  return async (req: Request): Promise<Response> => {
    const signature = req.headers.get("creem-signature");

    if (!signature) {
      return Response.json(
        { error: "Missing creem-signature header" },
        { status: 400 }
      );
    }

    const rawBody = await req.text();

    const result = await processor.process(rawBody, signature, handlers);

    if (!result.ok) {
      const status = result.error?.includes("signature") ? 401 : 400;
      return Response.json({ error: result.error }, { status });
    }

    return Response.json({ received: true });
  };
}

/**
 * Extracts the DataFast visitor ID from a Next.js request's cookies.
 * Use this in your checkout API route to capture the visitor before
 * redirecting to CREEM.
 *
 * @example
 * ```typescript
 * // app/api/checkout/route.ts
 * import { NextRequest } from "next/server";
 * import { getVisitorIdFromNextRequest } from "creem-datafast/adapters/nextjs";
 *
 * export async function GET(req: NextRequest) {
 *   const visitorId = getVisitorIdFromNextRequest(req);
 *   // Pass visitorId to client.createCheckout({ cookies: ... })
 * }
 * ```
 */
export function getVisitorIdFromNextRequest(
  req: { cookies: { get(name: string): { value: string } | undefined } }
): string | undefined {
  const cookie = req.cookies.get("datafast_visitor_id");
  return cookie?.value;
}
