import { createHmac, timingSafeEqual } from "node:crypto";
import type { DataFastClient } from "./datafast.js";
import {
  creemWebhookEventEnvelopeSchema,
  creemCheckoutCompletedObjectSchema,
  creemSubscriptionObjectSchema,
} from "./schemas.js";
import type {
  CreemWebhookEvent,
  CreemCheckoutCompletedObject,
  CreemSubscriptionObject,
  WebhookHandlerContext,
  WebhookHandlers,
  DataFastConversionPayload,
} from "./types.js";
import { DATAFAST_METADATA_KEY } from "./types.js";

export class WebhookProcessor {
  private readonly logger: { warn: (msg: string) => void };

  constructor(
    private readonly webhookSecret: string,
    private readonly datafast: DataFastClient,
    logger?: { warn: (msg: string) => void }
  ) {
    this.logger = logger ?? { warn: (msg) => console.warn(msg) };
  }

  verifySignature(rawBody: string, signature: string): boolean {
    const computed = createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");

    try {
      return timingSafeEqual(
        Buffer.from(computed, "hex"),
        Buffer.from(signature, "hex")
      );
    } catch {
      return false;
    }
  }

  async process(
    rawBody: string,
    signature: string,
    handlers: WebhookHandlers = {}
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.verifySignature(rawBody, signature)) {
      return { ok: false, error: "Invalid webhook signature" };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { ok: false, error: "Invalid JSON payload" };
    }

    const envelope = creemWebhookEventEnvelopeSchema.safeParse(parsed);
    if (!envelope.success) {
      return {
        ok: false,
        error: `Invalid webhook envelope: ${envelope.error.message}`,
      };
    }

    const event = envelope.data as CreemWebhookEvent;

    switch (event.eventType) {
      case "checkout.completed": {
        const obj = creemCheckoutCompletedObjectSchema.safeParse(event.object);
        if (!obj.success) {
          this.logger.warn(
            `[creem-datafast] Skipping checkout.completed: invalid payload — ${obj.error.message}`
          );
          break;
        }
        await this.handleCheckoutCompleted(event, obj.data as unknown as CreemCheckoutCompletedObject, handlers);
        break;
      }

      case "subscription.paid": {
        const obj = creemSubscriptionObjectSchema.safeParse(event.object);
        if (!obj.success) {
          this.logger.warn(
            `[creem-datafast] Skipping subscription.paid: invalid payload — ${obj.error.message}`
          );
          break;
        }
        await this.handleSubscriptionPaid(event, obj.data as unknown as CreemSubscriptionObject, handlers);
        break;
      }

      case "subscription.active": {
        const obj = creemSubscriptionObjectSchema.safeParse(event.object);
        if (!obj.success) {
          this.logger.warn(
            `[creem-datafast] Skipping subscription.active: invalid payload — ${obj.error.message}`
          );
          break;
        }
        await this.handleSubscriptionActive(event, obj.data as unknown as CreemSubscriptionObject, handlers);
        break;
      }

      case "subscription.trialing": {
        const obj = creemSubscriptionObjectSchema.safeParse(event.object);
        if (!obj.success) {
          this.logger.warn(
            `[creem-datafast] Skipping subscription.trialing: invalid payload — ${obj.error.message}`
          );
          break;
        }
        await this.handleSubscriptionTrialing(event, obj.data as unknown as CreemSubscriptionObject, handlers);
        break;
      }

      default:
        if (handlers.onOtherEvent) {
          await handlers.onOtherEvent(event, { event });
        }
    }

    return { ok: true };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async trackConversion(
    payload: DataFastConversionPayload
  ): Promise<{ conversionTracked: boolean }> {
    const result = await this.datafast.trackConversion(payload);
    if (!result.success) {
      this.logger.warn(
        `[creem-datafast] DataFast conversion tracking failed: ${result.error}`
      );
    }
    return { conversionTracked: result.success };
  }

  private async handleCheckoutCompleted(
    event: CreemWebhookEvent,
    object: CreemCheckoutCompletedObject,
    handlers: WebhookHandlers
  ): Promise<void> {
    const visitorId = extractVisitorId(object.metadata);
    let conversionTracked = false;

    if (visitorId) {
      const payload: DataFastConversionPayload = {
        visitor_id: visitorId,
        transaction_id: object.order.id,
        amount: normalizeAmount(object.order.total_amount, object.order.currency),
        currency: object.order.currency,
        event_type: "purchase",
        ...(object.product.name !== undefined && { product_name: object.product.name }),
        ...(object.subscription?.id !== undefined && { subscription_id: object.subscription.id }),
      };
      ({ conversionTracked } = await this.trackConversion(payload));
    }

    const ctx: WebhookHandlerContext = { event, conversionTracked, visitorId };
    if (handlers.onCheckoutCompleted) {
      await handlers.onCheckoutCompleted(object, ctx);
    }
  }

  private async handleSubscriptionPaid(
    event: CreemWebhookEvent,
    object: CreemSubscriptionObject,
    handlers: WebhookHandlers
  ): Promise<void> {
    const visitorId = extractVisitorId(object.metadata);
    let conversionTracked = false;

    if (visitorId && object.last_transaction) {
      const payload: DataFastConversionPayload = {
        visitor_id: visitorId,
        transaction_id: object.last_transaction.id,
        amount: normalizeAmount(object.last_transaction.total_amount, object.last_transaction.currency),
        currency: object.last_transaction.currency,
        event_type: "subscription_renewal",
        product_name: object.product.name,
        subscription_id: object.id,
      };
      ({ conversionTracked } = await this.trackConversion(payload));
    }

    const ctx: WebhookHandlerContext = { event, conversionTracked, visitorId };
    if (handlers.onSubscriptionPaid) {
      await handlers.onSubscriptionPaid(object, ctx);
    }
  }

  private async handleSubscriptionActive(
    event: CreemWebhookEvent,
    object: CreemSubscriptionObject,
    handlers: WebhookHandlers
  ): Promise<void> {
    const visitorId = extractVisitorId(object.metadata);
    let conversionTracked = false;

    if (visitorId && object.last_transaction) {
      const payload: DataFastConversionPayload = {
        visitor_id: visitorId,
        transaction_id: object.last_transaction.id,
        amount: normalizeAmount(object.last_transaction.total_amount, object.last_transaction.currency),
        currency: object.last_transaction.currency,
        event_type: "subscription_start",
        product_name: object.product.name,
        subscription_id: object.id,
      };
      ({ conversionTracked } = await this.trackConversion(payload));
    }

    const ctx: WebhookHandlerContext = { event, conversionTracked, visitorId };
    if (handlers.onSubscriptionActive) {
      await handlers.onSubscriptionActive(object, ctx);
    }
  }

  private async handleSubscriptionTrialing(
    event: CreemWebhookEvent,
    object: CreemSubscriptionObject,
    handlers: WebhookHandlers
  ): Promise<void> {
    const visitorId = extractVisitorId(object.metadata);
    const ctx: WebhookHandlerContext = {
      event,
      conversionTracked: false,
      visitorId,
    };
    if (handlers.onSubscriptionTrialing) {
      await handlers.onSubscriptionTrialing(object, ctx);
    }
  }
}

function extractVisitorId(
  metadata: Record<string, unknown> | undefined
): string | undefined {
  const val = metadata?.[DATAFAST_METADATA_KEY];
  return typeof val === "string" && val.length > 0 ? val : undefined;
}

// Zero-decimal currencies — amount is already the full unit (e.g. JPY 1500 = ¥1500)
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

// Three-decimal currencies — divide by 1000 (e.g. KWD 1500 = 1.500 KD)
const THREE_DECIMAL_CURRENCIES = new Set([
  "BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND",
]);

/**
 * Converts a CREEM amount (always in the currency's smallest unit) to
 * the standard decimal representation expected by DataFast.
 *
 * USD/EUR/GBP/…: cents → divide by 100  (1999 → 19.99)
 * JPY/KRW/…:     already full units      (1500 → 1500)
 * KWD/OMR/…:     fils → divide by 1000  (1500 → 1.500)
 */
export function normalizeAmount(amount: number, currency: string): number {
  const upper = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(upper)) return amount;
  if (THREE_DECIMAL_CURRENCIES.has(upper)) return Math.round(amount) / 1000;
  return Math.round(amount) / 100;
}
