import { generate } from "@packages/csv";
import {
   createBankAccount,
   createDefaultBusinessBankAccount,
   createDefaultWalletBankAccount,
   deleteBankAccount,
   deleteBankAccounts,
   findBankAccountById,
   findBankAccountsByIds,
   findBankAccountsByOrganizationId,
   findBankAccountsByOrganizationIdPaginated,
   getBankAccountBalances,
   getBankAccountStats,
   getTotalBankAccountsByOrganizationId,
   updateBankAccount,
   updateBankAccountsStatus,
} from "@packages/database/repositories/bank-account-repository";
import {
   createTransaction,
   findTransactionsByBankAccountIdPaginated,
   findTransactionsForExport,
} from "@packages/database/repositories/transaction-repository";
import { generateOfxContent } from "@packages/ofx";
import { renderBankStatement } from "@packages/pdf";
import {
   calculateDuplicateScore,
   DATE_TOLERANCE_DAYS,
} from "@packages/reconciliation/duplicate-detection";
import { APIError, ErrorCodes } from "@packages/utils/errors";
import { z } from "zod";
import {
   checkResourcePermission,
   getAccessibleResources,
} from "../lib/permission-check";
import { type MemberRole, protectedProcedure, router } from "../trpc";

// Helper to extract permission-related context from protectedProcedure
// The isAuthed middleware guarantees session.user exists and adds memberRole and userId
type ProtectedContext = {
   memberRole?: MemberRole;
   userId: string;
};

const createBankAccountSchema = z.object({
   bank: z.string().min(1, "Bank is required"),
   name: z.string().optional(),
   type: z.enum(["checking", "savings", "investment"]),
});

const updateBankAccountSchema = z.object({
   bank: z.string().min(1, "Bank is required").optional(),
   name: z.string().min(1, "Name is required").optional(),
   status: z.enum(["active", "inactive"]).optional(),
   type: z.enum(["checking", "savings", "investment"]).optional(),
});

const paginationSchema = z.object({
   limit: z.coerce.number().min(1).max(100).default(10),
   orderBy: z.enum(["name", "bank", "createdAt", "updatedAt"]).default("name"),
   orderDirection: z.enum(["asc", "desc"]).default("asc"),
   page: z.coerce.number().min(1).default(1),
   search: z.string().optional(),
   status: z.enum(["active", "inactive"]).optional(),
   type: z.enum(["checking", "savings", "investment"]).optional(),
});

export const bankAccountRouter = router({
   create: protectedProcedure
      .input(createBankAccountSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         // No permission check for create - any org member can create
         // Creator gets implicit access through org membership
         return createBankAccount(resolvedCtx.db, {
            ...input,
            id: crypto.randomUUID(),
            name: input.name || "Conta Bancária",
            organizationId,
         });
      }),

   createDefaultBusiness: protectedProcedure
      .input(
         z.object({ name: z.string().optional(), bank: z.string().optional() }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return createDefaultBusinessBankAccount(
            resolvedCtx.db,
            organizationId,
            input.name,
            input.bank,
         );
      }),

   createDefaultPersonal: protectedProcedure
      .input(
         z.object({ name: z.string().optional(), bank: z.string().optional() }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return createDefaultWalletBankAccount(
            resolvedCtx.db,
            organizationId,
            input.name,
            input.bank,
         );
      }),

   delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;
         const memberRole = ((resolvedCtx as { memberRole?: MemberRole })
            .memberRole ?? "member") as MemberRole;

         const existingBankAccount = await findBankAccountById(
            resolvedCtx.db,
            input.id,
         );

         if (
            !existingBankAccount ||
            existingBankAccount.organizationId !== organizationId
         ) {
            throw APIError.notFound("Bank account not found");
         }

         // Require manage permission to delete
         await checkResourcePermission(
            resolvedCtx.db,
            userId,
            organizationId,
            memberRole,
            "bank_account",
            input.id,
            "manage",
         );

         // Check if this is the last bank account
         const totalAccounts = await getTotalBankAccountsByOrganizationId(
            resolvedCtx.db,
            organizationId,
         );

         if (totalAccounts < 2) {
            throw new APIError(
               ErrorCodes.BAD_REQUEST,
               "Cannot delete the last bank account. You must have at least one bank account.",
            );
         }

         return deleteBankAccount(resolvedCtx.db, input.id);
      }),

   deleteMany: protectedProcedure
      .input(z.object({ ids: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;
         const memberRole = ((resolvedCtx as ProtectedContext).memberRole ??
            "member") as MemberRole;

         // Check manage permission for each bank account
         for (const id of input.ids) {
            await checkResourcePermission(
               resolvedCtx.db,
               userId,
               organizationId,
               memberRole,
               "bank_account",
               id,
               "manage",
            );
         }

         // Check if deleting all bank accounts
         const totalAccounts = await getTotalBankAccountsByOrganizationId(
            resolvedCtx.db,
            organizationId,
         );

         if (totalAccounts <= input.ids.length) {
            throw new APIError(
               ErrorCodes.BAD_REQUEST,
               "Cannot delete all bank accounts. You must have at least one bank account.",
            );
         }

         return deleteBankAccounts(resolvedCtx.db, input.ids, organizationId);
      }),

   exportOfx: protectedProcedure
      .input(
         z.object({
            bankAccountId: z.string(),
            endDate: z.string().optional(),
            startDate: z.string().optional(),
            type: z.enum(["income", "expense", "transfer"]).optional(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;
         const memberRole = ((resolvedCtx as ProtectedContext).memberRole ??
            "member") as MemberRole;

         const bankAccount = await findBankAccountById(
            resolvedCtx.db,
            input.bankAccountId,
         );

         if (!bankAccount || bankAccount.organizationId !== organizationId) {
            throw APIError.notFound("Bank account not found");
         }

         // Require view permission to export
         await checkResourcePermission(
            resolvedCtx.db,
            userId,
            organizationId,
            memberRole,
            "bank_account",
            input.bankAccountId,
            "view",
         );

         const startDate = input.startDate
            ? new Date(input.startDate)
            : undefined;
         const endDate = input.endDate ? new Date(input.endDate) : undefined;

         const transactions = await findTransactionsForExport(
            resolvedCtx.db,
            input.bankAccountId,
            {
               endDate,
               startDate,
               type: input.type,
            },
         );

         const exportTransactions = transactions.map((trn) => ({
            amount: trn.amount,
            date: trn.date,
            description: trn.description,
            externalId: trn.externalId,
            id: trn.id,
            type: trn.type as "income" | "expense" | "transfer",
         }));

         const content = generateOfxContent(exportTransactions, {
            accountId: bankAccount.id,
            accountType: bankAccount.type as
               | "checking"
               | "savings"
               | "investment",
            bankId: bankAccount.bank ?? "000",
            currency: "BRL",
            endDate: endDate ?? new Date(),
            startDate: startDate ?? new Date(0),
         });

         const formatDate = (d: Date) =>
            d.toISOString().split("T")[0]?.replace(/-/g, "") ?? "";
         const accountName =
            bankAccount.name?.replace(/[^a-zA-Z0-9]/g, "_") ?? "conta";
         const filename = `${accountName}_${formatDate(startDate ?? new Date())}_${formatDate(endDate ?? new Date())}.ofx`;

         return {
            content,
            filename,
            transactionCount: transactions.length,
         };
      }),

   exportCsv: protectedProcedure
      .input(
         z.object({
            bankAccountId: z.string(),
            endDate: z.string().optional(),
            startDate: z.string().optional(),
            type: z.enum(["income", "expense", "transfer"]).optional(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;
         const memberRole = ((resolvedCtx as ProtectedContext).memberRole ??
            "member") as MemberRole;

         const bankAccount = await findBankAccountById(
            resolvedCtx.db,
            input.bankAccountId,
         );

         if (!bankAccount || bankAccount.organizationId !== organizationId) {
            throw APIError.notFound("Bank account not found");
         }

         // Require view permission to export
         await checkResourcePermission(
            resolvedCtx.db,
            userId,
            organizationId,
            memberRole,
            "bank_account",
            input.bankAccountId,
            "view",
         );

         const startDate = input.startDate
            ? new Date(input.startDate)
            : undefined;
         const endDate = input.endDate ? new Date(input.endDate) : undefined;

         const transactions = await findTransactionsForExport(
            resolvedCtx.db,
            input.bankAccountId,
            {
               endDate,
               startDate,
               type: input.type,
            },
         );

         // Generate CSV content
         const headers = ["Data", "Descrição", "Valor", "Tipo"];
         const rows = transactions.map((trn) => [
            trn.date.toLocaleDateString("pt-BR"),
            trn.description ?? "",
            trn.type === "expense" ? `-${trn.amount}` : trn.amount.toString(),
            trn.type === "income"
               ? "Receita"
               : trn.type === "expense"
                 ? "Despesa"
                 : "Transferência",
         ]);

         const content = generate([headers, ...rows]);

         const formatDate = (d: Date) =>
            d.toISOString().split("T")[0]?.replace(/-/g, "") ?? "";
         const accountName =
            bankAccount.name?.replace(/[^a-zA-Z0-9]/g, "_") ?? "conta";
         const filename = `${accountName}_${formatDate(startDate ?? new Date())}_${formatDate(endDate ?? new Date())}.csv`;

         return {
            content,
            filename,
            transactionCount: transactions.length,
         };
      }),

   exportPdf: protectedProcedure
      .input(
         z.object({
            bankAccountId: z.string(),
            endDate: z.string().optional(),
            startDate: z.string().optional(),
            type: z.enum(["income", "expense", "transfer"]).optional(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;
         const memberRole = ((resolvedCtx as ProtectedContext).memberRole ??
            "member") as MemberRole;

         const bankAccount = await findBankAccountById(
            resolvedCtx.db,
            input.bankAccountId,
         );

         if (!bankAccount || bankAccount.organizationId !== organizationId) {
            throw APIError.notFound("Bank account not found");
         }

         // Require view permission to export
         await checkResourcePermission(
            resolvedCtx.db,
            userId,
            organizationId,
            memberRole,
            "bank_account",
            input.bankAccountId,
            "view",
         );

         const startDate = input.startDate
            ? new Date(input.startDate)
            : undefined;
         const endDate = input.endDate ? new Date(input.endDate) : undefined;

         const transactions = await findTransactionsForExport(
            resolvedCtx.db,
            input.bankAccountId,
            {
               endDate,
               startDate,
               type: input.type,
            },
         );

         const formatDateForFilename = (d: Date) =>
            d.toISOString().split("T")[0]?.replace(/-/g, "") ?? "";
         const accountName =
            bankAccount.name?.replace(/[^a-zA-Z0-9]/g, "_") ?? "conta";
         const filename = `${accountName}_${formatDateForFilename(startDate ?? new Date())}_${formatDateForFilename(endDate ?? new Date())}.pdf`;

         // Render PDF server-side using @react-pdf/renderer
         const pdfBuffer = await renderBankStatement({
            bankAccount: {
               name: bankAccount.name,
               bank: bankAccount.bank,
               type: bankAccount.type,
            },
            transactions: transactions.map((trn) => ({
               date: trn.date.toISOString(),
               description: trn.description,
               amount: trn.amount,
               type: trn.type as string,
            })),
            period: {
               startDate: startDate?.toISOString(),
               endDate: endDate?.toISOString(),
            },
            generatedAt: new Date().toISOString(),
         });

         // Convert Buffer to base64 for transmission
         const content = pdfBuffer.toString("base64");

         return {
            content,
            filename,
            transactionCount: transactions.length,
         };
      }),

   getAll: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;
      const userId = resolvedCtx.userId;
      const memberRole = ((resolvedCtx as ProtectedContext).memberRole ??
         "member") as MemberRole;

      // Get accessible bank accounts based on permissions
      const { isOwner, resourceIds } = await getAccessibleResources(
         resolvedCtx.db,
         userId,
         organizationId,
         memberRole,
         "bank_account",
         "view",
      );

      // Owners see all bank accounts
      if (isOwner) {
         return findBankAccountsByOrganizationId(
            resolvedCtx.db,
            organizationId,
         );
      }

      // Non-owners only see bank accounts they have access to
      if (!resourceIds || resourceIds.length === 0) {
         return [];
      }

      return findBankAccountsByIds(resolvedCtx.db, resourceIds, organizationId);
   }),

   getAllPaginated: protectedProcedure
      .input(paginationSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return findBankAccountsByOrganizationIdPaginated(
            resolvedCtx.db,
            organizationId,
            {
               limit: input.limit,
               orderBy: input.orderBy,
               orderDirection: input.orderDirection,
               page: input.page,
               search: input.search,
               status: input.status,
               type: input.type,
            },
         );
      }),

   getBalances: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      return getBankAccountBalances(resolvedCtx.db, organizationId);
   }),

   getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;
         const memberRole = ((resolvedCtx as ProtectedContext).memberRole ??
            "member") as MemberRole;

         const bankAccount = await findBankAccountById(
            resolvedCtx.db,
            input.id,
         );

         if (!bankAccount || bankAccount.organizationId !== organizationId) {
            throw APIError.notFound("Bank account not found");
         }

         // Require view permission
         await checkResourcePermission(
            resolvedCtx.db,
            userId,
            organizationId,
            memberRole,
            "bank_account",
            input.id,
            "view",
         );

         return bankAccount;
      }),

   getStats: protectedProcedure
      .input(
         z
            .object({
               status: z.enum(["active", "inactive"]).optional(),
               type: z.enum(["checking", "savings", "investment"]).optional(),
            })
            .optional(),
      )
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return getBankAccountStats(resolvedCtx.db, organizationId, {
            status: input?.status,
            type: input?.type,
         });
      }),

   getTransactions: protectedProcedure
      .input(
         z.object({
            categoryId: z.string().optional(),
            endDate: z.string().optional(),
            id: z.string(),
            limit: z.number().min(1).max(100).default(10),
            page: z.number().min(1).default(1),
            search: z.string().optional(),
            startDate: z.string().optional(),
            type: z.enum(["income", "expense", "transfer"]).optional(),
         }),
      )
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;
         const memberRole = ((resolvedCtx as ProtectedContext).memberRole ??
            "member") as MemberRole;

         const bankAccount = await findBankAccountById(
            resolvedCtx.db,
            input.id,
         );

         if (!bankAccount || bankAccount.organizationId !== organizationId) {
            throw APIError.notFound("Bank account not found");
         }

         // Require view permission
         await checkResourcePermission(
            resolvedCtx.db,
            userId,
            organizationId,
            memberRole,
            "bank_account",
            input.id,
            "view",
         );

         return findTransactionsByBankAccountIdPaginated(
            resolvedCtx.db,
            input.id,
            {
               categoryId: input.categoryId,
               endDate: input.endDate ? new Date(input.endDate) : undefined,
               limit: input.limit,
               page: input.page,
               search: input.search,
               startDate: input.startDate
                  ? new Date(input.startDate)
                  : undefined,
               type: input.type,
            },
         );
      }),

   importTransactions: protectedProcedure
      .input(
         z.object({
            bankAccountId: z.string(),
            transactions: z.array(
               z.object({
                  date: z.string(),
                  amount: z.number(),
                  description: z.string(),
                  type: z.enum(["income", "expense", "zero"]),
                  externalId: z.string().optional(),
               }),
            ),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;
         const memberRole = ((resolvedCtx as ProtectedContext).memberRole ??
            "member") as MemberRole;

         const bankAccount = await findBankAccountById(
            resolvedCtx.db,
            input.bankAccountId,
         );

         if (!bankAccount || bankAccount.organizationId !== organizationId) {
            throw APIError.notFound("Bank account not found");
         }

         // Require edit permission to import transactions
         await checkResourcePermission(
            resolvedCtx.db,
            userId,
            organizationId,
            memberRole,
            "bank_account",
            input.bankAccountId,
            "edit",
         );

         const createdTransactions = [];

         for (const trn of input.transactions) {
            // Skip duplicates if externalId is provided (OFX imports)
            const externalId = trn.externalId;
            if (externalId) {
               const existingTransaction =
                  await resolvedCtx.db.query.transaction.findFirst({
                     where: (transaction, { eq, and }) =>
                        and(
                           eq(transaction.bankAccountId, input.bankAccountId),
                           eq(transaction.externalId, externalId),
                        ),
                  });
               if (existingTransaction) continue;
            }

            const newTransaction = await createTransaction(resolvedCtx.db, {
               amount: trn.amount.toString(),
               bankAccountId: input.bankAccountId,
               date: new Date(trn.date),
               description: trn.description,
               externalId: trn.externalId,
               id: crypto.randomUUID(),
               organizationId,
               type: trn.type,
            });
            createdTransactions.push(newTransaction);
         }

         return {
            imported: createdTransactions.length,
            total: input.transactions.length,
         };
      }),

   checkCsvDuplicates: protectedProcedure
      .input(
         z.object({
            bankAccountId: z.string(),
            transactions: z.array(
               z.object({
                  rowIndex: z.number(),
                  date: z.string(),
                  amount: z.number(),
                  description: z.string(),
               }),
            ),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;
         const memberRole = ((resolvedCtx as ProtectedContext).memberRole ??
            "member") as MemberRole;

         const bankAccount = await findBankAccountById(
            resolvedCtx.db,
            input.bankAccountId,
         );

         if (!bankAccount || bankAccount.organizationId !== organizationId) {
            throw APIError.notFound("Bank account not found");
         }

         // Require view permission to check duplicates
         await checkResourcePermission(
            resolvedCtx.db,
            userId,
            organizationId,
            memberRole,
            "bank_account",
            input.bankAccountId,
            "view",
         );

         const duplicates: Array<{
            rowIndex: number;
            existingTransactionId: string;
            existingTransactionDate: string;
            existingTransactionDescription: string;
         }> = [];

         for (const trn of input.transactions) {
            const trnDate = new Date(trn.date);
            const startOfDay = new Date(trnDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(trnDate);
            endOfDay.setHours(23, 59, 59, 999);

            const existingTransaction =
               await resolvedCtx.db.query.transaction.findFirst({
                  where: (transaction, { eq, and, gte, lte }) =>
                     and(
                        eq(transaction.bankAccountId, input.bankAccountId),
                        eq(transaction.amount, trn.amount.toString()),
                        eq(transaction.description, trn.description),
                        gte(transaction.date, startOfDay),
                        lte(transaction.date, endOfDay),
                     ),
               });

            if (existingTransaction) {
               duplicates.push({
                  rowIndex: trn.rowIndex,
                  existingTransactionId: existingTransaction.id,
                  existingTransactionDate:
                     existingTransaction.date.toISOString(),
                  existingTransactionDescription:
                     existingTransaction.description ?? "",
               });
            }
         }

         return { duplicates };
      }),

   checkBatchDuplicates: protectedProcedure
      .input(
         z.object({
            bankAccountId: z.string(),
            transactions: z.array(
               z.object({
                  rowIndex: z.number(),
                  fileIndex: z.number(),
                  date: z.string(),
                  amount: z.number(),
                  description: z.string(),
               }),
            ),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;
         const memberRole = ((resolvedCtx as ProtectedContext).memberRole ??
            "member") as MemberRole;

         const bankAccount = await findBankAccountById(
            resolvedCtx.db,
            input.bankAccountId,
         );

         if (!bankAccount || bankAccount.organizationId !== organizationId) {
            throw APIError.notFound("Bank account not found");
         }

         // Require view permission to check duplicates
         await checkResourcePermission(
            resolvedCtx.db,
            userId,
            organizationId,
            memberRole,
            "bank_account",
            input.bankAccountId,
            "view",
         );

         const duplicates: Array<{
            rowIndex: number;
            fileIndex: number;
            existingTransactionId: string;
            existingTransactionDate: string;
            existingTransactionDescription: string;
            duplicateType: "within_batch" | "existing_database";
            matchScore: number;
            matchedFileIndex?: number;
            matchedRowIndex?: number;
         }> = [];

         // Check within-batch duplicates
         for (let i = 0; i < input.transactions.length; i++) {
            const candidate = input.transactions[i];
            if (!candidate) continue;

            for (let j = i + 1; j < input.transactions.length; j++) {
               const target = input.transactions[j];
               if (!target) continue;

               const { scorePercentage, passed } = calculateDuplicateScore(
                  {
                     date: new Date(candidate.date),
                     amount: candidate.amount,
                     description: candidate.description,
                  },
                  {
                     date: new Date(target.date),
                     amount: target.amount,
                     description: target.description,
                  },
               );

               if (passed) {
                  duplicates.push({
                     rowIndex: target.rowIndex,
                     fileIndex: target.fileIndex,
                     existingTransactionId: "",
                     existingTransactionDate: candidate.date,
                     existingTransactionDescription: candidate.description,
                     duplicateType: "within_batch",
                     matchScore: scorePercentage,
                     matchedFileIndex: candidate.fileIndex,
                     matchedRowIndex: candidate.rowIndex,
                  });
               }
            }
         }

         // Check against existing database transactions
         for (const trn of input.transactions) {
            const trnDate = new Date(trn.date);
            // Extended date range for weighted matching
            const startDate = new Date(trnDate);
            startDate.setDate(startDate.getDate() - DATE_TOLERANCE_DAYS);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(trnDate);
            endDate.setDate(endDate.getDate() + DATE_TOLERANCE_DAYS);
            endDate.setHours(23, 59, 59, 999);

            // Find potential matches within date range
            const potentialMatches =
               await resolvedCtx.db.query.transaction.findMany({
                  where: (transaction, { eq, and, gte, lte }) =>
                     and(
                        eq(transaction.bankAccountId, input.bankAccountId),
                        eq(transaction.amount, trn.amount.toString()),
                        gte(transaction.date, startDate),
                        lte(transaction.date, endDate),
                     ),
                  limit: 10,
               });

            for (const existingTrn of potentialMatches) {
               const { scorePercentage, passed } = calculateDuplicateScore(
                  {
                     date: trnDate,
                     amount: trn.amount,
                     description: trn.description,
                  },
                  {
                     date: existingTrn.date,
                     amount: Number.parseFloat(existingTrn.amount),
                     description: existingTrn.description ?? "",
                  },
               );

               if (passed) {
                  duplicates.push({
                     rowIndex: trn.rowIndex,
                     fileIndex: trn.fileIndex,
                     existingTransactionId: existingTrn.id,
                     existingTransactionDate: existingTrn.date.toISOString(),
                     existingTransactionDescription:
                        existingTrn.description ?? "",
                     duplicateType: "existing_database",
                     matchScore: scorePercentage,
                  });
                  // Only keep first match for each transaction
                  break;
               }
            }
         }

         return { duplicates };
      }),

   update: protectedProcedure
      .input(
         z.object({
            data: updateBankAccountSchema,
            id: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;
         const memberRole = ((resolvedCtx as ProtectedContext).memberRole ??
            "member") as MemberRole;

         const existingBankAccount = await findBankAccountById(
            resolvedCtx.db,
            input.id,
         );

         if (
            !existingBankAccount ||
            existingBankAccount.organizationId !== organizationId
         ) {
            throw APIError.notFound("Bank account not found");
         }

         // Require edit permission to update
         await checkResourcePermission(
            resolvedCtx.db,
            userId,
            organizationId,
            memberRole,
            "bank_account",
            input.id,
            "edit",
         );

         const updateData: {
            type?: "checking" | "savings" | "investment";
            bank?: string;
            name?: string;
            status?: "active" | "inactive";
         } = {};
         if (input.data.bank) updateData.bank = input.data.bank;
         if (input.data.name) updateData.name = input.data.name;
         if (input.data.status) updateData.status = input.data.status;
         if (input.data.type) {
            updateData.type = input.data.type as
               | "checking"
               | "savings"
               | "investment";
         }
         return updateBankAccount(resolvedCtx.db, input.id, updateData);
      }),

   updateStatus: protectedProcedure
      .input(
         z.object({
            ids: z.array(z.string()),
            status: z.enum(["active", "inactive"]),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;
         const memberRole = ((resolvedCtx as ProtectedContext).memberRole ??
            "member") as MemberRole;

         // Check edit permission for each bank account
         for (const id of input.ids) {
            await checkResourcePermission(
               resolvedCtx.db,
               userId,
               organizationId,
               memberRole,
               "bank_account",
               id,
               "edit",
            );
         }

         return updateBankAccountsStatus(
            resolvedCtx.db,
            input.ids,
            input.status,
            organizationId,
         );
      }),
});
