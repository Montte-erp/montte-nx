import { z } from "zod";
import { type EmitFn } from "./catalog";
export declare const DOCUMENT_EVENTS: {
   readonly "document.signed": "document.signed";
};
export type DocumentEventName =
   (typeof DOCUMENT_EVENTS)[keyof typeof DOCUMENT_EVENTS];
export declare const documentSignedSchema: z.ZodObject<
   {
      documentId: z.ZodString;
      signatureType: z.ZodEnum<{
         a1: "a1";
         a3: "a3";
      }>;
      signerCpfHash: z.ZodString;
   },
   z.core.$strip
>;
export type DocumentSignedEvent = z.infer<typeof documentSignedSchema>;
export declare function emitDocumentSigned(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: DocumentSignedEvent,
): Promise<void>;
//# sourceMappingURL=document.d.ts.map
