import { z } from "zod";

export const SSE_SCOPE_KINDS = ["user", "team", "org"] as const;
export type SseScopeKind = (typeof SSE_SCOPE_KINDS)[number];

export const sseScopeSchema = z.discriminatedUnion("kind", [
   z.object({ kind: z.literal("user"), id: z.string() }),
   z.object({ kind: z.literal("team"), id: z.string() }),
   z.object({ kind: z.literal("org"), id: z.string() }),
]);

export type SseScope = z.infer<typeof sseScopeSchema>;

export const sseEnvelopeSchema = z.object({
   id: z.string(),
   type: z.string(),
   scope: sseScopeSchema,
   payload: z.unknown(),
   timestamp: z.string(),
});

export type SseEnvelope = z.infer<typeof sseEnvelopeSchema>;
