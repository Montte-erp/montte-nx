import { z } from "zod";

export const inboxSeveritySchema = z.enum(["urgent", "warning", "info"]);
export type InboxSeverityValue = z.infer<typeof inboxSeveritySchema>;

export const inboxSourceSchema = z.enum([
   "due",
   "low-balance",
   "uncategorized",
   "billing",
   "agent",
]);
export type InboxSourceValue = z.infer<typeof inboxSourceSchema>;

export const inboxEntitySchema = z.object({
   type: z.enum([
      "transaction",
      "creditCard",
      "bankAccount",
      "category",
      "invoice",
      "subscription",
      "team",
   ]),
   id: z.string(),
});
export type InboxEntity = z.infer<typeof inboxEntitySchema>;

export const inboxActionSchema = z.object({
   kind: z.enum(["navigate", "rubi", "mutation"]),
   label: z.string(),
   payload: z.unknown().optional(),
});
export type InboxAction = z.infer<typeof inboxActionSchema>;

export const inboxItemDtoSchema = z.object({
   id: z.string(),
   itemKey: z.string(),
   source: inboxSourceSchema,
   severity: inboxSeveritySchema,
   title: z.string(),
   description: z.string().nullable(),
   occurredAt: z.string(),
   readAt: z.string().nullable(),
   isPersisted: z.boolean(),
   entity: inboxEntitySchema,
   actions: z.array(inboxActionSchema),
});
export type InboxItemDto = z.infer<typeof inboxItemDtoSchema>;

export const inboxCountsSchema = z.object({
   total: z.number().int(),
   urgent: z.number().int(),
   warning: z.number().int(),
   info: z.number().int(),
   unread: z.number().int(),
});
export type InboxCounts = z.infer<typeof inboxCountsSchema>;
