import { describe, it, expect, vi, beforeEach } from "vitest";
import { DataFastClient } from "../datafast.js";
import type { DataFastConversionPayload } from "../types.js";

const payload: DataFastConversionPayload = {
  visitor_id: "df_visitor_abc",
  transaction_id: "txn_123",
  amount: 1999,
  currency: "USD",
  event_type: "purchase",
  product_name: "Pro Plan",
};

describe("DataFastClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST to /v1/conversions with correct headers and body", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "conv_xyz" }), { status: 200 })
      );

    const client = new DataFastClient("df_api_key", "https://api.datafast.io");
    const result = await client.trackConversion(payload);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("https://api.datafast.io/v1/conversions");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("df_api_key");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual(payload);

    expect(result.success).toBe(true);
    expect(result.conversionId).toBe("conv_xyz");
  });

  it("returns success: false on non-200 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );

    const client = new DataFastClient("bad_key");
    const result = await client.trackConversion(payload);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/401/);
  });

  it("strips trailing slash from base URL", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "c1" }), { status: 200 })
      );

    const client = new DataFastClient("key", "https://api.datafast.io/");
    await client.trackConversion(payload);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.datafast.io/v1/conversions");
  });

  it("uses default base URL when none provided", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

    const client = new DataFastClient("key");
    await client.trackConversion(payload);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("datafast.io");
  });
});
