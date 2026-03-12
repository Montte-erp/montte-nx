import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/contacts-repository");
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
}));

import {
   createContact,
   deleteContact,
   ensureContactOwnership,
   listContacts,
   updateContact,
} from "@core/database/repositories/contacts-repository";
import { AppError } from "@core/logging/errors";
import * as contactsRouter from "@/integrations/orpc/router/contacts";

const CONTACT_ID = "a0000000-0000-4000-8000-000000000020";

const mockContact = {
   id: CONTACT_ID,
   teamId: TEST_TEAM_ID,
   name: "João Silva",
   type: "cliente" as const,
   email: "joao@example.com",
   phone: null,
   document: null,
   documentType: null,
   notes: null,
   source: "manual" as const,
   externalId: null,
   isArchived: false,
   createdAt: new Date(),
   updatedAt: new Date(),
};

beforeEach(() => {
   vi.clearAllMocks();
});

describe("create", () => {
   it("creates a contact", async () => {
      vi.mocked(createContact).mockResolvedValueOnce(mockContact);

      const result = await call(
         contactsRouter.create,
         { name: "João Silva", type: "cliente" },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockContact);
      expect(createContact).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ name: "João Silva" }),
      );
   });
});

describe("getAll", () => {
   it("lists contacts", async () => {
      vi.mocked(listContacts).mockResolvedValueOnce([mockContact]);

      const result = await call(contactsRouter.getAll, undefined, {
         context: createTestContext(),
      });

      expect(result).toEqual([mockContact]);
      expect(listContacts).toHaveBeenCalledWith(TEST_TEAM_ID, undefined);
   });
});

describe("update", () => {
   it("updates contact after ownership check", async () => {
      vi.mocked(ensureContactOwnership).mockResolvedValueOnce(mockContact);
      const updated = { ...mockContact, name: "João Santos" };
      vi.mocked(updateContact).mockResolvedValueOnce(updated);

      const result = await call(
         contactsRouter.update,
         { id: CONTACT_ID, name: "João Santos" },
         { context: createTestContext() },
      );

      expect(result.name).toBe("João Santos");
      expect(updateContact).toHaveBeenCalledWith(CONTACT_ID, {
         name: "João Santos",
      });
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureContactOwnership).mockRejectedValueOnce(
         AppError.notFound("Contato não encontrado."),
      );

      await expect(
         call(
            contactsRouter.update,
            { id: CONTACT_ID, name: "Teste" },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Contato não encontrado.");
   });
});

describe("remove", () => {
   it("deletes contact after ownership check", async () => {
      vi.mocked(ensureContactOwnership).mockResolvedValueOnce(mockContact);
      vi.mocked(deleteContact).mockResolvedValueOnce(undefined);

      const result = await call(
         contactsRouter.remove,
         { id: CONTACT_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual({ success: true });
      expect(deleteContact).toHaveBeenCalledWith(CONTACT_ID);
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureContactOwnership).mockRejectedValueOnce(
         AppError.notFound("Contato não encontrado."),
      );

      await expect(
         call(
            contactsRouter.remove,
            { id: CONTACT_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Contato não encontrado.");
   });
});
