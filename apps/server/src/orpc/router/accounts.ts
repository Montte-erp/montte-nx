import { z } from "zod";
import {
   listBankAccountsWithBalance,
   ensureBankAccountOwnership,
   createBankAccount,
   updateBankAccount,
   deleteBankAccount,
   computeBankAccountBalance,
} from "@core/database/repositories/bank-accounts-repository";
import {
   CreateBankAccountSchema,
   UpdateBankAccountSchema,
} from "@montte/cli/contract";
import { sdkProcedure } from "../server";

function mapAccount(account: Record<string, unknown>) {
   return {
      ...account,
      createdAt: (account.createdAt as Date).toISOString(),
      updatedAt: (account.updatedAt as Date).toISOString(),
   };
}

export const list = sdkProcedure
   .input(z.object({ includeArchived: z.boolean().optional() }))
   .handler(async ({ context, input }) => {
      const accounts = await listBankAccountsWithBalance(
         context.teamId!,
         input.includeArchived,
      );
      return accounts.map(mapAccount);
   });

export const get = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const account = await ensureBankAccountOwnership(
         input.id,
         context.teamId!,
      );
      const { currentBalance, projectedBalance } =
         await computeBankAccountBalance(account.id, account.initialBalance);
      return mapAccount({ ...account, currentBalance, projectedBalance });
   });

export const create = sdkProcedure
   .input(CreateBankAccountSchema)
   .handler(async ({ context, input }) => {
      const account = await createBankAccount(context.teamId!, input);
      const { currentBalance, projectedBalance } =
         await computeBankAccountBalance(account.id, account.initialBalance);
      return mapAccount({ ...account, currentBalance, projectedBalance });
   });

export const update = sdkProcedure
   .input(z.object({ id: z.string().uuid() }).merge(UpdateBankAccountSchema))
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      await ensureBankAccountOwnership(id, context.teamId!);
      const account = await updateBankAccount(id, data);
      const { currentBalance, projectedBalance } =
         await computeBankAccountBalance(account.id, account.initialBalance);
      return mapAccount({ ...account, currentBalance, projectedBalance });
   });

export const remove = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureBankAccountOwnership(input.id, context.teamId!);
      await deleteBankAccount(input.id);
      return { success: true as const };
   });
