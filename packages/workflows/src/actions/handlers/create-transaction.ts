import type { Consequence } from "@packages/database/schema";
import { transaction } from "@packages/database/schema";
import { of, toDecimal } from "@packages/money";
import {
   createTemplateContext,
   getNestedValue,
   renderTemplate,
} from "../../utils/template";
import {
   type ActionHandler,
   type ActionHandlerContext,
   createActionResult,
   createSkippedResult,
} from "../types";

export const createTransactionHandler: ActionHandler = {
   type: "create_transaction",

   async execute(consequence: Consequence, context: ActionHandlerContext) {
      const {
         type,
         description,
         bankAccountId,
         amountField,
         amountFixed,
         dateField,
      } = consequence.payload;

      if (type !== "income" && type !== "expense") {
         return createSkippedResult(
            consequence,
            "Transaction type must be 'income' or 'expense'",
         );
      }

      if (!description) {
         return createSkippedResult(consequence, "Description is required");
      }

      if (!bankAccountId) {
         return createSkippedResult(consequence, "Bank account ID is required");
      }

      let amount: number;
      if (amountFixed !== undefined) {
         amount = amountFixed;
      } else if (amountField) {
         const amountValue = getNestedValue(context.eventData, amountField);
         if (typeof amountValue !== "number") {
            return createActionResult(
               consequence,
               false,
               undefined,
               `Amount field "${amountField}" is not a number`,
            );
         }
         amount = amountValue;
      } else {
         return createSkippedResult(consequence, "No amount source provided");
      }

      const templateContext = createTemplateContext(context.eventData);
      const processedDescription = renderTemplate(description, templateContext);

      let transactionDate = new Date();
      if (dateField) {
         const dateValue = getNestedValue(context.eventData, dateField);
         if (dateValue) {
            transactionDate = new Date(dateValue as string | number | Date);
         }
      }

      if (context.dryRun) {
         return createActionResult(consequence, true, {
            amount,
            bankAccountId,
            date: transactionDate.toISOString(),
            description: processedDescription,
            dryRun: true,
            type,
         });
      }

      try {
         const result = await context.db
            .insert(transaction)
            .values({
               amount: toDecimal(of(String(Math.abs(amount)), "BRL")),
               bankAccountId,
               date: transactionDate,
               description: processedDescription,
               organizationId: context.organizationId,
               type,
            })
            .returning();

         return createActionResult(consequence, true, {
            createdTransaction: result[0],
         });
      } catch (error) {
         const message =
            error instanceof Error ? error.message : "Unknown error";
         return createActionResult(consequence, false, undefined, message);
      }
   },

   validate(config) {
      const errors: string[] = [];
      if (!config.type || !["income", "expense"].includes(config.type)) {
         errors.push("Valid transaction type (income or expense) is required");
      }
      if (!config.description) {
         errors.push("Description is required");
      }
      if (!config.bankAccountId) {
         errors.push("Bank account ID is required");
      }
      if (config.amountFixed === undefined && !config.amountField) {
         errors.push("Either fixed amount or amount field is required");
      }
      return { errors, valid: errors.length === 0 };
   },
};
