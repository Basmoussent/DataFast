import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { WebhookProcessor } from "../webhook.js";
import type { DataFastClient } from "../datafast.js";
import type { CreemCheckoutCompletedObject, CreemSubscriptionObject } from "../types.js";

const SECRET = "test-webhook-secret";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function makeDataFastClient(
  override: Partial<DataFastClient> = {}
): DataFastClient {
  return {
    trackConversion: vi.fn().mockResolvedValue({ success: true, conversionId: "conv_123" }),
    ...override,
  } as unknown as DataFastClient;
}

describe("WebhookProcessor", () => {
  describe("verifySignature", () => {
    it("returns true for a valid signature", () => {
      const processor = new WebhookProcessor(SECRET, makeDataFastClient());
      const body = JSON.stringify({ eventType: "checkout.completed" });
      expect(processor.verifySignature(body, sign(body))).toBe(true);
    });

    it("returns false for a tampered payload", () => {
      const processor = new WebhookProcessor(SECRET, makeDataFastClient());
      const body = JSON.stringify({ eventType: "checkout.completed" });
      const tampered = JSON.stringify({ eventType: "checkout.completed", extra: true });
      expect(processor.verifySignature(tampered, sign(body))).toBe(false);
    });

    it("returns false for an invalid signature string", () => {
      const processor = new WebhookProcessor(SECRET, makeDataFastClient());
      const body = "{}";
      expect(processor.verifySignature(body, "notahex")).toBe(false);
    });
  });

  describe("process — checkout.completed", () => {
    const checkoutObject: CreemCheckoutCompletedObject = {
      id: "chk_abc",
      status: "completed",
      order: { id: "ord_123", total_amount: 1999, currency: "USD", status: "paid" },
      product: { id: "prod_xxx", name: "Pro Plan", price: 1999, currency: "USD" },
      customer: { id: "cust_yyy", email: "alice@example.com" },
      metadata: { datafast_visitor_id: "df_visitor_abc" },
    };

    const event = {
      id: "evt_1",
      eventType: "checkout.completed" as const,
      created_at: Date.now(),
      object: checkoutObject,
    };

    it("tracks a DataFast conversion when visitor ID is present", async () => {
      const datafastClient = makeDataFastClient();
      const processor = new WebhookProcessor(SECRET, datafastClient);

      const body = JSON.stringify(event);
      const result = await processor.process(body, sign(body));

      expect(result.ok).toBe(true);
      expect(datafastClient.trackConversion).toHaveBeenCalledOnce();
      expect(datafastClient.trackConversion).toHaveBeenCalledWith(
        expect.objectContaining({
          visitor_id: "df_visitor_abc",
          transaction_id: "ord_123",
          amount: 1999,
          currency: "USD",
          event_type: "purchase",
          product_name: "Pro Plan",
        })
      );
    });

    it("calls onCheckoutCompleted handler with correct context", async () => {
      const datafastClient = makeDataFastClient();
      const processor = new WebhookProcessor(SECRET, datafastClient);
      const onCheckoutCompleted = vi.fn();

      const body = JSON.stringify(event);
      await processor.process(body, sign(body), { onCheckoutCompleted });

      expect(onCheckoutCompleted).toHaveBeenCalledOnce();
      const [obj, ctx] = onCheckoutCompleted.mock.calls[0] as [CreemCheckoutCompletedObject, { conversionTracked: boolean; visitorId: string }];
      expect(obj.customer.email).toBe("alice@example.com");
      expect(ctx.conversionTracked).toBe(true);
      expect(ctx.visitorId).toBe("df_visitor_abc");
    });

    it("does not track conversion when visitor ID is missing", async () => {
      const datafastClient = makeDataFastClient();
      const processor = new WebhookProcessor(SECRET, datafastClient);

      const noVisitorEvent = {
        ...event,
        object: { ...checkoutObject, metadata: {} },
      };

      const body = JSON.stringify(noVisitorEvent);
      await processor.process(body, sign(body));

      expect(datafastClient.trackConversion).not.toHaveBeenCalled();
    });

    it("still calls handler even when DataFast tracking fails", async () => {
      const datafastClient = makeDataFastClient({
        trackConversion: vi.fn().mockResolvedValue({ success: false, error: "Network error" }),
      });
      const processor = new WebhookProcessor(SECRET, datafastClient);
      const onCheckoutCompleted = vi.fn();

      const body = JSON.stringify(event);
      const result = await processor.process(body, sign(body), { onCheckoutCompleted });

      expect(result.ok).toBe(true);
      expect(onCheckoutCompleted).toHaveBeenCalledOnce();
      const [, ctx] = onCheckoutCompleted.mock.calls[0] as [unknown, { conversionTracked: boolean }];
      expect(ctx.conversionTracked).toBe(false);
    });
  });

  describe("process — subscription.paid", () => {
    const subscriptionObject: CreemSubscriptionObject = {
      id: "sub_abc",
      status: "active",
      product: { id: "prod_xxx", name: "Pro Plan", price: 1999, currency: "USD" },
      customer: { id: "cust_yyy", email: "bob@example.com" },
      last_transaction: { id: "txn_789", total_amount: 1999, currency: "USD", status: "paid" },
      metadata: { datafast_visitor_id: "df_visitor_xyz" },
    };

    it("tracks subscription renewal with correct event_type", async () => {
      const datafastClient = makeDataFastClient();
      const processor = new WebhookProcessor(SECRET, datafastClient);

      const event = {
        id: "evt_2",
        eventType: "subscription.paid" as const,
        created_at: Date.now(),
        object: subscriptionObject,
      };

      const body = JSON.stringify(event);
      await processor.process(body, sign(body));

      expect(datafastClient.trackConversion).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: "subscription_renewal",
          subscription_id: "sub_abc",
        })
      );
    });
  });

  describe("process — subscription.active", () => {
    const subscriptionObject: CreemSubscriptionObject = {
      id: "sub_new",
      status: "active",
      product: { id: "prod_xxx", name: "Pro Plan", price: 1999, currency: "USD" },
      customer: { id: "cust_yyy", email: "carol@example.com" },
      last_transaction: { id: "txn_first", total_amount: 1999, currency: "USD", status: "paid" },
      metadata: { datafast_visitor_id: "df_visitor_new" },
    };

    it("tracks subscription_start with correct event_type", async () => {
      const datafastClient = makeDataFastClient();
      const processor = new WebhookProcessor(SECRET, datafastClient);

      const event = {
        id: "evt_active",
        eventType: "subscription.active" as const,
        created_at: Date.now(),
        object: subscriptionObject,
      };

      const body = JSON.stringify(event);
      await processor.process(body, sign(body));

      expect(datafastClient.trackConversion).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: "subscription_start",
          visitor_id: "df_visitor_new",
          subscription_id: "sub_new",
        })
      );
    });

    it("calls onSubscriptionActive handler", async () => {
      const processor = new WebhookProcessor(SECRET, makeDataFastClient());
      const onSubscriptionActive = vi.fn();

      const event = {
        id: "evt_active",
        eventType: "subscription.active" as const,
        created_at: Date.now(),
        object: subscriptionObject,
      };

      const body = JSON.stringify(event);
      await processor.process(body, sign(body), { onSubscriptionActive });

      expect(onSubscriptionActive).toHaveBeenCalledOnce();
    });
  });

  describe("process — subscription.trialing", () => {
    const trialObject: CreemSubscriptionObject = {
      id: "sub_trial",
      status: "trialing",
      product: { id: "prod_xxx", name: "Pro Plan", price: 1999, currency: "USD" },
      customer: { id: "cust_yyy", email: "dave@example.com" },
      metadata: { datafast_visitor_id: "df_visitor_trial" },
    };

    it("does not track DataFast conversion for trials", async () => {
      const datafastClient = makeDataFastClient();
      const processor = new WebhookProcessor(SECRET, datafastClient);

      const event = {
        id: "evt_trial",
        eventType: "subscription.trialing" as const,
        created_at: Date.now(),
        object: trialObject,
      };

      const body = JSON.stringify(event);
      await processor.process(body, sign(body));

      expect(datafastClient.trackConversion).not.toHaveBeenCalled();
    });

    it("calls onSubscriptionTrialing handler with conversionTracked: false", async () => {
      const processor = new WebhookProcessor(SECRET, makeDataFastClient());
      const onSubscriptionTrialing = vi.fn();

      const event = {
        id: "evt_trial",
        eventType: "subscription.trialing" as const,
        created_at: Date.now(),
        object: trialObject,
      };

      const body = JSON.stringify(event);
      await processor.process(body, sign(body), { onSubscriptionTrialing });

      expect(onSubscriptionTrialing).toHaveBeenCalledOnce();
      const [, ctx] = onSubscriptionTrialing.mock.calls[0] as [unknown, { conversionTracked: boolean }];
      expect(ctx.conversionTracked).toBe(false);
    });
  });

  describe("process — logger", () => {
    it("calls custom logger.warn on DataFast failure", async () => {
      const datafastClient = makeDataFastClient({
        trackConversion: vi.fn().mockResolvedValue({ success: false, error: "503" }),
      });
      const warn = vi.fn();
      const processor = new WebhookProcessor(SECRET, datafastClient, { warn });

      const checkoutObject: CreemCheckoutCompletedObject = {
        id: "chk_abc",
        status: "completed",
        order: { id: "ord_123", total_amount: 1999, currency: "USD", status: "paid" },
        product: { id: "prod_xxx", name: "Pro Plan", price: 1999, currency: "USD" },
        customer: { id: "cust_yyy", email: "alice@example.com" },
        metadata: { datafast_visitor_id: "df_visitor_abc" },
      };

      const event = {
        id: "evt_warn",
        eventType: "checkout.completed" as const,
        created_at: Date.now(),
        object: checkoutObject,
      };

      const body = JSON.stringify(event);
      await processor.process(body, sign(body));

      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).toContain("503");
    });
  });

  describe("process — signature failure", () => {
    it("returns ok: false for bad signature", async () => {
      const processor = new WebhookProcessor(SECRET, makeDataFastClient());
      const body = JSON.stringify({ eventType: "checkout.completed", object: {} });
      const result = await processor.process(body, "invalid-sig");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/signature/i);
    });
  });

  describe("process — unknown events", () => {
    it("calls onOtherEvent for unhandled event types", async () => {
      const processor = new WebhookProcessor(SECRET, makeDataFastClient());
      const onOtherEvent = vi.fn();

      const event = {
        id: "evt_3",
        eventType: "refund.created" as const,
        created_at: Date.now(),
        object: {},
      };

      const body = JSON.stringify(event);
      await processor.process(body, sign(body), { onOtherEvent });

      expect(onOtherEvent).toHaveBeenCalledOnce();
    });
  });
});
