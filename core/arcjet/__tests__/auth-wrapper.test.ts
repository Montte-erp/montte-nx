import { describe, expect, it, vi } from "vitest";

const { authHandlerMock } = vi.hoisted(() => ({
   authHandlerMock: vi.fn(),
}));

vi.mock("@core/authentication/server", () => ({
   auth: {
      handler: authHandlerMock,
   },
}));

import { wrapAuthHandler } from "../src/auth-wrapper";

describe("wrapAuthHandler", () => {
   it("returns a handler that delegates to auth.handler", async () => {
      const request = new Request("https://example.com/api/auth");
      const response = new Response("ok", { status: 201 });

      authHandlerMock.mockResolvedValueOnce(response);

      const handler = await wrapAuthHandler();
      const result = await handler(request);

      expect(authHandlerMock).toHaveBeenCalledWith(request);
      expect(result).toBe(response);
   });
});
