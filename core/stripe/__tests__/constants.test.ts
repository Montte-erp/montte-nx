import { describe, expect, it } from "vitest";
import {
   AddonName,
   EVENT_PRICES,
   FREE_TIER_LIMITS,
   STRIPE_METER_EVENTS,
} from "../src/constants";

describe("AddonName", () => {
   it("has expected values", () => {
      expect(AddonName.BOOST).toBe("boost");
      expect(AddonName.SCALE).toBe("scale");
      expect(AddonName.ENTERPRISE).toBe("enterprise");
   });
});

describe("FREE_TIER_LIMITS", () => {
   it("has positive integer limits for all events", () => {
      for (const [key, value] of Object.entries(FREE_TIER_LIMITS)) {
         expect(value, `${key} should be positive`).toBeGreaterThan(0);
         expect(Number.isInteger(value), `${key} should be integer`).toBe(true);
      }
   });
});

describe("EVENT_PRICES", () => {
   it("has string prices with 6 decimal places for all events", () => {
      for (const [key, value] of Object.entries(EVENT_PRICES)) {
         expect(value, `${key} should match N.NNNNNN`).toMatch(/^\d+\.\d{6}$/);
      }
   });

   it("covers all FREE_TIER_LIMITS events", () => {
      for (const key of Object.keys(FREE_TIER_LIMITS)) {
         expect(
            EVENT_PRICES[key],
            `${key} missing from EVENT_PRICES`,
         ).toBeDefined();
      }
   });
});

describe("STRIPE_METER_EVENTS", () => {
   it("covers all FREE_TIER_LIMITS events", () => {
      for (const key of Object.keys(FREE_TIER_LIMITS)) {
         expect(
            STRIPE_METER_EVENTS[key],
            `${key} missing from STRIPE_METER_EVENTS`,
         ).toBeDefined();
      }
   });

   it("has non-empty string values", () => {
      for (const [key, value] of Object.entries(STRIPE_METER_EVENTS)) {
         expect(value, `${key} should be non-empty`).toBeTruthy();
      }
   });
});
