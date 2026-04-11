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
import { emitFinanceBankAccountConnected } from "@packages/events/finance";
import { createBillableProcedure } from "../billable";
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
         context.db,
         context.teamId!,
         input.includeArchived,
      );
      return accounts.map(mapAccount);
   });

export const get = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const account = await ensureBankAccountOwnership(
         context.db,
         input.id,
         context.teamId!,
      );
      const { currentBalance, projectedBalance } =
         await computeBankAccountBalance(
            context.db,
            account.id,
            account.initialBalance,
         );
      return mapAccount({ ...account, currentBalance, projectedBalance });
   });

export const create = createBillableProcedure("finance.bank_account_connected")
   .input(CreateBankAccountSchema)
   .handler(async ({ context, input }) => {
      const account = await createBankAccount(
         context.db,
         context.teamId!,
         input,
      );
      const { currentBalance, projectedBalance } =
         await computeBankAccountBalance(
            context.db,
            account.id,
            account.initialBalance,
         );
      const eventType =
         account.type === "payment"
            ? ("other" as const)
            : (account.type as Exclude<typeof account.type, "payment">);
      context.scheduleEmit(() =>
         emitFinanceBankAccountConnected(context.emit, context.emitCtx, {
            bankAccountId: account.id,
            type: eventType,
         }),
      );
      return mapAccount({ ...account, currentBalance, projectedBalance });
   });

export const update = sdkProcedure
   .input(z.object({ id: z.string().uuid() }).merge(UpdateBankAccountSchema))
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      await ensureBankAccountOwnership(context.db, id, context.teamId!);
      const account = await updateBankAccount(context.db, id, data);
      const { currentBalance, projectedBalance } =
         await computeBankAccountBalance(
            context.db,
            account.id,
            account.initialBalance,
         );
      return mapAccount({ ...account, currentBalance, projectedBalance });
   });

export const remove = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureBankAccountOwnership(context.db, input.id, context.teamId!);
      await deleteBankAccount(context.db, input.id);
      return { success: true as const };
   });
