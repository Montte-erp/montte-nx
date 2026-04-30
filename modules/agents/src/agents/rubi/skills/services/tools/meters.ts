import { toolDefinition } from "@tanstack/ai";
import { and, eq, ilike, or } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { meters } from "@core/database/schemas/meters";
import {
   createMeterSchema,
   updateMeterSchema,
} from "@modules/billing/contracts/services";
import type { SkillDeps } from "../../types";

const listMetersInput = z.object({ search: z.string().optional() });

const updateMeterInput = z
   .object({ id: z.string().uuid() })
   .merge(updateMeterSchema);

function errMessage(e: unknown) {
   return e instanceof Error ? e.message : String(e);
}

export function buildMetersTools(deps: SkillDeps) {
   const { db, teamId } = deps;

   const listMetersTool = toolDefinition({
      name: "meters_list",
      description:
         "Lista medidores (meters). Medidores rastreiam uso (eventos) e alimentam preços por consumo e benefícios com créditos.",
      inputSchema: listMetersInput,
      lazy: true,
   }).server(async ({ search }) => {
      const rows = await db
         .select({
            id: meters.id,
            name: meters.name,
            eventName: meters.eventName,
            aggregation: meters.aggregation,
            aggregationProperty: meters.aggregationProperty,
            unitCost: meters.unitCost,
            isActive: meters.isActive,
         })
         .from(meters)
         .where(
            and(
               eq(meters.teamId, teamId),
               search
                  ? or(
                       ilike(meters.name, `%${search}%`),
                       ilike(meters.eventName, `%${search}%`),
                    )
                  : undefined,
            ),
         )
         .limit(50);
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
         db.transaction(async (tx) => {
            const [row] = await tx
               .insert(meters)
               .values({ ...input, teamId })
               .returning();
            if (!row) throw new Error("Falha ao criar medidor.");
            return row;
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         meter: {
            id: result.value.id,
            name: result.value.name,
            eventName: result.value.eventName,
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
         db.transaction(async (tx) => {
            const [row] = await tx
               .update(meters)
               .set(data)
               .where(and(eq(meters.id, id), eq(meters.teamId, teamId)))
               .returning();
            if (!row) throw new Error("Medidor não encontrado.");
            return row;
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         meter: { id: result.value.id, name: result.value.name },
      };
   });

   return [listMetersTool, createMeterTool, updateMeterTool];
}
