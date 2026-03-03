import { z } from "zod";

import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const NFE_EVENTS = {
   "nfe.emitted": "nfe.emitted",
   "nfe.cancelled": "nfe.cancelled",
} as const;

export type NfeEventName = (typeof NFE_EVENTS)[keyof typeof NFE_EVENTS];

export const nfeEmittedSchema = z.object({
   nfeId: z.string().uuid(),
   cnpj: z.string(),
   chaveAcesso: z.string().optional(),
   valorTotal: z.number().nonnegative(),
   tipo: z.enum(["NFe", "NFSe", "NFCe"]),
});
export type NfeEmittedEvent = z.infer<typeof nfeEmittedSchema>;
export function emitNfeEmitted(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: NfeEmittedEvent,
) {
   return emit({
      ...ctx,
      eventName: NFE_EVENTS["nfe.emitted"],
      eventCategory: EVENT_CATEGORIES.nfe,
      properties,
   });
}

export const nfeCancelledSchema = z.object({
   nfeId: z.string().uuid(),
   motivo: z.string(),
});
export type NfeCancelledEvent = z.infer<typeof nfeCancelledSchema>;
export function emitNfeCancelled(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: NfeCancelledEvent,
) {
   return emit({
      ...ctx,
      eventName: NFE_EVENTS["nfe.cancelled"],
      eventCategory: EVENT_CATEGORIES.nfe,
      properties,
   });
}
