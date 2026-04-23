import dayjs from "dayjs";
import { AppError, validateInput } from "@core/logging/errors";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
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
import { services, serviceVariants } from "@core/database/schemas/services";

const safeValidateCreate = fromThrowable(
   (data: CreateSubscriptionInput) =>
      validateInput(createSubscriptionSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateSubscriptionInput) =>
      validateInput(updateSubscriptionSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
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
   return safeValidateUpdate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .update(contactSubscriptions)
            .set({ ...validated, updatedAt: dayjs().toDate() })
            .where(eq(contactSubscriptions.id, id))
            .returning(),
         (e) =>
            AppError.database("Falha ao atualizar assinatura.", { cause: e }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Assinatura não encontrada.")),
      ),
   );
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
         .select({
            id: contactSubscriptions.id,
            teamId: contactSubscriptions.teamId,
            contactId: contactSubscriptions.contactId,
            variantId: contactSubscriptions.variantId,
            startDate: contactSubscriptions.startDate,
            endDate: contactSubscriptions.endDate,
            negotiatedPrice: contactSubscriptions.negotiatedPrice,
            notes: contactSubscriptions.notes,
            status: contactSubscriptions.status,
            source: contactSubscriptions.source,
            externalId: contactSubscriptions.externalId,
            currentPeriodStart: contactSubscriptions.currentPeriodStart,
            currentPeriodEnd: contactSubscriptions.currentPeriodEnd,
            cancelAtPeriodEnd: contactSubscriptions.cancelAtPeriodEnd,
            canceledAt: contactSubscriptions.canceledAt,
            createdAt: contactSubscriptions.createdAt,
            updatedAt: contactSubscriptions.updatedAt,
            serviceName: services.name,
            variantName: serviceVariants.name,
            billingCycle: serviceVariants.interval,
            serviceId: services.id,
         })
         .from(contactSubscriptions)
         .leftJoin(
            serviceVariants,
            eq(contactSubscriptions.variantId, serviceVariants.id),
         )
         .leftJoin(services, eq(serviceVariants.serviceId, services.id))
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
                     negotiatedPrice: validated.negotiatedPrice,
                     endDate: validated.endDate,
                     currentPeriodStart: validated.currentPeriodStart,
                     currentPeriodEnd: validated.currentPeriodEnd,
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

export function countActiveSubscriptionsByVariant(
   db: DatabaseInstance,
   teamId: string,
) {
   return fromPromise(
      db
         .select({
            variantId: contactSubscriptions.variantId,
            count: count(),
         })
         .from(contactSubscriptions)
         .where(
            and(
               eq(contactSubscriptions.teamId, teamId),
               eq(contactSubscriptions.status, "active"),
            ),
         )
         .groupBy(contactSubscriptions.variantId),
      (e) =>
         AppError.database("Falha ao contar assinaturas ativas.", { cause: e }),
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
                  eq(contactSubscriptions.status, "active"),
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
