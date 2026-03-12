import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn<(key: string) => Promise<string | null>>();
const mockIncr = vi.fn<(key: string) => Promise<number>>();
const mockPexpire = vi.fn<(key: string, ms: number) => Promise<number>>();

vi.mock("@core/redis/connection", () => ({
   getRedisConnection: () => ({
      get: mockGet,
      incr: mockIncr,
      pexpire: mockPexpire,
   }),
}));

vi.mock("@core/stripe/constants", () => ({
   FREE_TIER_LIMITS: {
      "finance.transaction_created": 500,
      "ai.chat_message": 20,
   } as Record<string, number>,
}));

import {
   getCurrentUsage,
   incrementUsage,
   isWithinFreeTier,
} from "../src/credits";

beforeEach(() => {
   vi.clearAllMocks();
});

describe("isWithinFreeTier", () => {
   it("returns true when usage is below limit", async () => {
      mockGet.mockResolvedValue("10");
      const result = await isWithinFreeTier(
         "org-1",
         "finance.transaction_created",
      );
      expect(result).toBe(true);
   });

   it("returns false when usage meets limit", async () => {
      mockGet.mockResolvedValue("500");
      const result = await isWithinFreeTier(
         "org-1",
         "finance.transaction_created",
      );
      expect(result).toBe(false);
   });

   it("returns false when usage exceeds limit", async () => {
      mockGet.mockResolvedValue("501");
      const result = await isWithinFreeTier(
         "org-1",
         "finance.transaction_created",
      );
      expect(result).toBe(false);
   });

   it("returns true when no usage recorded (null)", async () => {
      mockGet.mockResolvedValue(null);
      const result = await isWithinFreeTier(
         "org-1",
         "finance.transaction_created",
      );
      expect(result).toBe(true);
   });

   it("returns true for non-metered events", async () => {
      const result = await isWithinFreeTier("org-1", "dashboard.created");
      expect(result).toBe(true);
   });
});

describe("incrementUsage", () => {
   it("increments the counter", async () => {
      mockIncr.mockResolvedValue(5);
      await incrementUsage("org-1", "ai.chat_message");
      expect(mockIncr).toHaveBeenCalledWith("usage:org-1:ai.chat_message");
   });

   it("sets TTL on first increment", async () => {
      mockIncr.mockResolvedValue(1);
      await incrementUsage("org-1", "ai.chat_message");
      expect(mockPexpire).toHaveBeenCalledWith(
         "usage:org-1:ai.chat_message",
         expect.any(Number),
      );
   });

   it("does not set TTL on subsequent increments", async () => {
      mockIncr.mockResolvedValue(2);
      await incrementUsage("org-1", "ai.chat_message");
      expect(mockPexpire).not.toHaveBeenCalled();
   });
});

describe("getCurrentUsage", () => {
   it("returns usage data for metered events", async () => {
      mockGet.mockResolvedValue("100");
      const result = await getCurrentUsage(
         "org-1",
         "finance.transaction_created",
      );
      expect(result).toEqual({
         used: 100,
         limit: 500,
         withinFreeTier: true,
      });
   });

   it("returns over-limit status", async () => {
      mockGet.mockResolvedValue("600");
      const result = await getCurrentUsage(
         "org-1",
         "finance.transaction_created",
      );
      expect(result).toEqual({
         used: 600,
         limit: 500,
         withinFreeTier: false,
      });
   });

   it("returns zero usage when no data", async () => {
      mockGet.mockResolvedValue(null);
      const result = await getCurrentUsage(
         "org-1",
         "finance.transaction_created",
      );
      expect(result).toEqual({
         used: 0,
         limit: 500,
         withinFreeTier: true,
      });
   });

   it("returns zero limit for non-metered events", async () => {
      mockGet.mockResolvedValue(null);
      const result = await getCurrentUsage("org-1", "dashboard.created");
      expect(result).toEqual({
         used: 0,
         limit: 0,
         withinFreeTier: false,
      });
   });
});
