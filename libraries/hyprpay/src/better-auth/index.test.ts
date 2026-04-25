import { describe, expect, it, vi, beforeEach } from "vitest";
import { err, ok } from "neverthrow";
import { HyprPayError } from "../errors";

const mockCreate = vi.fn();

function makeClient() {
   return {
      customers: { create: mockCreate },
   } as unknown as Parameters<
      (typeof import("./index"))["hyprpay"]
   >[0]["client"];
}

async function importPlugin() {
   const mod = await import("./index");
   return mod;
}

const mockUser = {
   id: "u1",
   name: "Alice",
   email: "alice@example.com",
   createdAt: new Date(),
   updatedAt: new Date(),
   emailVerified: false,
   image: null,
};

function getAfterHook(
   options: Parameters<(typeof import("./index"))["hyprpay"]>[0],
) {
   return importPlugin().then(({ hyprpay }) => {
      const plugin = hyprpay(options);
      const after = plugin.init?.({} as never)?.options?.databaseHooks?.user
         ?.create?.after;
      if (!after) throw new Error("after hook not found");
      return after;
   });
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
      const plugin = hyprpay({ client: makeClient() });
      expect(plugin.id).toBe("hyprpay");
   });

   describe("databaseHooks.user.create.after", () => {
      it("does nothing when createCustomerOnSignUp is false", async () => {
         const after = await getAfterHook({
            client: makeClient(),
            createCustomerOnSignUp: false,
         });
         await after(mockUser, null);
         expect(mockCreate).not.toHaveBeenCalled();
      });

      it("calls sdkClient.customers.create with default mapper", async () => {
         mockCreate.mockResolvedValueOnce(ok({ id: "c1" }));
         const after = await getAfterHook({
            client: makeClient(),
            createCustomerOnSignUp: true,
         });
         await after(mockUser, null);
         expect(mockCreate).toHaveBeenCalledWith({
            name: "Alice",
            email: "alice@example.com",
            externalId: "u1",
         });
      });

      it("uses custom customerData mapper when provided", async () => {
         mockCreate.mockResolvedValueOnce(ok({ id: "c1" }));
         const after = await getAfterHook({
            client: makeClient(),
            createCustomerOnSignUp: true,
            customerData: (u) => ({
               name: `CUSTOM-${u.name}`,
               externalId: u.id,
            }),
         });
         await after(mockUser, null);
         expect(mockCreate).toHaveBeenCalledWith({
            name: "CUSTOM-Alice",
            externalId: "u1",
         });
      });

      it("calls onCustomerCreate with the created customer", async () => {
         const customer = { id: "c1", name: "Alice" };
         mockCreate.mockResolvedValueOnce(ok(customer));
         const onCustomerCreate = vi.fn().mockResolvedValue(undefined);
         const after = await getAfterHook({
            client: makeClient(),
            createCustomerOnSignUp: true,
            onCustomerCreate,
         });
         await after(mockUser, null);
         expect(onCustomerCreate).toHaveBeenCalledWith(customer, mockUser);
      });

      it("logs error and does not throw when create fails", async () => {
         const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
         mockCreate.mockResolvedValueOnce(err(HyprPayError.internal("fail")));
         const after = await getAfterHook({
            client: makeClient(),
            createCustomerOnSignUp: true,
         });
         await expect(after(mockUser, null)).resolves.toBeUndefined();
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
         const after = await getAfterHook({
            client: makeClient(),
            createCustomerOnSignUp: true,
            onCustomerCreate,
         });
         await expect(after(mockUser, null)).resolves.toBeUndefined();
         expect(consoleError).toHaveBeenCalledWith(
            "[hyprpay] onCustomerCreate threw",
            expect.any(Error),
         );
         consoleError.mockRestore();
      });
   });

   describe("hyprpayClient", () => {
      it("returns client plugin with id 'hyprpay'", async () => {
         const { hyprpayClient } = await importPlugin();
         const client = hyprpayClient();
         expect(client.id).toBe("hyprpay");
         expect(client.$InferServerPlugin).toBeDefined();
      });
   });
});
