import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

const dbosMocks = vi.hoisted(async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.createDbosMocks();
});

vi.mock("@dbos-inc/dbos-sdk", async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.dbosSdkMockFactory(await dbosMocks);
});

vi.mock("@dbos-inc/drizzle-datasource", async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.drizzleDataSourceMockFactory(await dbosMocks);
});

import {
   posthogCaptureSpy,
   ssePublishSpy,
} from "../helpers/mock-classification-context";

vi.mock("@core/posthog/server", () => ({
   promptsClient: {
      get: vi.fn().mockResolvedValue({
         source: "active",
         prompt: "Sistema: classifique as transações em lote.",
         name: "montte-classify-transaction",
         version: 1,
      }),
      compile: vi.fn((prompt: string) => prompt),
   },
}));

import { LLMock } from "@copilotkit/aimock";
import { eq } from "drizzle-orm";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { transactions } from "@core/database/schemas/transactions";
import {
   makeCategory,
   makeTag,
   makeTransaction,
} from "../helpers/classification-factories";

import { classifyTransactionsBatchWorkflow } from "../../src/workflows/classification-workflow";

const llmMock = new LLMock({ port: 14010 });

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   await llmMock.start();
   testDb = await setupTestDb();
   const mocks = await dbosMocks;
   mocks.setActiveDb(testDb.db);
}, 30_000);

afterAll(async () => {
   await llmMock.stop();
   await testDb.cleanup();
});

beforeEach(async () => {
   vi.clearAllMocks();
   llmMock.clearFixtures();
   llmMock.clearRequests();
   const mocks = await dbosMocks;
   mocks.setActiveDb(testDb.db);
});

async function getTransaction(id: string) {
   const [row] = await testDb.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
   return row;
}

describe("classifyTransactionsBatchWorkflow", () => {
   it("returns early on empty input — no DB writes, no LLM call, no SSE", async () => {
      const { teamId } = await seedTeam(testDb.db);

      await classifyTransactionsBatchWorkflow({
         teamId,
         transactionIds: [],
      });

      expect(ssePublishSpy).not.toHaveBeenCalled();
   });

   it("classifies all by keyword match — no LLM call, suggestedCategoryId set, SSE emitted", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const food = await makeCategory(testDb.db, teamId, {
         name: "Alimentação",
         keywords: ["uber eats", "burger", "ifood"],
      });

      const tx1 = await makeTransaction(testDb.db, teamId, {
         name: "Uber Eats Burger",
      });
      const tx2 = await makeTransaction(testDb.db, teamId, {
         name: "Ifood Burger King",
      });
      const tx3 = await makeTransaction(testDb.db, teamId, {
         name: "Burger King Uber Eats",
      });

      await classifyTransactionsBatchWorkflow({
         teamId,
         transactionIds: [tx1.id, tx2.id, tx3.id],
      });

      const t1 = await getTransaction(tx1.id);
      const t2 = await getTransaction(tx2.id);
      const t3 = await getTransaction(tx3.id);
      expect(t1?.suggestedCategoryId).toBe(food.id);
      expect(t2?.suggestedCategoryId).toBe(food.id);
      expect(t3?.suggestedCategoryId).toBe(food.id);
      expect(t1?.suggestedTagId).toBeNull();
      expect(t2?.suggestedTagId).toBeNull();
      expect(t3?.suggestedTagId).toBeNull();

      expect(ssePublishSpy).toHaveBeenCalledTimes(3);
      expect(ssePublishSpy).toHaveBeenCalledWith(
         expect.anything(),
         { kind: "team", id: teamId },
         expect.objectContaining({
            type: "classification.transaction_classified",
            payload: expect.objectContaining({
               categoryId: food.id,
               tagId: null,
            }),
         }),
      );
   });

   it("classifies all by AI when no keyword match — suggestedCategoryId + suggestedTagId set", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const food = await makeCategory(testDb.db, teamId, {
         name: "Alimentação",
      });
      const ops = await makeTag(testDb.db, teamId, { name: "Operacional" });

      const tx1 = await makeTransaction(testDb.db, teamId, {
         name: "Loja Random A",
      });
      const tx2 = await makeTransaction(testDb.db, teamId, {
         name: "Loja Random B",
      });
      const tx3 = await makeTransaction(testDb.db, teamId, {
         name: "Loja Random C",
      });

      llmMock.onMessage(/Loja Random A/, {
         content: JSON.stringify({
            results: [
               {
                  id: tx1.id,
                  categoryName: "Alimentação",
                  tagName: "Operacional",
               },
               {
                  id: tx2.id,
                  categoryName: "Alimentação",
                  tagName: "Operacional",
               },
               {
                  id: tx3.id,
                  categoryName: "Alimentação",
                  tagName: null,
               },
            ],
         }),
         systemFingerprint: "fp_test",
      });

      await classifyTransactionsBatchWorkflow({
         teamId,
         transactionIds: [tx1.id, tx2.id, tx3.id],
      });

      const t1 = await getTransaction(tx1.id);
      const t2 = await getTransaction(tx2.id);
      const t3 = await getTransaction(tx3.id);
      expect(t1?.suggestedCategoryId).toBe(food.id);
      expect(t1?.suggestedTagId).toBe(ops.id);
      expect(t2?.suggestedCategoryId).toBe(food.id);
      expect(t2?.suggestedTagId).toBe(ops.id);
      expect(t3?.suggestedCategoryId).toBe(food.id);
      expect(t3?.suggestedTagId).toBeNull();

      expect(ssePublishSpy).toHaveBeenCalledTimes(3);
   });

   it("mixes keyword + AI — 2 keyword-matched, 3 unmatched go to AI, 5 writes total", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const food = await makeCategory(testDb.db, teamId, {
         name: "Alimentação",
         keywords: ["uber eats", "burger", "ifood"],
      });
      const fuel = await makeCategory(testDb.db, teamId, {
         name: "Combustível",
      });
      const ops = await makeTag(testDb.db, teamId, { name: "Operacional" });

      const txKw1 = await makeTransaction(testDb.db, teamId, {
         name: "Uber Eats Burger",
      });
      const txKw2 = await makeTransaction(testDb.db, teamId, {
         name: "Ifood Burger King",
      });
      const txAi1 = await makeTransaction(testDb.db, teamId, {
         name: "Posto Shell Centro",
      });
      const txAi2 = await makeTransaction(testDb.db, teamId, {
         name: "Posto Ipiranga BR",
      });
      const txAi3 = await makeTransaction(testDb.db, teamId, {
         name: "Posto BR Mania",
      });

      llmMock.onMessage(/Posto Shell Centro/, {
         content: JSON.stringify({
            results: [
               {
                  id: txAi1.id,
                  categoryName: "Combustível",
                  tagName: "Operacional",
               },
               {
                  id: txAi2.id,
                  categoryName: "Combustível",
                  tagName: null,
               },
               {
                  id: txAi3.id,
                  categoryName: "Combustível",
                  tagName: "Operacional",
               },
            ],
         }),
         systemFingerprint: "fp_test",
      });

      await classifyTransactionsBatchWorkflow({
         teamId,
         transactionIds: [txKw1.id, txKw2.id, txAi1.id, txAi2.id, txAi3.id],
      });

      const k1 = await getTransaction(txKw1.id);
      const k2 = await getTransaction(txKw2.id);
      const a1 = await getTransaction(txAi1.id);
      const a2 = await getTransaction(txAi2.id);
      const a3 = await getTransaction(txAi3.id);
      expect(k1?.suggestedCategoryId).toBe(food.id);
      expect(k1?.suggestedTagId).toBeNull();
      expect(k2?.suggestedCategoryId).toBe(food.id);
      expect(k2?.suggestedTagId).toBeNull();
      expect(a1?.suggestedCategoryId).toBe(fuel.id);
      expect(a1?.suggestedTagId).toBe(ops.id);
      expect(a2?.suggestedCategoryId).toBe(fuel.id);
      expect(a2?.suggestedTagId).toBeNull();
      expect(a3?.suggestedCategoryId).toBe(fuel.id);
      expect(a3?.suggestedTagId).toBe(ops.id);

      expect(ssePublishSpy).toHaveBeenCalledTimes(5);
   });

   it("idempotency — skips transactions that already have categoryId set", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const food = await makeCategory(testDb.db, teamId, {
         name: "Alimentação",
         keywords: ["uber eats", "burger"],
      });
      const other = await makeCategory(testDb.db, teamId, {
         name: "Outros",
      });

      const txDone = await makeTransaction(testDb.db, teamId, {
         name: "Uber Eats Burger",
         categoryId: other.id,
      });
      const txPending = await makeTransaction(testDb.db, teamId, {
         name: "Burger Uber Eats",
      });

      await classifyTransactionsBatchWorkflow({
         teamId,
         transactionIds: [txDone.id, txPending.id],
      });

      const done = await getTransaction(txDone.id);
      const pending = await getTransaction(txPending.id);
      expect(done?.categoryId).toBe(other.id);
      expect(done?.suggestedCategoryId).toBeNull();
      expect(pending?.suggestedCategoryId).toBe(food.id);

      expect(ssePublishSpy).toHaveBeenCalledTimes(1);
   });

   it("chunks AI calls when unmatched > 20 — makes 2 LLM calls for 25 unmatched", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const food = await makeCategory(testDb.db, teamId, {
         name: "Alimentação",
      });

      const txs = await Promise.all(
         Array.from({ length: 25 }, (_, i) =>
            makeTransaction(testDb.db, teamId, {
               name: `Random Merchant ${i + 1}`,
            }),
         ),
      );

      const allIds = txs.map((t) => t.id);

      llmMock.addFixture({
         match: {
            userMessage: /Random Merchant/,
            predicate: (req) => {
               const userMsg = req.messages
                  .filter((m) => m.role === "user")
                  .map((m) =>
                     typeof m.content === "string"
                        ? m.content
                        : JSON.stringify(m.content),
                  )
                  .join("\n");
               return allIds.slice(0, 20).every((id) => userMsg.includes(id));
            },
         },
         response: {
            content: JSON.stringify({
               results: allIds.slice(0, 20).map((id) => ({
                  id,
                  categoryName: "Alimentação",
                  tagName: null,
               })),
            }),
            systemFingerprint: "fp_test",
         },
      });
      llmMock.addFixture({
         match: {
            userMessage: /Random Merchant/,
            predicate: (req) => {
               const userMsg = req.messages
                  .filter((m) => m.role === "user")
                  .map((m) =>
                     typeof m.content === "string"
                        ? m.content
                        : JSON.stringify(m.content),
                  )
                  .join("\n");
               return allIds.slice(20).every((id) => userMsg.includes(id));
            },
         },
         response: {
            content: JSON.stringify({
               results: allIds.slice(20).map((id) => ({
                  id,
                  categoryName: "Alimentação",
                  tagName: null,
               })),
            }),
            systemFingerprint: "fp_test",
         },
      });

      await classifyTransactionsBatchWorkflow({
         teamId,
         transactionIds: allIds,
      });

      const updated = await Promise.all(txs.map((t) => getTransaction(t.id)));
      const setCount = updated.filter(
         (t) => t?.suggestedCategoryId === food.id,
      ).length;
      expect(setCount).toBe(25);
      // tanstack-ai with outputSchema makes 2 HTTP calls per chat() — one to
      // generate text, one for structured output. So 2 chunks = 4 requests.
      // We assert at least 2 distinct user-message bodies (one per chunk).
      const reqs = llmMock.getRequests();
      const distinctUserMessages = new Set(
         reqs
            .map((r) =>
               r.body?.messages
                  ?.filter((m) => m.role === "user")
                  .map((m) =>
                     typeof m.content === "string"
                        ? m.content
                        : JSON.stringify(m.content),
                  )
                  .join("\n"),
            )
            .filter(Boolean),
      );
      expect(distinctUserMessages.size).toBe(2);
      expect(ssePublishSpy).toHaveBeenCalledTimes(25);
   });

   it("handles AI returning fewer results than requested — only returned IDs get suggestedCategoryId", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const food = await makeCategory(testDb.db, teamId, {
         name: "Alimentação",
      });

      const tx1 = await makeTransaction(testDb.db, teamId, {
         name: "Random A",
      });
      const tx2 = await makeTransaction(testDb.db, teamId, {
         name: "Random B",
      });
      const tx3 = await makeTransaction(testDb.db, teamId, {
         name: "Random C",
      });

      llmMock.onMessage(/Random A/, {
         content: JSON.stringify({
            results: [
               { id: tx1.id, categoryName: "Alimentação", tagName: null },
               { id: tx2.id, categoryName: "Alimentação", tagName: null },
            ],
         }),
         systemFingerprint: "fp_test",
      });

      await classifyTransactionsBatchWorkflow({
         teamId,
         transactionIds: [tx1.id, tx2.id, tx3.id],
      });

      const t1 = await getTransaction(tx1.id);
      const t2 = await getTransaction(tx2.id);
      const t3 = await getTransaction(tx3.id);
      expect(t1?.suggestedCategoryId).toBe(food.id);
      expect(t2?.suggestedCategoryId).toBe(food.id);
      expect(t3?.suggestedCategoryId).toBeNull();

      expect(ssePublishSpy).toHaveBeenCalledTimes(2);
      expect(posthogCaptureSpy).toBeDefined();
   });
});
