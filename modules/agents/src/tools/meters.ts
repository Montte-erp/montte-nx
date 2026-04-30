import { toolDefinition } from "@tanstack/ai";
import { and, eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { meters } from "@core/database/schemas/meters";
import {
   createMeterSchema,
   updateMeterSchema,
} from "@core/database/schemas/meters";
import type { ToolDeps } from "@modules/agents/tools/types";

const listMetersInput = z.object({
   search: z
      .string()
      .optional()
      .describe("Busca parcial (ILIKE) em nome ou eventName do medidor."),
});

const updateMeterInput = z
   .object({
      id: z.string().uuid().describe("UUID do medidor a atualizar."),
   })
   .merge(updateMeterSchema);

export function buildMetersTools(deps: ToolDeps) {
   const { db, teamId } = deps;

   const listMetersTool = toolDefinition({
      name: "meters_list",
      description:
         "Lista medidores (meters). Medidores rastreiam uso (eventos) e alimentam preços por consumo e benefícios com créditos.",
      inputSchema: listMetersInput,
      lazy: true,
   }).server(async ({ search }) => {
      const rows = await db.query.meters.findMany({
         columns: {
            id: true,
            name: true,
            eventName: true,
            aggregation: true,
            aggregationProperty: true,
            unitCost: true,
            isActive: true,
         },
         where: (f, { and: a, eq: e, ilike, or, sql }) =>
            a(
               e(f.teamId, teamId),
               search
                  ? or(
                       ilike(f.name, sql`${`%${search}%`}`),
                       ilike(f.eventName, sql`${`%${search}%`}`),
                    )
                  : undefined,
            ),
         limit: 50,
      });
      return { count: rows.length, items: rows };
   });

   const createMeterTool = toolDefinition({
      name: "meters_create",
      description:
         "Cria um medidor avulso (sem vincular a serviço). Para serviço novo com preço por consumo prefira services_setup.",
      inputSchema: createMeterSchema,
      needsApproval: true,
      lazy: true,
   }).server(async (input) => {
      const result = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .insert(meters)
               .values({ ...input, teamId })
               .returning(),
         ),
         () => "Falha ao criar medidor.",
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      const [row] = result.value;
      if (!row) return { ok: false as const, error: "Falha ao criar medidor." };
      return {
         ok: true as const,
         meter: {
            id: row.id,
            name: row.name,
            eventName: row.eventName,
         },
      };
   });

   const updateMeterTool = toolDefinition({
      name: "meters_update",
      description: "Atualiza um medidor.",
      inputSchema: updateMeterInput,
      needsApproval: true,
      lazy: true,
   }).server(async ({ id, ...data }) => {
      const result = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .update(meters)
               .set(data)
               .where(and(eq(meters.id, id), eq(meters.teamId, teamId)))
               .returning(),
         ),
         () => "Falha ao atualizar medidor.",
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      const [row] = result.value;
      if (!row) return { ok: false as const, error: "Medidor não encontrado." };
      return {
         ok: true as const,
         meter: { id: row.id, name: row.name },
      };
   });

   return [listMetersTool, createMeterTool, updateMeterTool];
}
