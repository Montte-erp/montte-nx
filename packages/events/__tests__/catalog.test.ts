import { describe, expect, it } from "vitest";
import { EVENT_CATEGORIES, getEventCategory } from "../src/catalog";

describe("EVENT_CATEGORIES", () => {
   it("contains all expected categories", () => {
      expect(EVENT_CATEGORIES).toEqual({
         finance: "finance",
         ai: "ai",
         webhook: "webhook",
         dashboard: "dashboard",
         insight: "insight",
         contact: "contact",
         service: "service",
         nfe: "nfe",
         document: "document",
         system: "system",
      });
   });
});

describe("getEventCategory", () => {
   it("extracts category from dotted event name", () => {
      expect(getEventCategory("finance.transaction_created")).toBe("finance");
      expect(getEventCategory("ai.chat_message")).toBe("ai");
      expect(getEventCategory("webhook.delivered")).toBe("webhook");
   });

   it("returns undefined for unknown category prefix", () => {
      expect(getEventCategory("unknown.event")).toBeUndefined();
   });

   it("returns undefined for empty string", () => {
      expect(getEventCategory("")).toBeUndefined();
   });

   it("handles single segment event name", () => {
      expect(getEventCategory("finance")).toBe("finance");
   });

   it("handles deeply nested event name", () => {
      expect(getEventCategory("webhook.endpoint.created")).toBe("webhook");
   });
});
