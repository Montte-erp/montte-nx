import z from "zod";

export const createBillSchema = z.object({
   amount: z.number().positive("Valor deve ser maior que zero"),
   autoCreateNext: z.boolean().optional().default(true),
   bankAccountId: z.string().optional(),
   categoryId: z.string().optional(),
   costCenterId: z.string().uuid().optional(),
   counterpartyId: z.string().optional(),
   description: z.string().optional(),
   dueDate: z.date(),
   installmentGroupId: z.string().optional(),
   installmentIntervalDays: z.number().optional(),
   installmentNumber: z.number().optional(),
   interestTemplateId: z.string().optional(),
   isRecurring: z.boolean().optional().default(false),
   issueDate: z.date().optional(),
   notes: z.string().optional(),
   occurrenceCount: z.number().min(1).max(365).optional(),
   occurrenceUntilDate: z.date().optional(),
   originalAmount: z.number().optional(),
   recurrencePattern: z
      .enum([
         "daily",
         "weekly",
         "biweekly",
         "monthly",
         "quarterly",
         "semiannual",
         "annual",
      ])
      .optional(),
   tagIds: z.array(z.string().uuid()).optional(),
   totalInstallments: z.number().optional(),
   type: z.enum(["expense", "income"], { error: "Tipo é obrigatório" }),
});

export const installmentConfigSchema = z.object({
   amounts: z.union([z.literal("equal"), z.array(z.number().positive())]),
   intervalDays: z.number().min(1).max(365),
   totalInstallments: z.number().min(2).max(120),
});

export const createBillWithInstallmentsSchema = z
   .object({
      amount: z.number().positive("Valor deve ser maior que zero"),
      bankAccountId: z.string().optional(),
      categoryId: z.string().optional(),
      costCenterId: z.string().uuid().optional(),
      counterpartyId: z.string().optional(),
      description: z.string().optional(),
      dueDate: z.date(),
      installments: installmentConfigSchema,
      interestTemplateId: z.string().optional(),
      issueDate: z.string().optional(),
      notes: z.string().optional(),
      tagIds: z.array(z.string().uuid()).optional(),
      type: z.enum(["expense", "income"], { error: "Tipo é obrigatório" }),
   })
   .refine(
      (data) => {
         if (Array.isArray(data.installments.amounts)) {
            const sum = data.installments.amounts.reduce((a, b) => a + b, 0);
            return Math.abs(sum - data.amount) < 0.01;
         }
         return true;
      },
      { message: "A soma das parcelas deve ser igual ao valor total" },
   );
