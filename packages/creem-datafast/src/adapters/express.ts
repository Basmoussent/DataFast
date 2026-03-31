import type { Request, Response, RequestHandler } from "express";
import { WebhookProcessor } from "../webhook.js";
import { DataFastClient } from "../datafast.js";
import type { WebhookHandlers } from "../types.js";

export interface ExpressWebhookConfig {
  webhookSecret: string;
  datafastApiKey: string;
  datafastApiUrl?: string;
  logger?: { warn: (msg: string) => void };
}

/**
 * Creates an Express request handler for CREEM webhooks with automatic
 * DataFast attribution tracking.
 *
 * **Important:** Mount this handler *before* any body-parsing middleware
 * (e.g. `express.json()`) so that `req.rawBody` is available, or pass
 * `rawBodyField` option to specify where the raw body is stored.
 *
 * @example
 * ```typescript
 * import express from "express";
 * import { createExpressWebhookHandler } from "creem-datafast/adapters/express";
 *
 * const app = express();
 *
 * // Capture raw body for webhook verification
 * app.use("/webhooks/creem", express.raw({ type: "application/json" }));
 *
 * app.post(
 *   "/webhooks/creem",
 *   createExpressWebhookHandler(
 *     {
 *       webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
 *       datafastApiKey: process.env.DATAFAST_API_KEY!,
 *     },
 *     {
 *       onCheckoutCompleted: async (object, ctx) => {
 *         console.log("New purchase!", object.customer.email);
 *       },
 *     }
 *   )
 * );
 * ```
 */
export function createExpressWebhookHandler(
  config: ExpressWebhookConfig,
  handlers?: WebhookHandlers
): RequestHandler {
  const processor = new WebhookProcessor(
    config.webhookSecret,
    new DataFastClient(config.datafastApiKey, config.datafastApiUrl),
    config.logger
  );

  return async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers["creem-signature"];

    if (typeof signature !== "string") {
      res.status(400).json({ error: "Missing creem-signature header" });
      return;
    }

    // Support both Buffer (express.raw) and string body
    const rawBody: string =
      Buffer.isBuffer(req.body)
        ? req.body.toString("utf-8")
        : typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body);

    const result = await processor.process(rawBody, signature, handlers);

    if (!result.ok) {
      const status = result.error?.includes("signature") ? 401 : 400;
      res.status(status).json({ error: result.error });
      return;
    }

    res.status(200).json({ received: true });
  };
}
