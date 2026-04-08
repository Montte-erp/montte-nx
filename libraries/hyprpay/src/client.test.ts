import { describe, expect, it, vi } from "vitest";
import { createHyprPayClient } from "./client";
import { HyprPayError } from "./errors";

const mockCustomer = {
   id: "c1",
   teamId: "t1",
   name: "Acme Corp",
   email: "acme@example.com",
   phone: null,
   document: null,
   externalId: "ext-1",
   createdAt: "2024-01-01T00:00:00.000Z",
   updatedAt: "2024-01-01T00:00:00.000Z",
};

vi.mock("@orpc/client", () => ({
   createORPCClient: vi.fn(() => mockOrpc),
}));

vi.mock("@orpc/client/fetch", () => ({
   RPCLink: vi.fn(),
}));

const mockOrpc = {
   create: vi.fn(),
   get: vi.fn(),
   list: vi.fn(),
   update: vi.fn(),
};

function makeClient() {
   return createHyprPayClient({ apiKey: "test-key" });
}

describe("createHyprPayClient", () => {
   describe("customers.create", () => {
      it("returns Ok with customer on success", async () => {
         mockOrpc.create.mockResolvedValueOnce(mockCustomer);
         const result = await makeClient().customers.create({
            name: "Acme Corp",
         });
         expect(result.isOk()).toBe(true);
         expect(result._unsafeUnwrap()).toEqual(mockCustomer);
      });

      it("returns Err with HyprPayError on 404", async () => {
         mockOrpc.create.mockRejectedValueOnce({
            status: 404,
            message: "not found",
         });
         const result = await makeClient().customers.create({
            name: "Acme Corp",
         });
         expect(result.isErr()).toBe(true);
         const err = result._unsafeUnwrapErr();
         expect(err).toBeInstanceOf(HyprPayError);
         expect(err.code).toBe("NOT_FOUND");
      });

      it("wraps network errors", async () => {
         mockOrpc.create.mockRejectedValueOnce(new Error("fetch failed"));
         const result = await makeClient().customers.create({
            name: "Acme Corp",
         });
         expect(result.isErr()).toBe(true);
         expect(result._unsafeUnwrapErr().code).toBe("NETWORK_ERROR");
      });

      it("wraps timeout errors", async () => {
         mockOrpc.create.mockRejectedValueOnce(new Error("Request timeout"));
         const result = await makeClient().customers.create({
            name: "Acme Corp",
         });
         expect(result.isErr()).toBe(true);
         expect(result._unsafeUnwrapErr().code).toBe("TIMEOUT");
      });

      it("passes through HyprPayError unchanged", async () => {
         const original = HyprPayError.forbidden("no access");
         mockOrpc.create.mockRejectedValueOnce(original);
         const result = await makeClient().customers.create({
            name: "Acme Corp",
         });
         expect(result._unsafeUnwrapErr()).toBe(original);
      });
   });

   describe("customers.get", () => {
      it("returns Ok with customer on success", async () => {
         mockOrpc.get.mockResolvedValueOnce(mockCustomer);
         const result = await makeClient().customers.get("ext-1");
         expect(result.isOk()).toBe(true);
         expect(result._unsafeUnwrap()).toEqual(mockCustomer);
      });

      it("passes externalId to orpc.get", async () => {
         mockOrpc.get.mockResolvedValueOnce(mockCustomer);
         await makeClient().customers.get("my-id");
         expect(mockOrpc.get).toHaveBeenCalledWith({ externalId: "my-id" });
      });

      it("returns Err on failure", async () => {
         mockOrpc.get.mockRejectedValueOnce({ status: 404 });
         const result = await makeClient().customers.get("ext-1");
         expect(result.isErr()).toBe(true);
         expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
      });
   });

   describe("customers.list", () => {
      const mockList = {
         items: [mockCustomer],
         total: 1,
         page: 1,
         limit: 20,
         pages: 1,
      };

      it("returns Ok with list on success", async () => {
         mockOrpc.list.mockResolvedValueOnce(mockList);
         const result = await makeClient().customers.list();
         expect(result.isOk()).toBe(true);
         expect(result._unsafeUnwrap()).toEqual(mockList);
      });

      it("uses defaults page=1, limit=20 when called with no args", async () => {
         mockOrpc.list.mockResolvedValueOnce(mockList);
         await makeClient().customers.list();
         expect(mockOrpc.list).toHaveBeenCalledWith({ page: 1, limit: 20 });
      });

      it("passes provided pagination to orpc.list", async () => {
         mockOrpc.list.mockResolvedValueOnce(mockList);
         await makeClient().customers.list({ page: 3, limit: 50 });
         expect(mockOrpc.list).toHaveBeenCalledWith({ page: 3, limit: 50 });
      });
   });

   describe("customers.update", () => {
      it("returns Ok with updated customer on success", async () => {
         const updated = { ...mockCustomer, name: "Updated" };
         mockOrpc.update.mockResolvedValueOnce(updated);
         const result = await makeClient().customers.update("ext-1", {
            name: "Updated",
         });
         expect(result.isOk()).toBe(true);
         expect(result._unsafeUnwrap().name).toBe("Updated");
      });

      it("passes externalId and data to orpc.update", async () => {
         mockOrpc.update.mockResolvedValueOnce(mockCustomer);
         await makeClient().customers.update("ext-1", {
            name: "New",
            phone: null,
         });
         expect(mockOrpc.update).toHaveBeenCalledWith({
            externalId: "ext-1",
            name: "New",
            phone: null,
         });
      });
   });
});
