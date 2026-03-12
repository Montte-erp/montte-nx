import { beforeEach, describe, expect, it, vi } from "vitest";

const { loggerErrorMock } = vi.hoisted(() => ({
   loggerErrorMock: vi.fn(),
}));

vi.mock("@core/logging/root", () => ({
   getLogger: () => ({
      child: () => ({
         error: loggerErrorMock,
      }),
   }),
}));

import { createBetterAuthStorage } from "../src/cache";

describe("createBetterAuthStorage", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("prefixes keys and uses EX when ttl is provided", async () => {
      const redis = {
         del: vi.fn(),
         get: vi.fn(),
         set: vi.fn(),
      } as any;

      const storage = createBetterAuthStorage(redis, {
         prefix: "session:",
      });

      await storage.set("token", "value", 60);

      expect(redis.set).toHaveBeenCalledWith(
         "session:token",
         "value",
         "EX",
         60,
      );
   });

   it("returns null when redis get fails", async () => {
      const redis = {
         del: vi.fn(),
         get: vi.fn().mockRejectedValueOnce(new Error("boom")),
         set: vi.fn(),
      } as any;

      const storage = createBetterAuthStorage(redis);

      await expect(storage.get("token")).resolves.toBeNull();
      expect(loggerErrorMock).toHaveBeenCalledWith(
         {
            err: expect.any(Error),
            key: "token",
         },
         "Error getting key",
      );
   });
});
