import { z } from "zod";

import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const DOCUMENT_EVENTS = {
   "document.signed": "document.signed",
} as const;

export type DocumentEventName =
   (typeof DOCUMENT_EVENTS)[keyof typeof DOCUMENT_EVENTS];

export const documentSignedSchema = z.object({
   documentId: z.string().uuid(),
   signatureType: z.enum(["a1", "a3"]),
   signerCpfHash: z.string(), // hashed — never store raw CPF
});
export type DocumentSignedEvent = z.infer<typeof documentSignedSchema>;
export function emitDocumentSigned(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: DocumentSignedEvent,
) {
   return emit({
      ...ctx,
      eventName: DOCUMENT_EVENTS["document.signed"],
      eventCategory: EVENT_CATEGORIES.document,
      properties,
   });
}
