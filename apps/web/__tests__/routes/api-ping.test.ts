import { describe, expect, it } from "vitest";

import { handleGet, handleHead } from "@/routes/api/ping";

describe("api ping route", () => {
   it("returns pong for GET requests", async () => {
      const response = await handleGet();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      await expect(response.json()).resolves.toEqual({
         pong: true,
         time: expect.any(String),
      });
   });

   it("returns success for HEAD requests without a body", async () => {
      const response = await handleHead();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      await expect(response.text()).resolves.toBe("");
   });
});
