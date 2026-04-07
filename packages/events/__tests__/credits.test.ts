import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHget =
   vi.fn<(key: string, field: string) => Promise<string | null>>();
const mockHincrby =
   vi.fn<(key: string, field: string, increment: number) => Promise<number>>();
const mockPexpire = vi.fn<(key: string, ms: number) => Promise<number>>();
const mockPttl = vi.fn<(key: string) => Promise<number>>();
const mockHgetall = vi.fn<(key: string) => Promise<Record<string, string>>>();

const mockRedis = {
   hget: mockHget,
   hincrby: mockHincrby,
   pexpire: mockPexpire,
   pttl: mockPttl,
   hgetall: mockHgetall,
} as any;

vi.mock("@core/stripe/constants", () => ({
   FREE_TIER_LIMITS: {
      "finance.transaction_created": 500,
      "ai.chat_message": 20,
   } as Record<string, number>,
}));

import {
   enforceCreditBudget,
   getCurrentUsage,
   incrementUsage,
   isWithinFreeTier,
} from "../src/credits";

beforeEach(() => {
   vi.clearAllMocks();
});

describe("isWithinFreeTier", () => {
   it("returns true when usage is below limit", async () => {
      mockHget.mockResolvedValue("10");
      const result = await isWithinFreeTier(
         "org-1",
         "finance.transaction_created",
         mockRedis,
      );
      expect(result).toBe(true);
   });

   it("returns false when usage meets limit", async () => {
      mockHget.mockResolvedValue("500");
      const result = await isWithinFreeTier(
         "org-1",
         "finance.transaction_created",
         mockRedis,
      );
      expect(result).toBe(false);
   });

   it("returns false when usage exceeds limit", async () => {
      mockHget.mockResolvedValue("501");
      const result = await isWithinFreeTier(
         "org-1",
         "finance.transaction_created",
         mockRedis,
      );
      expect(result).toBe(false);
   });

   it("returns true when no usage recorded (null)", async () => {
      mockHget.mockResolvedValue(null);
      const result = await isWithinFreeTier(
         "org-1",
         "finance.transaction_created",
         mockRedis,
      );
      expect(result).toBe(true);
   });

   it("returns true for non-metered events", async () => {
      const result = await isWithinFreeTier(
         "org-1",
         "dashboard.created",
         mockRedis,
      );
      expect(result).toBe(true);
   });

   it("returns true (fail-open) when Redis throws", async () => {
      mockHget.mockRejectedValue(new Error("connection refused"));
      const result = await isWithinFreeTier(
         "org-1",
         "finance.transaction_created",
         mockRedis,
      );
      expect(result).toBe(true);
   });

   it("returns true when no redis provided", async () => {
      const result = await isWithinFreeTier(
         "org-1",
         "finance.transaction_created",
      );
      expect(result).toBe(true);
   });
});

describe("incrementUsage", () => {
   it("increments the hash field", async () => {
      mockHincrby.mockResolvedValue(5);
      await incrementUsage("org-1", "ai.chat_message", mockRedis);
      expect(mockHincrby).toHaveBeenCalledWith(
         "usage:org-1",
         "ai.chat_message",
         1,
      );
   });

   it("sets TTL on first increment", async () => {
      mockHincrby.mockResolvedValue(1);
      mockPttl.mockResolvedValue(-1);
      await incrementUsage("org-1", "ai.chat_message", mockRedis);
      expect(mockPexpire).toHaveBeenCalledWith(
         "usage:org-1",
         expect.any(Number),
      );
   });

   it("does not set TTL on subsequent increments", async () => {
      mockHincrby.mockResolvedValue(2);
      await incrementUsage("org-1", "ai.chat_message", mockRedis);
      expect(mockPexpire).not.toHaveBeenCalled();
   });

   it("no-ops when no redis provided", async () => {
      await incrementUsage("org-1", "ai.chat_message");
      expect(mockHincrby).not.toHaveBeenCalled();
   });

   it("silently swallows Redis errors", async () => {
      mockHincrby.mockRejectedValue(new Error("connection refused"));
      await expect(
         incrementUsage("org-1", "ai.chat_message", mockRedis),
      ).resolves.not.toThrow();
   });
});

describe("enforceCreditBudget", () => {
   it("does not throw when within free tier", async () => {
      mockHget.mockResolvedValue("10");
      await expect(
         enforceCreditBudget(
            "org-1",
            "finance.transaction_created",
            mockRedis,
            null,
         ),
      ).resolves.not.toThrow();
   });

   it("does not throw when over free tier but stripe customer exists", async () => {
      mockHget.mockResolvedValue("600");
      await expect(
         enforceCreditBudget(
            "org-1",
            "finance.transaction_created",
            mockRedis,
            "cus_123",
         ),
      ).resolves.not.toThrow();
   });

   it("throws when over free tier and no stripe customer", async () => {
      mockHget.mockResolvedValue("600");
      await expect(
         enforceCreditBudget(
            "org-1",
            "finance.transaction_created",
            mockRedis,
            null,
         ),
      ).rejects.toThrow();
   });

   it("does not throw for non-metered events even without stripe", async () => {
      await expect(
         enforceCreditBudget("org-1", "dashboard.created", mockRedis, null),
      ).resolves.not.toThrow();
   });
});

describe("getCurrentUsage", () => {
   it("returns usage data for metered events", async () => {
      mockHget.mockResolvedValue("100");
      const result = await getCurrentUsage(
         "org-1",
         "finance.transaction_created",
         mockRedis,
      );
      expect(result).toEqual({
         used: 100,
         limit: 500,
         withinFreeTier: true,
      });
   });

   it("returns over-limit status", async () => {
      mockHget.mockResolvedValue("600");
      const result = await getCurrentUsage(
         "org-1",
         "finance.transaction_created",
         mockRedis,
      );
      expect(result).toEqual({
         used: 600,
         limit: 500,
         withinFreeTier: false,
      });
   });

   it("returns zero usage when no data", async () => {
      mockHget.mockResolvedValue(null);
      const result = await getCurrentUsage(
         "org-1",
         "finance.transaction_created",
         mockRedis,
      );
      expect(result).toEqual({
         used: 0,
         limit: 500,
         withinFreeTier: true,
      });
   });

   it("returns zero limit for non-metered events", async () => {
      mockHget.mockResolvedValue(null);
      const result = await getCurrentUsage(
         "org-1",
         "dashboard.created",
         mockRedis,
      );
      expect(result).toEqual({
         used: 0,
         limit: 0,
         withinFreeTier: false,
      });
   });
});
