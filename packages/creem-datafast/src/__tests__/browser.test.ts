import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDataFastVisitorId, appendVisitorIdToCheckoutUrl, getVisitorIdFromUrl } from "../browser.js";

describe("browser helpers", () => {
  describe("getDataFastVisitorId", () => {
    const originalDocument = globalThis.document;

    afterEach(() => {
      Object.defineProperty(globalThis, "document", {
        value: originalDocument,
        configurable: true,
      });
    });

    it("returns null when document is undefined (SSR)", () => {
      Object.defineProperty(globalThis, "document", {
        value: undefined,
        configurable: true,
      });
      expect(getDataFastVisitorId()).toBeNull();
    });

    it("reads datafast_visitor_id from document.cookie", () => {
      Object.defineProperty(globalThis, "document", {
        value: { cookie: "foo=bar; datafast_visitor_id=df_abc; baz=qux" },
        configurable: true,
      });
      expect(getDataFastVisitorId()).toBe("df_abc");
    });

    it("returns null when cookie is absent", () => {
      Object.defineProperty(globalThis, "document", {
        value: { cookie: "foo=bar; other=value" },
        configurable: true,
      });
      expect(getDataFastVisitorId()).toBeNull();
    });

    it("URL-decodes the cookie value", () => {
      Object.defineProperty(globalThis, "document", {
        value: { cookie: "datafast_visitor_id=df%20encoded" },
        configurable: true,
      });
      expect(getDataFastVisitorId()).toBe("df encoded");
    });
  });

  describe("appendVisitorIdToCheckoutUrl", () => {
    it("appends visitor ID as query param when cookie is set", () => {
      Object.defineProperty(globalThis, "document", {
        value: { cookie: "datafast_visitor_id=df_xyz" },
        configurable: true,
      });

      const url = appendVisitorIdToCheckoutUrl(
        "https://checkout.creem.io/chk_abc?product=pro"
      );

      const parsed = new URL(url);
      expect(parsed.searchParams.get("datafast_visitor_id")).toBe("df_xyz");
    });

    it("returns url unchanged when no visitor ID cookie", () => {
      Object.defineProperty(globalThis, "document", {
        value: { cookie: "" },
        configurable: true,
      });

      const original = "https://checkout.creem.io/chk_abc";
      expect(appendVisitorIdToCheckoutUrl(original)).toBe(original);
    });
  });

  describe("getVisitorIdFromUrl", () => {
    const originalWindow = globalThis.window;

    afterEach(() => {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    });

    it("returns null in SSR environment", () => {
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        configurable: true,
      });
      expect(getVisitorIdFromUrl()).toBeNull();
    });

    it("reads visitor ID from URL search params", () => {
      Object.defineProperty(globalThis, "window", {
        value: {
          location: {
            search: "?checkout_id=chk_abc&datafast_visitor_id=df_from_url",
          },
        },
        configurable: true,
      });
      expect(getVisitorIdFromUrl()).toBe("df_from_url");
    });
  });
});
