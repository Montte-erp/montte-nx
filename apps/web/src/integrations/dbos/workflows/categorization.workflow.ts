import { DBOS } from "@dbos-inc/dbos-sdk";
import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";
import {
   findCategoryByKeywords,
   listCategories,
} from "@core/database/repositories/categories-repository";
import { updateTransactionCategory } from "@core/database/repositories/transactions-repository";
import { db } from "@/integrations/singletons";

export type CategorizationInput = {
   transactionId: string;
   teamId: string;
   name: string;
   type: "income" | "expense";
   contactName?: string | null;
};

const MODEL = "google/gemini-3.1-flash-lite-preview";

const outputSchema = z.object({
   categoryName: z.string().nullable(),
   confidence: z.enum(["high", "low"]),
});

export class CategorizationWorkflow {
   @DBOS.workflow()
   static async run(input: CategorizationInput) {
      const keywordMatch =
         await CategorizationWorkflow.matchKeywordsStep(input);

      if (keywordMatch) {
         await CategorizationWorkflow.applyStep(input.transactionId, {
            categoryId: keywordMatch.id,
         });
         return;
      }

      const aiResult = await CategorizationWorkflow.inferWithAIStep(input);
      if (!aiResult) return;

      if (aiResult.confidence === "high") {
         await CategorizationWorkflow.applyStep(input.transactionId, {
            categoryId: aiResult.categoryId,
         });
      } else {
         await CategorizationWorkflow.applyStep(input.transactionId, {
            suggestedCategoryId: aiResult.categoryId,
         });
      }
   }

   @DBOS.step()
   static async matchKeywordsStep(
      input: Pick<CategorizationInput, "teamId" | "name" | "type">,
   ): Promise<{ id: string } | null> {
      return findCategoryByKeywords(db, input.teamId, {
         name: input.name,
         type: input.type,
      });
   }

   @DBOS.step()
   static async inferWithAIStep(
      input: CategorizationInput,
   ): Promise<{ categoryId: string; confidence: "high" | "low" } | null> {
      const cats = await listCategories(db, input.teamId, {
         type: input.type,
         includeArchived: false,
      });
      if (cats.length === 0) return null;

      const categoryList = cats
         .map(
            (c) =>
               `- ${c.name}${c.keywords?.length ? ` (palavras: ${c.keywords.join(", ")})` : ""}`,
         )
         .join("\n");

      const prompt = `Você é um assistente financeiro brasileiro. Classifique a transação abaixo na categoria mais adequada.

Transação:
- Nome: ${input.name}${input.contactName ? `\n- Contato: ${input.contactName}` : ""}
- Tipo: ${input.type === "income" ? "Receita" : "Despesa"}

Categorias disponíveis:
${categoryList}

Retorne o nome exato de uma categoria da lista acima, ou null se nenhuma for adequada.
Se tiver certeza, retorne confidence "high". Se estiver em dúvida, retorne "low".`;

      const result = await chat({
         adapter: openRouterText(MODEL),
         messages: [
            { role: "user", content: [{ type: "text", content: prompt }] },
         ],
         outputSchema,
         stream: false,
      });

      if (!result.categoryName) return null;

      const match = cats.find((c) => c.name === result.categoryName);
      if (!match) return null;

      return { categoryId: match.id, confidence: result.confidence };
   }

   @DBOS.step()
   static async applyStep(
      transactionId: string,
      data: { categoryId?: string; suggestedCategoryId?: string },
   ) {
      await updateTransactionCategory(db, transactionId, data);
   }
}
