import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam, seedUser } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import {
   contractDocuments,
   contractExtractions,
   contracts,
} from "@core/database/schemas/contracts";

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import * as contractsRouter from "../src/router";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

async function createContext() {
   const { teamId, organizationId } = await seedTeam(testDb.db);
   const userId = await seedUser(testDb.db);
   const ctx = createTestContext(testDb.db, {
      teamId,
      organizationId,
      userId,
   });

   return { ctx, organizationId, teamId, userId };
}

async function insertDocument(input: {
   organizationId: string;
   teamId: string;
   name: string;
   status?: "uploaded" | "processing" | "needs_review" | "approved" | "failed";
}) {
   const [document] = await testDb.db
      .insert(contractDocuments)
      .values({
         organizationId: input.organizationId,
         teamId: input.teamId,
         fileKey: `contract-documents/${crypto.randomUUID()}.pdf`,
         originalFileName: input.name,
         mimeType: "application/pdf",
         fileSize: 1024,
         ingestionStatus: input.status ?? "uploaded",
      })
      .returning();

   expect(document).toBeDefined();
   return document;
}

describe("contracts router", () => {
   it("lista documentos com ownership, filtros, busca e ordenação", async () => {
      const owner = await createContext();
      const other = await createContext();

      await insertDocument({
         organizationId: owner.organizationId,
         teamId: owner.teamId,
         name: "zeta contrato.pdf",
         status: "uploaded",
      });
      await insertDocument({
         organizationId: owner.organizationId,
         teamId: owner.teamId,
         name: "alpha contrato.pdf",
         status: "needs_review",
      });
      await insertDocument({
         organizationId: other.organizationId,
         teamId: other.teamId,
         name: "alpha contrato outro time.pdf",
         status: "needs_review",
      });

      const result = await call(
         contractsRouter.listDocuments,
         {
            page: 1,
            pageSize: 10,
            search: "contrato",
            status: "needs_review",
            sorting: [{ id: "originalFileName", desc: false }],
         },
         { context: owner.ctx },
      );

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.originalFileName).toBe("alpha contrato.pdf");
      expect(result.items[0]?.teamId).toBe(owner.teamId);
   });

   it("busca documento com extrações e contratos do mesmo time", async () => {
      const owner = await createContext();
      const document = await insertDocument({
         organizationId: owner.organizationId,
         teamId: owner.teamId,
         name: "contrato aprovado.pdf",
      });
      const [extraction] = await testDb.db
         .insert(contractExtractions)
         .values({
            documentId: document.id,
            model: "openrouter/test",
            promptVersion: "v1",
            status: "completed",
            confidence: "0.91",
            data: { document: { type: "service" } },
         })
         .returning();
      expect(extraction).toBeDefined();

      const [contract] = await testDb.db
         .insert(contracts)
         .values({
            organizationId: owner.organizationId,
            teamId: owner.teamId,
            documentId: document.id,
            approvedExtractionId: extraction?.id,
            title: "Contrato aprovado",
            type: "service",
            status: "active",
            counterpartyName: "Cliente Teste",
         })
         .returning();
      expect(contract).toBeDefined();

      const result = await call(
         contractsRouter.getDocument,
         { id: document.id },
         { context: owner.ctx },
      );

      expect(result.id).toBe(document.id);
      expect(result.extractions).toHaveLength(1);
      expect(result.contracts).toHaveLength(1);
      expect(result.contracts[0]?.id).toBe(contract?.id);
   });

   it("bloqueia leitura de documento de outro time", async () => {
      const owner = await createContext();
      const other = await createContext();
      const document = await insertDocument({
         organizationId: other.organizationId,
         teamId: other.teamId,
         name: "contrato outro time.pdf",
      });

      await expect(
         call(
            contractsRouter.getDocument,
            { id: document.id },
            { context: owner.ctx },
         ),
      ).rejects.toThrow("Documento de contrato não encontrado.");
   });

   it("lista contratos com ownership, filtros, busca e paginação", async () => {
      const owner = await createContext();
      const other = await createContext();

      await testDb.db.insert(contracts).values([
         {
            organizationId: owner.organizationId,
            teamId: owner.teamId,
            title: "Contrato B",
            type: "service",
            status: "active",
            counterpartyName: "Empresa B",
            signatureStatus: "signed",
            amount: "200.00",
         },
         {
            organizationId: owner.organizationId,
            teamId: owner.teamId,
            title: "Contrato A",
            type: "fiscal_address",
            status: "needs_review",
            counterpartyName: "Empresa A",
            signatureStatus: "unsigned",
            amount: "100.00",
         },
         {
            organizationId: other.organizationId,
            teamId: other.teamId,
            title: "Contrato A outro time",
            type: "fiscal_address",
            status: "needs_review",
            counterpartyName: "Empresa A",
            signatureStatus: "unsigned",
         },
      ]);

      const result = await call(
         contractsRouter.listContracts,
         {
            page: 1,
            pageSize: 1,
            search: "Empresa",
            status: "needs_review",
            type: "fiscal_address",
            signatureStatus: "unsigned",
            sorting: [{ id: "title", desc: false }],
         },
         { context: owner.ctx },
      );

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.title).toBe("Contrato A");
      expect(result.items[0]?.teamId).toBe(owner.teamId);
   });

   it("busca contrato aprovado com documento e extração", async () => {
      const owner = await createContext();
      const document = await insertDocument({
         organizationId: owner.organizationId,
         teamId: owner.teamId,
         name: "contrato com vinculos.pdf",
      });
      const [extraction] = await testDb.db
         .insert(contractExtractions)
         .values({
            documentId: document.id,
            model: "openrouter/test",
            promptVersion: "v1",
            status: "completed",
            data: { terms: { startsAt: "2026-01-01" } },
         })
         .returning();
      expect(extraction).toBeDefined();
      const [contract] = await testDb.db
         .insert(contracts)
         .values({
            organizationId: owner.organizationId,
            teamId: owner.teamId,
            documentId: document.id,
            approvedExtractionId: extraction?.id,
            title: "Contrato com vínculos",
            type: "service",
            status: "active",
            counterpartyName: "Cliente Teste",
         })
         .returning();
      expect(contract).toBeDefined();

      const result = await call(
         contractsRouter.getContract,
         { id: contract?.id ?? crypto.randomUUID() },
         { context: owner.ctx },
      );

      expect(result.id).toBe(contract?.id);
      expect(result.document?.id).toBe(document.id);
      expect(result.approvedExtraction?.id).toBe(extraction?.id);
   });

   it("bloqueia leitura de contrato de outro time", async () => {
      const owner = await createContext();
      const other = await createContext();
      const [contract] = await testDb.db
         .insert(contracts)
         .values({
            organizationId: other.organizationId,
            teamId: other.teamId,
            title: "Contrato outro time",
            type: "service",
            status: "active",
            counterpartyName: "Cliente Externo",
         })
         .returning();
      expect(contract).toBeDefined();

      await expect(
         call(
            contractsRouter.getContract,
            { id: contract?.id ?? crypto.randomUUID() },
            { context: owner.ctx },
         ),
      ).rejects.toThrow("Contrato não encontrado.");
   });

   it("busca extração somente quando o documento pertence ao time", async () => {
      const owner = await createContext();
      const other = await createContext();
      const ownerDocument = await insertDocument({
         organizationId: owner.organizationId,
         teamId: owner.teamId,
         name: "contrato owner.pdf",
      });
      const otherDocument = await insertDocument({
         organizationId: other.organizationId,
         teamId: other.teamId,
         name: "contrato outro.pdf",
      });
      const [ownerExtraction] = await testDb.db
         .insert(contractExtractions)
         .values({
            documentId: ownerDocument.id,
            model: "openrouter/test",
            promptVersion: "v1",
            status: "completed",
         })
         .returning();
      const [otherExtraction] = await testDb.db
         .insert(contractExtractions)
         .values({
            documentId: otherDocument.id,
            model: "openrouter/test",
            promptVersion: "v1",
            status: "completed",
         })
         .returning();
      expect(ownerExtraction).toBeDefined();
      expect(otherExtraction).toBeDefined();

      const result = await call(
         contractsRouter.getExtraction,
         { id: ownerExtraction?.id ?? crypto.randomUUID() },
         { context: owner.ctx },
      );
      expect(result.id).toBe(ownerExtraction?.id);

      await expect(
         call(
            contractsRouter.getExtraction,
            { id: otherExtraction?.id ?? crypto.randomUUID() },
            { context: owner.ctx },
         ),
      ).rejects.toThrow("Extração de contrato não encontrada.");
   });

   it("rejeita UUID inválido antes de consultar", async () => {
      const owner = await createContext();

      await expect(
         call(
            contractsRouter.getContract,
            { id: "contrato-invalido" },
            { context: owner.ctx },
         ),
      ).rejects.toThrow();
   });
});
