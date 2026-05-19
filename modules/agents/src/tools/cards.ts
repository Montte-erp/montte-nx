import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import type { AgentReadClient } from "@modules/agents/tools/registry";

const uuid = z.string().uuid();

const listCreditCardsInputSchema = z.object({
   query: z.string().trim().min(1).max(100).optional(),
   status: z.enum(["active", "blocked", "cancelled"]).optional(),
   limit: z.number().int().min(1).max(50).default(20),
});

const creditCardSchema = z.object({
   id: uuid,
   name: z.string(),
   brand: z
      .enum(["visa", "mastercard", "elo", "amex", "hipercard", "other"])
      .nullable(),
   last4: z.string().nullable(),
   creditLimit: z.string(),
   closingDay: z.number().int(),
   dueDay: z.number().int(),
   status: z.enum(["active", "blocked", "cancelled"]),
   bankAccountId: uuid,
});

const listCreditCardsOutputSchema = z.object({
   data: z.array(creditCardSchema),
   total: z.number().int().nonnegative(),
   limit: z.number().int().positive(),
});

const listCardStatementsInputSchema = z.object({
   creditCardId: uuid.optional(),
   statementPeriod: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/u)
      .optional(),
   status: z.enum(["open", "closed", "paid"]).optional(),
   limit: z.number().int().min(1).max(50).default(20),
});

const cardStatementSchema = z.object({
   id: uuid,
   creditCardId: uuid,
   statementPeriod: z.string(),
   status: z.enum(["open", "closed", "paid"]),
   closingDate: z.string(),
   dueDate: z.string(),
   totalPurchases: z.string(),
   transactionCount: z.number().int().nonnegative(),
});

const listCardStatementsOutputSchema = z.object({
   data: z.array(cardStatementSchema),
   total: z.number().int().nonnegative(),
   limit: z.number().int().positive(),
});

interface CardsReadToolDeps {
   client: AgentReadClient;
}

export function buildCardsReadTools({ client }: CardsReadToolDeps) {
   return [
      toolDefinition({
         name: "list_credit_cards",
         description:
            "Lista cartões de crédito cadastrados. Use para identificar cartão, limite, fechamento, vencimento e status.",
         inputSchema: listCreditCardsInputSchema,
         outputSchema: listCreditCardsOutputSchema,
      }).server(async (input) => {
         const limit = input.limit ?? 20;
         const result = await client.creditCards.getAll({
            page: 1,
            pageSize: limit,
            search: input.query,
            status: input.status,
         });

         return {
            data: result.data.map((card) => ({
               id: card.id,
               name: card.name,
               brand: card.brand,
               last4: card.last4,
               creditLimit: card.creditLimit,
               closingDay: card.closingDay,
               dueDay: card.dueDay,
               status: card.status,
               bankAccountId: card.bankAccountId,
            })),
            total: result.totalCount,
            limit,
         };
      }),
      toolDefinition({
         name: "list_card_statements",
         description:
            "Lista faturas de cartão por cartão, competência ou status. Use para responder sobre faturas abertas, fechadas ou pagas.",
         inputSchema: listCardStatementsInputSchema,
         outputSchema: listCardStatementsOutputSchema,
      }).server(async (input) => {
         const limit = input.limit ?? 20;
         const result = await client.statements.getAll({
            page: 1,
            pageSize: limit,
            creditCardId: input.creditCardId,
            statementPeriod: input.statementPeriod,
            status: input.status,
         });

         return {
            data: result.data.map((statement) => ({
               id: statement.id,
               creditCardId: statement.creditCardId,
               statementPeriod: statement.statementPeriod,
               status: statement.status,
               closingDate: statement.closingDate,
               dueDate: statement.dueDate,
               totalPurchases: statement.totalPurchases,
               transactionCount: statement.transactionCount,
            })),
            total: result.totalCount,
            limit,
         };
      }),
   ];
}
