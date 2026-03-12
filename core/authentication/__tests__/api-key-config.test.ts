import { describe, expect, it } from "vitest";
import {
   getRateLimitConfig,
   SDK_MINUTE_LIMIT,
   SDK_RATE_LIMIT,
} from "../src/api-key-config";

describe("api key config", () => {
   it("returns the shared SDK rate limit config", () => {
      expect(getRateLimitConfig()).toBe(SDK_RATE_LIMIT);
   });

   it("keeps the exported per-minute limit in sync with the config", () => {
      expect(SDK_MINUTE_LIMIT).toBe(SDK_RATE_LIMIT.rateLimitMax);
   });
});
