import { z } from "zod";

export const getUsageSummaryInputSchema = z.object({
   customerId: z.string(),
});

export const getCustomerPortalSessionInputSchema = z.object({
   customerId: z.string(),
});

export type GetUsageSummaryInput = z.infer<typeof getUsageSummaryInputSchema>;
export type GetCustomerPortalSessionInput = z.infer<
   typeof getCustomerPortalSessionInputSchema
>;
