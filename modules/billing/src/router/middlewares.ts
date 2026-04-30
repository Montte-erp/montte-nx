import { os } from "@orpc/server";
import { err, fromPromise, ok } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import type {
   ContactByIdRef,
   ContactFkRef,
} from "../contracts/billing-contract";

const base = os.$context<ORPCContextWithOrganization>();

export type ContactRef = ContactByIdRef | ContactFkRef;

export const requireService = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.services.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((service) =>
         !service || service.teamId !== context.teamId
            ? err(WebAppError.notFound("Serviço não encontrado."))
            : ok(service),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { service: result.value } });
   },
);

export const requireServicePrice = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.servicePrices.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((price) =>
         !price || price.teamId !== context.teamId
            ? err(WebAppError.notFound("Preço não encontrado."))
            : ok(price),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { servicePrice: result.value } });
   },
);

export const requireContact = base.middleware(
   async ({ context, next }, ref: ContactRef) => {
      const result = await fromPromise(
         context.db.query.contacts.findFirst({
            where: (f, { and, eq }) =>
               "id" in ref
                  ? and(eq(f.teamId, context.teamId), eq(f.id, ref.id))
                  : "contactId" in ref
                    ? and(eq(f.teamId, context.teamId), eq(f.id, ref.contactId))
                    : and(
                         eq(f.teamId, context.teamId),
                         eq(f.externalId, ref.externalId),
                      ),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((contact) =>
         !contact
            ? err(WebAppError.notFound("Contato não encontrado."))
            : ok(contact),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { contact: result.value } });
   },
);

export const requireMeter = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.meters.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((meter) =>
         !meter || meter.teamId !== context.teamId
            ? err(WebAppError.notFound("Medidor não encontrado."))
            : ok(meter),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { meter: result.value } });
   },
);

export const requireBenefit = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.benefits.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((benefit) =>
         !benefit || benefit.teamId !== context.teamId
            ? err(WebAppError.notFound("Benefício não encontrado."))
            : ok(benefit),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { benefit: result.value } });
   },
);

export const requireSubscription = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.contactSubscriptions.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((subscription) =>
         !subscription || subscription.teamId !== context.teamId
            ? err(WebAppError.notFound("Assinatura não encontrada."))
            : ok(subscription),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { subscription: result.value } });
   },
);

export const requireSubscriptionItem = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.subscriptionItems.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((item) =>
         !item || item.teamId !== context.teamId
            ? err(WebAppError.notFound("Item de assinatura não encontrado."))
            : ok(item),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { subscriptionItem: result.value } });
   },
);
