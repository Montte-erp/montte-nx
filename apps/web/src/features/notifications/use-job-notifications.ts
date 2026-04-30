import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";

const knownEventSchema = z.discriminatedUnion("type", [
   z.object({
      type: z.literal("billing.trial_expiring"),
      payload: z.object({
         subscriptionId: z.string(),
         trialEndsAt: z.string(),
         daysLeft: z.number().int().nonnegative(),
      }),
   }),
   z.object({
      type: z.literal("billing.trial_completed"),
      payload: z.object({
         subscriptionId: z.string(),
      }),
   }),
   z.object({
      type: z.literal("billing.invoice_generated"),
      payload: z.object({
         invoiceId: z.string(),
         subscriptionId: z.string(),
         total: z.string(),
         currency: z.string(),
      }),
   }),
   z.object({
      type: z.literal("billing.benefit_granted"),
      payload: z.object({
         subscriptionId: z.string(),
         benefitIds: z.array(z.string()),
      }),
   }),
   z.object({
      type: z.literal("billing.benefit_revoked"),
      payload: z.object({
         subscriptionId: z.string(),
         benefitIds: z.array(z.string()),
      }),
   }),
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
]);

type KnownEvent = z.infer<typeof knownEventSchema>;

type ToastSpec = {
   kind: "info" | "success";
   message: string;
};

function eventToToast(event: KnownEvent): ToastSpec | null {
   switch (event.type) {
      case "billing.trial_expiring":
         return {
            kind: "info",
            message: `Período de teste expira em ${event.payload.daysLeft} dia(s).`,
         };
      case "billing.trial_completed":
         return {
            kind: "success",
            message: "Período de teste encerrado — assinatura ativada.",
         };
      case "billing.invoice_generated":
         return {
            kind: "success",
            message: `Fatura gerada — total ${event.payload.total} ${event.payload.currency}.`,
         };
      case "billing.benefit_granted":
         return {
            kind: "success",
            message: `Benefícios concedidos (${event.payload.benefitIds.length}).`,
         };
      case "billing.benefit_revoked":
         return {
            kind: "info",
            message: `Benefícios revogados (${event.payload.benefitIds.length}).`,
         };
      case "billing.usage_ingested":
         return null;
      case "classification.transaction_classified":
         return null;
      case "classification.keywords_derived":
         return {
            kind: "success",
            message: `Palavras-chave atualizadas em "${event.payload.entityName}" (${event.payload.count}).`,
         };
   }
}

export function useJobNotifications() {
   const { data } = useQuery(
      orpc.notifications.subscribe.experimental_liveOptions({
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
      const spec = eventToToast(parsed.data);
      if (!spec) return;
      if (spec.kind === "success") toast.success(spec.message);
      else toast.info(spec.message);
   }, [data]);
}
