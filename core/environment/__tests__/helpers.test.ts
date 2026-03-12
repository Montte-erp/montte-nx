import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalAppUrl = process.env.APP_URL;
const originalNodeEnv = process.env.NODE_ENV;

describe("environment helpers", () => {
   beforeEach(() => {
      vi.resetModules();
   });

   afterEach(() => {
      if (originalAppUrl === undefined) {
         delete process.env.APP_URL;
      } else {
         process.env.APP_URL = originalAppUrl;
      }

      if (originalNodeEnv === undefined) {
         delete process.env.NODE_ENV;
      } else {
         process.env.NODE_ENV = originalNodeEnv;
      }
   });

   it("prefers APP_URL when it is set", async () => {
      process.env.APP_URL = "https://custom.example.com";
      process.env.NODE_ENV = "development";

      const { getDomain } = await import("../src/helpers");

      expect(getDomain()).toBe("https://custom.example.com");
   });

   it("falls back to the production domain in production", async () => {
      delete process.env.APP_URL;
      process.env.NODE_ENV = "production";

      const { getDomain, isProduction } = await import("../src/helpers");

      expect(isProduction).toBe(true);
      expect(getDomain()).toBe("https://app.montte.co");
   });

   it("falls back to localhost outside production", async () => {
      delete process.env.APP_URL;
      process.env.NODE_ENV = "development";

      const { getDomain, isProduction } = await import("../src/helpers");

      expect(isProduction).toBe(false);
      expect(getDomain()).toBe("http://localhost:3000");
   });
});
