import { eventIterator } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { inboxItems } from "@core/database/schemas/inbox";
import { WebAppError } from "@core/logging/errors";
import { log } from "@core/logging";
import { protectedProcedure } from "@core/orpc/server";
import { sseEnvelopeSchema, type SseScope, subscribeSse } from "@core/sse";
import {
   inboxCountsSchema,
   inboxItemDtoSchema,
} from "@modules/inbox/schemas/inbox-item";
import { aggregateInbox } from "@modules/inbox/services/aggregate";

const itemKeySchema = z.object({ itemKey: z.string().min(1) });

export const list = protectedProcedure
   .output(
      z.object({
         items: z.array(inboxItemDtoSchema),
         counts: inboxCountsSchema,
      }),
   )
   .handler(async ({ context }) => {
      const result = await aggregateInbox(context.db, context.teamId);
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const dismiss = protectedProcedure
   .input(itemKeySchema)
   .handler(async ({ context, input }) => {
      const now = new Date();
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .insert(inboxItems)
               .values({
                  organizationId: context.organizationId,
                  teamId: context.teamId,
                  itemKey: input.itemKey,
                  source: "deterministic",
                  severity: "info",
                  title: "Item dispensado",
                  description: null,
                  payload: { dismissedStub: true },
                  dismissedAt: now,
               })
               .onConflictDoUpdate({
                  target: [inboxItems.teamId, inboxItems.itemKey],
                  set: { dismissedAt: now },
               })
               .returning(),
         ),
         () => WebAppError.internal("Falha ao dispensar item."),
      );
      if (result.isErr()) throw result.error;
      return { ok: true as const };
   });

export const snooze = protectedProcedure
   .input(itemKeySchema.extend({ until: z.string().datetime() }))
   .handler(async ({ context, input }) => {
      const until = new Date(input.until);
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .insert(inboxItems)
               .values({
                  organizationId: context.organizationId,
                  teamId: context.teamId,
                  itemKey: input.itemKey,
                  source: "deterministic",
                  severity: "info",
                  title: "Item adiado",
                  description: null,
                  payload: { snoozedStub: true },
                  snoozeUntil: until,
               })
               .onConflictDoUpdate({
                  target: [inboxItems.teamId, inboxItems.itemKey],
                  set: { snoozeUntil: until },
               })
               .returning(),
         ),
         () => WebAppError.internal("Falha ao adiar item."),
      );
      if (result.isErr()) throw result.error;
      return { ok: true as const };
   });

export const markRead = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const now = new Date();
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .update(inboxItems)
               .set({ readAt: now })
               .where(
                  and(
                     eq(inboxItems.id, input.id),
                     eq(inboxItems.teamId, context.teamId),
                  ),
               )
               .returning(),
         ),
         () => WebAppError.internal("Falha ao marcar como lido."),
      );
      if (result.isErr()) throw result.error;
      return { ok: true as const };
   });

export const subscribe = protectedProcedure
   .output(eventIterator(sseEnvelopeSchema))
   .handler(async function* ({ context, signal }) {
      log.info({
         module: "router:inbox",
         message: "Inbox SSE subscribe started",
         userId: context.userId,
         teamId: context.teamId,
         organizationId: context.organizationId,
      });
      const scopes: SseScope[] = [
         { kind: "user", id: context.userId },
         { kind: "team", id: context.teamId },
         { kind: "org", id: context.organizationId },
      ];
      try {
         for await (const envelope of subscribeSse(
            context.redis,
            scopes,
            signal,
         )) {
            yield envelope;
         }
      } finally {
         log.info({
            module: "router:inbox",
            message: "Inbox SSE subscribe ended",
            userId: context.userId,
            teamId: context.teamId,
         });
      }
   });
