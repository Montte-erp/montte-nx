import dayjs from "dayjs";
import { AppError, validateInput } from "@core/logging/errors";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateSubscriptionInput,
   type SubscriptionStatus,
   type UpdateSubscriptionInput,
   contactSubscriptions,
   createSubscriptionSchema,
   updateSubscriptionSchema,
} from "@core/database/schemas/subscriptions";

const safeValidateCreate = fromThrowable(
   (data: CreateSubscriptionInput) =>
      validateInput(createSubscriptionSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateSubscriptionInput) =>
      validateInput(updateSubscriptionSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
);

export function createSubscription(
   db: DatabaseInstance,
   teamId: string,
   data: CreateSubscriptionInput,
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .insert(contactSubscriptions)
            .values({ ...validated, teamId })
            .returning(),
         (e) => AppError.database("Falha ao criar assinatura.", { cause: e }),
      ).andThen(([subscription]) =>
         subscription
            ? ok(subscription)
            : err(AppError.database("Falha ao criar assinatura.")),
      ),
   );
}

export function getSubscription(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.contactSubscriptions.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar assinatura.", { cause: e }),
   ).map((subscription) => subscription ?? null);
}

export function updateSubscription(
   db: DatabaseInstance,
   id: string,
   data: UpdateSubscriptionInput,
) {
   return safeValidateUpdate(data).asyncAndThen((validated) => {
      const { trialEndsAt, currentPeriodStart, currentPeriodEnd, ...rest } =
         validated;
      return fromPromise(
         db
            .update(contactSubscriptions)
            .set({
               ...rest,
               trialEndsAt:
                  trialEndsAt === undefined
                     ? undefined
                     : trialEndsAt != null
                       ? dayjs(trialEndsAt).toDate()
                       : null,
               currentPeriodStart:
                  currentPeriodStart === undefined
                     ? undefined
                     : currentPeriodStart != null
                       ? dayjs(currentPeriodStart).toDate()
                       : null,
               currentPeriodEnd:
                  currentPeriodEnd === undefined
                     ? undefined
                     : currentPeriodEnd != null
                       ? dayjs(currentPeriodEnd).toDate()
                       : null,
               updatedAt: dayjs().toDate(),
            })
            .where(eq(contactSubscriptions.id, id))
            .returning(),
         (e) =>
            AppError.database("Falha ao atualizar assinatura.", { cause: e }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Assinatura não encontrada.")),
      );
   });
}

export function listSubscriptionsByTeam(
   db: DatabaseInstance,
   teamId: string,
   status?: SubscriptionStatus,
) {
   return fromPromise(
      (async () => {
         const conditions = [eq(contactSubscriptions.teamId, teamId)];
         if (status) {
            conditions.push(eq(contactSubscriptions.status, status));
         }
         return db
            .select()
            .from(contactSubscriptions)
            .where(and(...conditions));
      })(),
      (e) => AppError.database("Falha ao listar assinaturas.", { cause: e }),
   );
}

export function listSubscriptionsByContact(
   db: DatabaseInstance,
   contactId: string,
) {
   return fromPromise(
      db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.contactId, contactId))
         .orderBy(desc(contactSubscriptions.createdAt)),
      (e) =>
         AppError.database("Falha ao listar assinaturas do contato.", {
            cause: e,
         }),
   );
}

export function upsertSubscriptionByExternalId(
   db: DatabaseInstance,
   externalId: string,
   data: CreateSubscriptionInput & { teamId: string },
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         (async () => {
            const existing = await db.query.contactSubscriptions.findFirst({
               where: (fields, { eq }) => eq(fields.externalId, externalId),
            });

            if (existing) {
               const [updated] = await db
                  .update(contactSubscriptions)
                  .set({
                     status: validated.status,
                     endDate: validated.endDate,
                     updatedAt: dayjs().toDate(),
                  })
                  .where(eq(contactSubscriptions.id, existing.id))
                  .returning();
               if (!updated)
                  throw AppError.database("Falha ao salvar assinatura.");
               return updated;
            }

            const [created] = await db
               .insert(contactSubscriptions)
               .values({ ...validated, teamId: data.teamId, externalId })
               .returning();
            if (!created)
               throw AppError.database("Falha ao salvar assinatura.");
            return created;
         })(),
         (e) =>
            e instanceof AppError
               ? e
               : AppError.database("Falha ao salvar assinatura.", { cause: e }),
      ),
   );
}

export function ensureSubscriptionOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getSubscription(db, id).andThen((subscription) => {
      if (!subscription || subscription.teamId !== teamId)
         return err(AppError.notFound("Assinatura não encontrada."));
      return ok(subscription);
   });
}

export function listExpiringSoon(
   db: DatabaseInstance,
   teamId: string,
   withinDays = 30,
   status: "active" | "trialing" = "active",
) {
   return fromPromise(
      (async () => {
         const now = dayjs().format("YYYY-MM-DD");
         const futureDate = dayjs().add(withinDays, "day").format("YYYY-MM-DD");
         return db
            .select()
            .from(contactSubscriptions)
            .where(
               and(
                  eq(contactSubscriptions.teamId, teamId),
                  eq(contactSubscriptions.status, status),
                  gte(contactSubscriptions.endDate, now),
                  lte(contactSubscriptions.endDate, futureDate),
               ),
            );
      })(),
      (e) =>
         AppError.database("Falha ao listar assinaturas expirando.", {
            cause: e,
         }),
   );
}
