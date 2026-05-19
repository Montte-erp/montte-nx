import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import type { AgentReadClient } from "@modules/agents/tools/registry";

const uuid = z.string().uuid();

const listCategoriesInputSchema = z.object({
   type: z.enum(["income", "expense", "transfer"]).optional(),
   includeArchived: z.boolean().default(false),
});

const categorySchema = z.object({
   id: uuid,
   name: z.string(),
   type: z.enum(["income", "expense", "transfer"]),
   parentId: uuid.nullable(),
   level: z.number().int(),
   isArchived: z.boolean(),
   participatesDre: z.boolean(),
});

const listCategoriesOutputSchema = z.object({
   data: z.array(categorySchema),
});

const listCostCentersInputSchema = z.object({
   query: z.string().trim().min(1).max(100).optional(),
   includeArchived: z.boolean().default(false),
   limit: z.number().int().min(1).max(100).default(50),
});

const costCenterSchema = z.object({
   id: uuid,
   name: z.string(),
   color: z.string(),
   description: z.string().nullable(),
   isArchived: z.boolean(),
});

const listCostCentersOutputSchema = z.object({
   data: z.array(costCenterSchema),
   total: z.number().int().nonnegative(),
   limit: z.number().int().positive(),
});

interface ClassificationReadToolDeps {
   client: AgentReadClient;
}

export function buildClassificationReadTools({
   client,
}: ClassificationReadToolDeps) {
   return [
      toolDefinition({
         name: "list_categories",
         description:
            "Lista categorias financeiras disponíveis por tipo. Use para responder quais categorias existem ou para escolher categoryId em leituras financeiras.",
         inputSchema: listCategoriesInputSchema,
         outputSchema: listCategoriesOutputSchema,
      }).server(async (input) => ({
         data: await client.categories.getAll({
            type: input.type,
            includeArchived: input.includeArchived,
         }),
      })),
      toolDefinition({
         name: "list_cost_centers",
         description:
            "Lista Centros de Custo do time. No banco essa entidade é tag, mas para o usuário sempre trate como Centro de Custo.",
         inputSchema: listCostCentersInputSchema,
         outputSchema: listCostCentersOutputSchema,
      }).server(async (input) => {
         const limit = input.limit ?? 50;
         const result = await client.tags.getAll({
            search: input.query,
            includeArchived: input.includeArchived,
            page: 1,
            pageSize: limit,
         });

         return {
            data: result.data.map((tag) => ({
               id: tag.id,
               name: tag.name,
               color: tag.color,
               description: tag.description,
               isArchived: tag.isArchived,
            })),
            total: result.total,
            limit,
         };
      }),
   ];
}
