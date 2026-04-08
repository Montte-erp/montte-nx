import { describe, expect, it, vi, beforeEach } from "vitest";
import { err, ok } from "neverthrow";
import { HyprPayError } from "../errors";

const mockCreate = vi.fn();

vi.mock("../client", () => ({
   createHyprPayClient: vi.fn(() => ({
      customers: { create: mockCreate },
   })),
}));

async function importPlugin() {
   const mod = await import("./index");
   return mod;
}

const mockUser = { id: "u1", name: "Alice", email: "alice@example.com" };

function buildContext(body: unknown = {}) {
   return {
      path: "/sign-up/email",
      body,
   };
}

describe("hyprpay better-auth plugin", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("exports hyprpay and hyprpayClient", async () => {
      const { hyprpay, hyprpayClient } = await importPlugin();
      expect(typeof hyprpay).toBe("function");
      expect(typeof hyprpayClient).toBe("function");
   });

   it("returns plugin with id 'hyprpay'", async () => {
      const { hyprpay } = await importPlugin();
      const plugin = hyprpay({ apiKey: "key" });
      expect(plugin.id).toBe("hyprpay");
   });

   describe("sign-up hook", () => {
      async function runHook(
         options: Parameters<(typeof import("./index"))["hyprpay"]>[0],
         context: { path: string; body: unknown },
      ) {
         const { hyprpay } = await importPlugin();
         const plugin = hyprpay(options);
         const handler = plugin.hooks?.after?.[0]?.handler;
         if (!handler) throw new Error("handler not found");
         await handler(context as never);
      }

      it("does nothing when createCustomerOnSignUp is false", async () => {
         await runHook(
            { apiKey: "key", createCustomerOnSignUp: false },
            buildContext({ user: mockUser }),
         );
         expect(mockCreate).not.toHaveBeenCalled();
      });

      it("does nothing when user is missing from body", async () => {
         await runHook(
            { apiKey: "key", createCustomerOnSignUp: true },
            buildContext({}),
         );
         expect(mockCreate).not.toHaveBeenCalled();
      });

      it("does nothing when user.id is missing", async () => {
         await runHook(
            { apiKey: "key", createCustomerOnSignUp: true },
            buildContext({ user: { name: "Alice", email: "a@b.com" } }),
         );
         expect(mockCreate).not.toHaveBeenCalled();
      });

      it("calls sdkClient.customers.create with default mapper", async () => {
         mockCreate.mockResolvedValueOnce(ok({ id: "c1" }));
         await runHook(
            { apiKey: "key", createCustomerOnSignUp: true },
            buildContext({ user: mockUser }),
         );
         expect(mockCreate).toHaveBeenCalledWith({
            name: "Alice",
            email: "alice@example.com",
            externalId: "u1",
         });
      });

      it("uses custom customerData mapper when provided", async () => {
         mockCreate.mockResolvedValueOnce(ok({ id: "c1" }));
         await runHook(
            {
               apiKey: "key",
               createCustomerOnSignUp: true,
               customerData: (u) => ({
                  name: `CUSTOM-${u.name}`,
                  externalId: u.id,
               }),
            },
            buildContext({ user: mockUser }),
         );
         expect(mockCreate).toHaveBeenCalledWith({
            name: "CUSTOM-Alice",
            externalId: "u1",
         });
      });

      it("calls onCustomerCreate with the created customer", async () => {
         const customer = { id: "c1", name: "Alice" };
         mockCreate.mockResolvedValueOnce(ok(customer));
         const onCustomerCreate = vi.fn().mockResolvedValue(undefined);
         await runHook(
            { apiKey: "key", createCustomerOnSignUp: true, onCustomerCreate },
            buildContext({ user: mockUser }),
         );
         expect(onCustomerCreate).toHaveBeenCalledWith(customer, mockUser);
      });

      it("logs error and does not throw when create fails", async () => {
         const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
         mockCreate.mockResolvedValueOnce(err(HyprPayError.internal("fail")));
         await expect(
            runHook(
               { apiKey: "key", createCustomerOnSignUp: true },
               buildContext({ user: mockUser }),
            ),
         ).resolves.toBeUndefined();
         expect(consoleError).toHaveBeenCalledWith(
            "[hyprpay] customer creation failed",
            expect.any(HyprPayError),
         );
         consoleError.mockRestore();
      });

      it("logs error and does not throw when onCustomerCreate throws", async () => {
         const customer = { id: "c1" };
         mockCreate.mockResolvedValueOnce(ok(customer));
         const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
         const onCustomerCreate = vi
            .fn()
            .mockRejectedValue(new Error("callback boom"));
         await expect(
            runHook(
               {
                  apiKey: "key",
                  createCustomerOnSignUp: true,
                  onCustomerCreate,
               },
               buildContext({ user: mockUser }),
            ),
         ).resolves.toBeUndefined();
         expect(consoleError).toHaveBeenCalledWith(
            "[hyprpay] onCustomerCreate threw",
            expect.any(Error),
         );
         consoleError.mockRestore();
      });

      it.each(["/sign-up/email", "/sign-up/email-otp", "/sign-in/magic-link"])(
         "matcher returns true for %s",
         async (path) => {
            const { hyprpay } = await importPlugin();
            const plugin = hyprpay({ apiKey: "key" });
            const matcher = plugin.hooks?.after?.[0]?.matcher;
            expect(matcher?.({ path } as never)).toBe(true);
         },
      );

      it("matcher returns false for other paths", async () => {
         const { hyprpay } = await importPlugin();
         const plugin = hyprpay({ apiKey: "key" });
         const matcher = plugin.hooks?.after?.[0]?.matcher;
         expect(matcher?.({ path: "/sign-in/email" } as never)).toBe(false);
      });
   });

   describe("hyprpayClient", () => {
      it("returns client plugin with id 'hyprpay'", async () => {
         const { hyprpayClient, hyprpay } = await importPlugin();
         const client = hyprpayClient();
         expect(client.id).toBe("hyprpay");
         expect(client.$InferServerPlugin).toBeDefined();
      });
   });
});
