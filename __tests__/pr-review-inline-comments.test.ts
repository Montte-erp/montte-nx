import { beforeAll, describe, expect, it } from "vitest";

type ReviewComment = {
   path: string;
   line: number;
   side: "RIGHT" | "LEFT";
   severity: "critical" | "major" | "minor" | "trivial" | "info";
   confidence: number;
   actionable: boolean;
   title: string;
   body: string;
};

type DiffReviewLines = Map<string, { left: Set<number>; right: Set<number> }>;

let parseDiffReviewLines: (patch: string) => DiffReviewLines;
let splitValidInlineComments: (
   comments: Array<ReviewComment>,
   patch: string,
) => {
   valid: Array<ReviewComment>;
   skipped: Array<ReviewComment & { reason: string }>;
};

beforeAll(async () => {
   const modulePath = "../.flue/agents/pr-review.ts";
   const reviewModule = await import(modulePath);
   parseDiffReviewLines = reviewModule.parseDiffReviewLines;
   splitValidInlineComments = reviewModule.splitValidInlineComments;
});

const patch = [
   "diff --git a/modules/relationships/src/router/index.ts b/modules/relationships/src/router/index.ts",
   "index 1111111..2222222 100644",
   "--- a/modules/relationships/src/router/index.ts",
   "+++ b/modules/relationships/src/router/index.ts",
   "@@ -452,6 +452,11 @@ export const relationshipsRouter = router({",
   "    create: protectedProcedure",
   "       .input(createPartyInput)",
   "       .handler(async ({ context, input }) => {",
   "+         const importBulk = protectedProcedure",
   "+            .input(importBulkInput)",
   "+            .handler(async ({ context, input }) => {",
   "+               for (const row of input.rows) {",
   "+                  await context.db.insert(parties).values(row);",
   "       }),",
   " });",
   "diff --git a/apps/web/src/features/relationships/relationships-table.tsx b/apps/web/src/features/relationships/relationships-table.tsx",
   "index 3333333..4444444 100644",
   "--- a/apps/web/src/features/relationships/relationships-table.tsx",
   "+++ b/apps/web/src/features/relationships/relationships-table.tsx",
   "@@ -506,3 +506,5 @@ function getImportSuccessMessage(value: ImportResult) {",
   "+   return `${value.created} relacionamento(s) importado(s). ${value.skipped} duplicado(s) ignorado(s).`;",
   "+}",
].join("\n");

function comment(input: Partial<ReviewComment>): ReviewComment {
   return {
      path: "modules/relationships/src/router/index.ts",
      line: 455,
      side: "RIGHT",
      severity: "major",
      confidence: 0.9,
      actionable: true,
      title: "Comentário publicável",
      body: "Correção: ajuste o handler para preservar o contrato.",
      ...input,
   };
}

describe("PR review inline comments", () => {
   it("mapeia linhas exatas comentáveis no diff", () => {
      const lines = parseDiffReviewLines(patch);

      expect(
         lines.get("modules/relationships/src/router/index.ts")?.right.has(455),
      ).toBe(true);
      expect(
         lines
            .get("apps/web/src/features/relationships/relationships-table.tsx")
            ?.right.has(507),
      ).toBe(true);
   });

   it("mantém comentário quando a linha informada existe no patch", () => {
      const result = splitValidInlineComments([comment({ line: 455 })], patch);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]?.line).toBe(455);
      expect(result.skipped).toHaveLength(0);
   });

   it("ancora achado aproximado na linha comentável mais próxima do mesmo arquivo", () => {
      const result = splitValidInlineComments([comment({ line: 464 })], patch);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]?.line).toBe(461);
      expect(result.valid[0]?.body).toContain("linha 464");
      expect(result.valid[0]?.body).toContain("linha alterada mais próxima");
      expect(result.skipped).toHaveLength(0);
   });

   it("usa fallback por arquivo em vez de descartar linha fora do diff", () => {
      const result = splitValidInlineComments(
         [
            comment({
               path: "apps/web/src/features/relationships/relationships-table.tsx",
               line: 530,
               severity: "minor",
            }),
         ],
         patch,
      );

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]?.path).toBe(
         "apps/web/src/features/relationships/relationships-table.tsx",
      );
      expect(result.valid[0]?.line).toBe(507);
      expect(result.skipped).toHaveLength(0);
   });

   it("combina achados que caem na mesma âncora", () => {
      const result = splitValidInlineComments(
         [
            comment({
               line: 464,
               severity: "minor",
               title: "Timeout ausente",
            }),
            comment({
               line: 465,
               severity: "critical",
               title: "Ownership ausente",
            }),
         ],
         patch,
      );

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]?.line).toBe(461);
      expect(result.valid[0]?.severity).toBe("critical");
      expect(result.valid[0]?.title).toBe("2 achados nesta linha");
      expect(result.valid[0]?.body).toContain("Timeout ausente");
      expect(result.valid[0]?.body).toContain("Ownership ausente");
   });

   it("descarta fallback distante para evitar comentário em trecho não relacionado", () => {
      const result = splitValidInlineComments([comment({ line: 900 })], patch);

      expect(result.valid).toHaveLength(0);
      expect(result.skipped).toEqual([
         expect.objectContaining({
            reason:
               "Arquivo aparece no diff, mas não possui linha comentável próxima o suficiente.",
         }),
      ]);
   });

   it("ainda descarta comentário quando o arquivo não aparece no diff", () => {
      const result = splitValidInlineComments(
         [comment({ path: "modules/relationships/src/missing.ts" })],
         patch,
      );

      expect(result.valid).toHaveLength(0);
      expect(result.skipped).toEqual([
         expect.objectContaining({
            reason: "Arquivo não aparece no diff atual.",
         }),
      ]);
   });
});
