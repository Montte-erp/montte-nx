import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";

const knownEventSchema = z.discriminatedUnion("type", [
   z.object({
      type: z.literal("billing.usage_ingested"),
      payload: z.object({
         meterId: z.string(),
         idempotencyKey: z.string(),
      }),
   }),
   z.object({
      type: z.literal("classification.transaction_classified"),
      payload: z.object({
         transactionId: z.string(),
         categoryId: z.string(),
         tagId: z.string().nullable(),
      }),
   }),
   z.object({
      type: z.literal("classification.keywords_derived"),
      payload: z.object({
         entity: z.enum(["category", "tag"]),
         entityId: z.string(),
         entityName: z.string(),
         count: z.number().int().nonnegative(),
      }),
   }),
   z.object({
      type: z.literal("classification.batch_started"),
      payload: z.object({
         batchId: z.string(),
         total: z.number().int().nonnegative(),
      }),
   }),
   z.object({
      type: z.literal("classification.batch_progress"),
      payload: z.object({
         batchId: z.string(),
         total: z.number().int().nonnegative(),
         processed: z.number().int().nonnegative(),
      }),
   }),
   z.object({
      type: z.literal("classification.batch_completed"),
      payload: z.object({
         batchId: z.string(),
         total: z.number().int().nonnegative(),
         classified: z.number().int().nonnegative(),
      }),
   }),
]);

type KnownEvent = z.infer<typeof knownEventSchema>;

type ToastSpec = {
   kind: "info" | "success";
   message: string;
};

function eventToToast(event: KnownEvent): ToastSpec | null {
   switch (event.type) {
      case "billing.usage_ingested":
         return null;
      case "classification.transaction_classified":
         return null;
      case "classification.keywords_derived":
         return {
            kind: "success",
            message: `Palavras-chave atualizadas em "${event.payload.entityName}" (${event.payload.count}).`,
         };
      case "classification.batch_started":
      case "classification.batch_progress":
      case "classification.batch_completed":
         return null;
   }
}

function handleClassificationBatchEvent(event: KnownEvent) {
   if (event.type === "classification.batch_started") {
      toast.loading(
         `Montte AI categorizando ${event.payload.total} ${event.payload.total === 1 ? "transação" : "transações"}...`,
         { id: `classify-${event.payload.batchId}` },
      );
      return;
   }
   if (event.type === "classification.batch_progress") {
      toast.loading(
         `Montte AI categorizando ${event.payload.processed}/${event.payload.total} ${event.payload.total === 1 ? "transação" : "transações"}...`,
         { id: `classify-${event.payload.batchId}` },
      );
      return;
   }
   if (event.type === "classification.batch_completed") {
      const id = `classify-${event.payload.batchId}`;
      if (event.payload.classified === 0) {
         toast.dismiss(id);
         return;
      }
      toast.success(
         `Montte AI categorizou ${event.payload.classified} de ${event.payload.total} ${event.payload.total === 1 ? "transação" : "transações"}.`,
         { id },
      );
   }
}

export function useInboxStream() {
   const { data } = useQuery(
      orpc.inbox.subscribe.experimental_liveOptions({
         retry: true,
      }),
   );

   useEffect(() => {
      if (!data) return;
      const parsed = knownEventSchema.safeParse({
         type: data.type,
         payload: data.payload,
      });
      if (!parsed.success) return;
      handleClassificationBatchEvent(parsed.data);
      const spec = eventToToast(parsed.data);
      if (!spec) return;
      if (spec.kind === "success") toast.success(spec.message);
      else toast.info(spec.message);
   }, [data]);
}
