import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreemDataFast } from "../client.js";
import type { CreemDataFastConfig } from "../types.js";

// Capture the shared mock function so each test can reset it
const mockCheckoutsCreate = vi.fn();

vi.mock("creem", () => ({
  Creem: vi.fn().mockImplementation(() => ({
    checkouts: { create: mockCheckoutsCreate },
  })),
}));

const defaultCheckoutResponse = {
  id: "chk_mock",
  status: "pending",
  checkoutUrl: "https://checkout.creem.io/chk_mock",
  metadata: {},
  mode: "test",
  object: "checkout",
  product: { id: "prod_xxx", name: "Pro Plan" },
};

const baseConfig: CreemDataFastConfig = {
  creemApiKey: "creem_test_xxx",
  datafastApiKey: "df_test_yyy",
  webhookSecret: "whsec_test",
  testMode: true,
};

beforeEach(() => {
  mockCheckoutsCreate.mockReset();
  mockCheckoutsCreate.mockResolvedValue(defaultCheckoutResponse);
});

describe("CreemDataFast", () => {
  describe("createCheckout", () => {
    it("returns a checkoutUrl", async () => {
      const client = new CreemDataFast(baseConfig);
      const result = await client.createCheckout({
        productId: "prod_xxx",
        successUrl: "https://app.example.com/success",
      });
      expect(result.checkoutUrl).toBe("https://checkout.creem.io/chk_mock");
    });

    it("injects datafast_visitor_id from raw cookie string into metadata", async () => {
      const client = new CreemDataFast(baseConfig);
      await client.createCheckout(
        { productId: "prod_xxx" },
        { cookies: "other=foo; datafast_visitor_id=df_abc123; another=bar" }
      );

      expect(mockCheckoutsCreate).toHaveBeenCalledOnce();
      const callArg = mockCheckoutsCreate.mock.calls[0]?.[0] as {
        metadata?: Record<string, unknown>;
      };
      expect(callArg.metadata?.["datafast_visitor_id"]).toBe("df_abc123");
    });

    it("injects datafast_visitor_id from cookie map", async () => {
      const client = new CreemDataFast(baseConfig);
      await client.createCheckout(
        { productId: "prod_xxx" },
        { cookies: { datafast_visitor_id: "df_map456" } }
      );

      expect(mockCheckoutsCreate).toHaveBeenCalledOnce();
      const callArg = mockCheckoutsCreate.mock.calls[0]?.[0] as {
        metadata?: Record<string, unknown>;
      };
      expect(callArg.metadata?.["datafast_visitor_id"]).toBe("df_map456");
    });

    it("reports visitorIdCaptured: false when cookie is absent", async () => {
      const client = new CreemDataFast(baseConfig);
      const result = await client.createCheckout({ productId: "prod_xxx" });
      expect(result.visitorIdCaptured).toBe(false);
    });

    it("reports visitorIdCaptured: true when cookie is present", async () => {
      const client = new CreemDataFast(baseConfig);
      const result = await client.createCheckout(
        { productId: "prod_xxx" },
        { cookies: "datafast_visitor_id=df_xxx" }
      );
      expect(result.visitorIdCaptured).toBe(true);
    });

    it("merges caller-provided metadata with datafast visitor id", async () => {
      const client = new CreemDataFast(baseConfig);
      await client.createCheckout(
        {
          productId: "prod_xxx",
          metadata: { userId: "user_999", plan: "pro" },
        },
        { cookies: "datafast_visitor_id=df_zzz" }
      );

      expect(mockCheckoutsCreate).toHaveBeenCalledOnce();
      const callArg = mockCheckoutsCreate.mock.calls[0]?.[0] as {
        metadata?: Record<string, unknown>;
      };
      expect(callArg.metadata?.["userId"]).toBe("user_999");
      expect(callArg.metadata?.["datafast_visitor_id"]).toBe("df_zzz");
    });

    it("throws when CREEM returns a checkout without checkoutUrl", async () => {
      mockCheckoutsCreate.mockResolvedValueOnce({
        id: "chk_bad",
        status: "expired",
        checkoutUrl: undefined,
        mode: "test",
        object: "checkout",
        product: "prod_xxx",
      });

      const client = new CreemDataFast(baseConfig);
      await expect(
        client.createCheckout({ productId: "prod_xxx" })
      ).rejects.toThrow(/checkoutUrl/);
    });
  });
});
