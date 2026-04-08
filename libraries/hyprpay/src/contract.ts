import { oc } from "@orpc/contract";
import { z } from "zod";

const customerSchema = z.object({
   id: z.string(),
   teamId: z.string(),
   name: z.string(),
   email: z.string().nullable(),
   phone: z.string().nullable(),
   document: z.string().nullable(),
   externalId: z.string().nullable(),
   createdAt: z.string(),
   updatedAt: z.string(),
});

const listResultSchema = z.object({
   items: z.array(customerSchema),
   total: z.number(),
   page: z.number(),
   limit: z.number(),
   pages: z.number(),
});

export const hyprpayContract = {
   create: oc
      .input(
         z.object({
            name: z.string().min(1),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            document: z.string().optional(),
            externalId: z.string().optional(),
         }),
      )
      .output(customerSchema),

   get: oc.input(z.object({ externalId: z.string() })).output(customerSchema),

   list: oc
      .input(
         z.object({
            page: z.number().int().min(1).default(1),
            limit: z.number().int().min(1).max(100).default(20),
         }),
      )
      .output(listResultSchema),

   update: oc
      .input(
         z.object({
            externalId: z.string(),
            name: z.string().min(1).optional(),
            email: z.string().email().nullable().optional(),
            phone: z.string().nullable().optional(),
         }),
      )
      .output(customerSchema),
};

export type HyprPayCustomerFromContract = z.infer<typeof customerSchema>;
