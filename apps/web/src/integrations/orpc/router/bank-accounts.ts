import {
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
      return createBankAccount(context.teamId, input);
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   return listBankAccountsWithBalance(context.teamId);
});

export const getById = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const account = await ensureBankAccountOwnership(
         input.id,
         context.teamId,
      );
      const balance = await computeBankAccountBalance(
         account.id,
         account.initialBalance,
      );
      return { ...account, ...balance };
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateBankAccountSchema))
   .handler(async ({ context, input }) => {
      await ensureBankAccountOwnership(input.id, context.teamId);
      const { id, ...data } = input;
      return updateBankAccount(id, data);
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureBankAccountOwnership(input.id, context.teamId);
      await deleteBankAccount(input.id);
      return { success: true };
   });
