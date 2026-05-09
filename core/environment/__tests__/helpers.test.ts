import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;

describe("environment helpers", () => {
   beforeEach(() => {
      vi.resetModules();
   });

   afterEach(() => {
      if (originalNodeEnv === undefined) {
         delete process.env.NODE_ENV;
      } else {
         process.env.NODE_ENV = originalNodeEnv;
      }
   });

   it("falls back to the production domain in production", async () => {
      process.env.NODE_ENV = "production";

      const { getDomain, isProduction } = await import("../src/helpers");

      expect(isProduction).toBe(true);
      expect(getDomain()).toBe("https://app.montte.co");
   });

   it("falls back to localhost outside production", async () => {
      process.env.NODE_ENV = "development";

      const { getDomain, isProduction } = await import("../src/helpers");

      expect(isProduction).toBe(false);
      expect(getDomain()).toBe("http://localhost:3000");
   });
});
