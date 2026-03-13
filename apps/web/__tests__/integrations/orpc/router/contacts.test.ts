import { call } from "@orpc/server";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } =
      await import("../../../helpers/setup-integration-test");
   return { db: await setupIntegrationDb(), createDb: () => {} };
});
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
   posthog: {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   },
}));

import { transactions } from "@core/database/schemas/transactions";
import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as contactsRouter from "@/integrations/orpc/router/contacts";

let ctx: ORPCContextWithAuth;
let ctx2: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
   ctx2 = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.execute(sql`DELETE FROM transactions`);
   await ctx.db.execute(sql`DELETE FROM bills`);
   await ctx.db.execute(sql`DELETE FROM contacts`);
});

describe("create", () => {
   it("creates a contact and persists it", async () => {
      const result = await call(
         contactsRouter.create,
         { name: "João Silva", type: "cliente", email: "joao@example.com" },
         { context: ctx },
      );

      expect(result.name).toBe("João Silva");
      expect(result.type).toBe("cliente");
      expect(result.email).toBe("joao@example.com");
      expect(result.isArchived).toBe(false);

      const rows = await ctx.db.query.contacts.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(result.id);
   });

   it("creates a contact with minimal fields", async () => {
      const result = await call(
         contactsRouter.create,
         { name: "Fornecedor X", type: "fornecedor" },
         { context: ctx },
      );

      expect(result.name).toBe("Fornecedor X");
      expect(result.type).toBe("fornecedor");
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
   });
});

describe("getAll", () => {
   it("lists all contacts for the team", async () => {
      await call(
         contactsRouter.create,
         { name: "Cliente A", type: "cliente" },
         { context: ctx },
      );
      await call(
         contactsRouter.create,
         { name: "Fornecedor B", type: "fornecedor" },
         { context: ctx },
      );

      const result = await call(contactsRouter.getAll, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(2);
   });

   it("filters contacts by type", async () => {
      await call(
         contactsRouter.create,
         { name: "Cliente A", type: "cliente" },
         { context: ctx },
      );
      await call(
         contactsRouter.create,
         { name: "Fornecedor B", type: "fornecedor" },
         { context: ctx },
      );

      const result = await call(
         contactsRouter.getAll,
         { type: "cliente" },
         { context: ctx },
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("cliente");
   });

   it("does not list contacts from another team", async () => {
      await call(
         contactsRouter.create,
         { name: "Private Contact", type: "cliente" },
         { context: ctx },
      );

      const result = await call(contactsRouter.getAll, undefined, {
         context: ctx2,
      });

      expect(result).toHaveLength(0);
   });
});

describe("update", () => {
   it("updates contact after ownership check", async () => {
      const created = await call(
         contactsRouter.create,
         { name: "João Silva", type: "cliente" },
         { context: ctx },
      );

      const updated = await call(
         contactsRouter.update,
         { id: created.id, name: "João Santos" },
         { context: ctx },
      );

      expect(updated.name).toBe("João Santos");

      const fromDb = await ctx.db.query.contacts.findFirst({
         where: { id: created.id },
      });
      expect(fromDb!.name).toBe("João Santos");
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         contactsRouter.create,
         { name: "Private", type: "cliente" },
         { context: ctx },
      );

      await expect(
         call(
            contactsRouter.update,
            { id: created.id, name: "Hacked" },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Contato não encontrado.");
   });
});

describe("remove", () => {
   it("deletes contact with no links", async () => {
      const created = await call(
         contactsRouter.create,
         { name: "Deletar", type: "fornecedor" },
         { context: ctx },
      );

      const result = await call(
         contactsRouter.remove,
         { id: created.id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const rows = await ctx.db.query.contacts.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects deletion when contact has linked transactions", async () => {
      const created = await call(
         contactsRouter.create,
         { name: "Com Lançamentos", type: "cliente" },
         { context: ctx },
      );

      const teamId = ctx.session!.session.activeTeamId!;
      await ctx.db.insert(transactions).values({
         teamId,
         type: "income",
         amount: "50.00",
         date: "2025-01-15",
         contactId: created.id,
      });

      await expect(
         call(contactsRouter.remove, { id: created.id }, { context: ctx }),
      ).rejects.toThrow("Contato possui lançamentos vinculados");
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         contactsRouter.create,
         { name: "Private", type: "cliente" },
         { context: ctx },
      );

      await expect(
         call(contactsRouter.remove, { id: created.id }, { context: ctx2 }),
      ).rejects.toThrow("Contato não encontrado.");
   });
});
