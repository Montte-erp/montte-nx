import dayjs from "dayjs";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { inboxItems } from "@core/database/schemas/inbox";
import { protectedProcedure } from "@core/orpc/server";
import {
   inboxCountsSchema,
   inboxItemDtoSchema,
} from "@modules/inbox/schemas/inbox-item";
import { aggregateInbox } from "@modules/inbox/services/aggregate";

const inboxRouterErrors = defineErrorCatalog("inbox.router", {
   DISMISS_FAILED: {
      status: 500,
      message: "Falha ao dispensar item.",
      tags: ["inbox"],
   },
   SNOOZE_FAILED: {
      status: 500,
      message: "Falha ao adiar item.",
      tags: ["inbox"],
   },
   MARK_READ_FAILED: {
      status: 500,
      message: "Falha ao marcar como lido.",
      tags: ["inbox"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "inbox.router": typeof inboxRouterErrors;
   }
}

type InboxCatalogError =
   | ReturnType<typeof inboxRouterErrors.DISMISS_FAILED>
   | ReturnType<typeof inboxRouterErrors.SNOOZE_FAILED>
   | ReturnType<typeof inboxRouterErrors.MARK_READ_FAILED>;

class InboxError extends TaggedError("InboxError")<{
   error: InboxCatalogError;
   itemKey?: string;
   message: string;
   teamId: string;
}>() {}

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
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const dismiss = protectedProcedure
   .input(itemKeySchema)
   .handler(async ({ context, input }) => {
      const now = dayjs().toDate();
      const result = await Result.tryPromise({
         try: () =>
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
         catch: () =>
            new InboxError({
               error: inboxRouterErrors.DISMISS_FAILED({
                  internal: { itemKey: input.itemKey, teamId: context.teamId },
               }),
               itemKey: input.itemKey,
               message: "Falha ao dispensar item.",
               teamId: context.teamId,
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { ok: true };
   });

export const snooze = protectedProcedure
   .input(itemKeySchema.extend({ until: z.string().datetime() }))
   .handler(async ({ context, input }) => {
      const until = dayjs(input.until).toDate();
      const result = await Result.tryPromise({
         try: () =>
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
         catch: () =>
            new InboxError({
               error: inboxRouterErrors.SNOOZE_FAILED({
                  internal: { itemKey: input.itemKey, teamId: context.teamId },
               }),
               itemKey: input.itemKey,
               message: "Falha ao adiar item.",
               teamId: context.teamId,
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { ok: true };
   });

export const markRead = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const now = dayjs().toDate();
      const result = await Result.tryPromise({
         try: () =>
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
         catch: () =>
            new InboxError({
               error: inboxRouterErrors.MARK_READ_FAILED({
                  internal: { id: input.id, teamId: context.teamId },
               }),
               message: "Falha ao marcar como lido.",
               teamId: context.teamId,
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { ok: true };
   });
