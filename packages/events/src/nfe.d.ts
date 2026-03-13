import { z } from "zod";
import { type EmitFn } from "./catalog";
export declare const NFE_EVENTS: {
   readonly "nfe.emitted": "nfe.emitted";
   readonly "nfe.cancelled": "nfe.cancelled";
};
export type NfeEventName = (typeof NFE_EVENTS)[keyof typeof NFE_EVENTS];
export declare const nfeEmittedSchema: z.ZodObject<
   {
      nfeId: z.ZodString;
      cnpj: z.ZodString;
      chaveAcesso: z.ZodOptional<z.ZodString>;
      valorTotal: z.ZodNumber;
      tipo: z.ZodEnum<{
         NFCe: "NFCe";
         NFSe: "NFSe";
         NFe: "NFe";
      }>;
   },
   z.core.$strip
>;
export type NfeEmittedEvent = z.infer<typeof nfeEmittedSchema>;
export declare function emitNfeEmitted(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: NfeEmittedEvent,
): Promise<void>;
export declare const nfeCancelledSchema: z.ZodObject<
   {
      nfeId: z.ZodString;
      motivo: z.ZodString;
   },
   z.core.$strip
>;
export type NfeCancelledEvent = z.infer<typeof nfeCancelledSchema>;
export declare function emitNfeCancelled(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: NfeCancelledEvent,
): Promise<void>;
//# sourceMappingURL=nfe.d.ts.map
