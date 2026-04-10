import {
   bulkCreateBankAccounts,
   computeBankAccountBalance,
   createBankAccount,
   deleteBankAccount,
   ensureBankAccountOwnership,
   listBankAccountsWithBalance,
   updateBankAccount,
} from "@core/database/repositories/bank-accounts-repository";
import {
   createBankAccountSchema,
   updateBankAccountSchema,
} from "@core/database/schemas/bank-accounts";
import { z } from "zod";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(createBankAccountSchema)
   .handler(async ({ context, input }) => {
      return createBankAccount(context.db, context.teamId, input);
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   return listBankAccountsWithBalance(context.db, context.teamId);
});

export const getById = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const account = await ensureBankAccountOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      const balance = await computeBankAccountBalance(
         context.db,
         account.id,
         account.initialBalance,
      );
      return { ...account, ...balance };
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateBankAccountSchema))
   .handler(async ({ context, input }) => {
      await ensureBankAccountOwnership(context.db, input.id, context.teamId);
      const { id, ...data } = input;
      return updateBankAccount(context.db, id, data);
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureBankAccountOwnership(context.db, input.id, context.teamId);
      await deleteBankAccount(context.db, input.id);
      return { success: true };
   });

export const bulkCreate = protectedProcedure
   .input(
      z.object({
         accounts: z.array(createBankAccountSchema).min(1).max(500),
      }),
   )
   .handler(async ({ context, input }) => {
      const rows = await bulkCreateBankAccounts(
         context.db,
         context.teamId,
         input.accounts,
      );
      return { created: rows.length };
   });
