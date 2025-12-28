import {
   createBillAttachment,
   deleteBillAttachment,
   findBillAttachmentById,
   findBillAttachmentsByBillId,
} from "@packages/database/repositories/bill-attachment-repository";
import {
   completeManyBills,
   createBill,
   createBillWithInstallments,
   deleteBill,
   deleteManyBills,
   findBillById,
   findBillByTransactionId,
   findBillsByInstallmentGroupId,
   findBillsByOrganizationId,
   findBillsByOrganizationIdAndType,
   findBillsByOrganizationIdFiltered,
   findBillsByOrganizationIdPaginated,
   findCompletedBillsByOrganizationId,
   findOverdueBillsByOrganizationId,
   findPendingBillsByOrganizationId,
   getTotalBillsByOrganizationId,
   getTotalOverdueBillsByOrganizationId,
   getTotalOverduePayablesByOrganizationId,
   getTotalOverdueReceivablesByOrganizationId,
   getTotalPendingPayablesByOrganizationId,
   getTotalPendingReceivablesByOrganizationId,
   type NewBill,
   updateBill,
} from "@packages/database/repositories/bill-repository";
import {
   findTagsByBillId,
   findTagsByOrganizationId,
   setBillTags,
} from "@packages/database/repositories/tag-repository";
import { createTransaction } from "@packages/database/repositories/transaction-repository";
import {
   deleteFile,
   generatePresignedPutUrl,
   streamFileForProxy,
   verifyFileExists,
} from "@packages/files/client";
import { APIError } from "@packages/utils/errors";
import {
   generateFutureDates,
   generateFutureDatesUntil,
   getNextDueDate,
   type RecurrencePattern,
} from "@packages/utils/recurrence";
import { z } from "zod";
import {
   createBillSchema,
   createBillWithInstallmentsSchema,
} from "../schemas/bill";
import { protectedProcedure, router } from "../trpc";

const ALLOWED_ATTACHMENT_TYPES = [
   "application/pdf",
   "image/jpeg",
   "image/png",
   "image/webp",
];
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

const updateBillSchema = z.object({
   amount: z.number().optional(),
   autoCreateNext: z.boolean().optional(),
   bankAccountId: z.string().optional(),
   categoryId: z.string().optional(),
   costCenterId: z.string().uuid().nullable().optional(),
   counterpartyId: z.string().nullable().optional(),
   description: z.string().optional(),
   dueDate: z.string().optional(),
   interestTemplateId: z.string().nullable().optional(),
   isRecurring: z.boolean().optional(),
   issueDate: z.string().optional(),
   notes: z.string().optional(),
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
   type: z.enum(["income", "expense"]).optional(),
});

const completeBillSchema = z.object({
   bankAccountId: z.string().optional(),
   completionDate: z.string(),
});

const paginationSchema = z.object({
   endDate: z.string().optional(),
   limit: z.coerce.number().min(1).max(100).default(5),
   month: z.string().optional(),
   orderBy: z
      .enum(["dueDate", "issueDate", "amount", "createdAt"])
      .default("dueDate"),
   orderDirection: z.enum(["asc", "desc"]).default("desc"),
   page: z.coerce.number().min(1).default(1),
   search: z.string().optional(),
   startDate: z.string().optional(),
   type: z.enum(["income", "expense"]).optional(),
});

const filterSchema = z.object({
   month: z.string().optional(),
   orderBy: z
      .enum(["dueDate", "issueDate", "amount", "createdAt"])
      .default("dueDate"),
   orderDirection: z.enum(["asc", "desc"]).default("desc"),
   type: z.enum(["income", "expense"]).optional(),
});

export const billRouter = router({
   requestAttachmentUploadUrl: protectedProcedure
      .input(
         z.object({
            billId: z.string(),
            contentType: z
               .string()
               .refine((val) => ALLOWED_ATTACHMENT_TYPES.includes(val), {
                  message: "File type must be PDF, JPEG, PNG, or WebP",
               }),
            fileName: z.string(),
            fileSize: z
               .number()
               .max(MAX_ATTACHMENT_SIZE, "File size must be less than 10MB"),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const { billId, fileName, contentType, fileSize } = input;
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingBill = await findBillById(resolvedCtx.db, billId);

         if (!existingBill || existingBill.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         const attachmentId = crypto.randomUUID();
         const storageKey = `bills/${organizationId}/${billId}/attachments/${attachmentId}/${fileName}`;
         const bucketName = resolvedCtx.minioBucket;
         const minioClient = resolvedCtx.minioClient;

         const presignedUrl = await generatePresignedPutUrl(
            storageKey,
            bucketName,
            minioClient,
            300,
         );

         return {
            presignedUrl,
            storageKey,
            attachmentId,
            contentType,
            fileSize,
         };
      }),

   confirmAttachmentUpload: protectedProcedure
      .input(
         z.object({
            attachmentId: z.string(),
            billId: z.string(),
            contentType: z.string(),
            fileName: z.string(),
            fileSize: z.number(),
            storageKey: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const {
            attachmentId,
            billId,
            contentType,
            fileName,
            fileSize,
            storageKey,
         } = input;
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingBill = await findBillById(resolvedCtx.db, billId);

         if (!existingBill || existingBill.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         if (
            !storageKey.startsWith(
               `bills/${organizationId}/${billId}/attachments/`,
            )
         ) {
            throw APIError.validation("Invalid storage key for this bill");
         }

         const bucketName = resolvedCtx.minioBucket;
         const minioClient = resolvedCtx.minioClient;

         const fileInfo = await verifyFileExists(
            storageKey,
            bucketName,
            minioClient,
         );

         if (!fileInfo) {
            throw APIError.validation("File was not uploaded successfully");
         }

         const attachment = await createBillAttachment(resolvedCtx.db, {
            billId,
            contentType,
            fileName,
            fileSize: fileSize || fileInfo.size,
            id: attachmentId,
            storageKey,
         });

         return attachment;
      }),

   cancelAttachmentUpload: protectedProcedure
      .input(
         z.object({
            billId: z.string(),
            storageKey: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const { billId, storageKey } = input;
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingBill = await findBillById(resolvedCtx.db, billId);

         if (!existingBill || existingBill.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         if (
            !storageKey.startsWith(
               `bills/${organizationId}/${billId}/attachments/`,
            )
         ) {
            throw APIError.validation("Invalid storage key for this bill");
         }

         const bucketName = resolvedCtx.minioBucket;
         const minioClient = resolvedCtx.minioClient;

         try {
            await deleteFile(storageKey, bucketName, minioClient);
         } catch (error) {
            console.error("Error deleting cancelled upload:", error);
         }

         return { success: true };
      }),

   complete: protectedProcedure
      .input(
         z.object({
            data: completeBillSchema,
            id: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingBill = await findBillById(resolvedCtx.db, input.id);

         if (!existingBill || existingBill.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         if (existingBill.completionDate) {
            throw APIError.conflict("Bill already completed");
         }

         const transaction = await createTransaction(resolvedCtx.db, {
            amount: existingBill.amount,
            bankAccountId:
               input.data.bankAccountId ||
               existingBill.bankAccountId ||
               undefined,
            date: new Date(input.data.completionDate),
            description: existingBill.description,
            id: crypto.randomUUID(),
            organizationId,
            type: existingBill.type as "income" | "expense",
         });

         const updatedBill = await updateBill(resolvedCtx.db, input.id, {
            completionDate: new Date(input.data.completionDate),
            transactionId: transaction.id,
         });

         return updatedBill;
      }),

   completeMany: protectedProcedure
      .input(
         z.object({
            completionDate: z.string(),
            ids: z.array(z.string()),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const result = await completeManyBills(
            resolvedCtx.db,
            input.ids,
            organizationId,
            new Date(input.completionDate),
         );

         return result;
      }),
   create: protectedProcedure
      .input(createBillSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         // Verify all tags belong to this organization
         if (input.tagIds && input.tagIds.length > 0) {
            const orgTags = await findTagsByOrganizationId(
               resolvedCtx.db,
               organizationId,
            );
            const validTagIds = new Set(orgTags.map((t) => t.id));
            const hasInvalidTags = input.tagIds.some(
               (id) => !validTagIds.has(id),
            );
            if (hasInvalidTags) {
               throw APIError.validation(
                  "One or more tags do not belong to this organization",
               );
            }
         }

         const firstBill = await createBill(resolvedCtx.db, {
            ...input,
            amount: input.amount.toString(),
            costCenterId: input.costCenterId,
            counterpartyId: input.counterpartyId,
            description: input.description || "",
            dueDate: new Date(input.dueDate),
            id: crypto.randomUUID(),
            interestTemplateId: input.interestTemplateId,
            isRecurring: input.isRecurring ?? false,
            issueDate: input.issueDate ? new Date(input.issueDate) : null,
            organizationId,
            originalAmount: input.originalAmount?.toString(),
            recurrencePattern: input.recurrencePattern,
         });

         // Set tags if provided
         if (input.tagIds && input.tagIds.length > 0) {
            await setBillTags(resolvedCtx.db, firstBill.id, input.tagIds);
         }

         if (input.isRecurring && input.recurrencePattern) {
            let futureDueDates: Date[];

            if (input.occurrenceUntilDate) {
               futureDueDates = generateFutureDatesUntil(
                  new Date(input.dueDate),
                  input.recurrencePattern,
                  new Date(input.occurrenceUntilDate),
               );
            } else {
               futureDueDates = generateFutureDates(
                  new Date(input.dueDate),
                  input.recurrencePattern,
                  input.occurrenceCount,
               );
            }

            const futureIssueDates = input.issueDate
               ? input.occurrenceUntilDate
                  ? generateFutureDatesUntil(
                       new Date(input.issueDate),
                       input.recurrencePattern,
                       new Date(input.occurrenceUntilDate),
                    )
                  : generateFutureDates(
                       new Date(input.issueDate),
                       input.recurrencePattern,
                       input.occurrenceCount,
                    )
               : [];

            const futureBillsPromises = futureDueDates.map(
               async (dueDate, index) => {
                  const futureBill = await createBill(resolvedCtx.db, {
                     amount: input.amount.toString(),
                     bankAccountId: input.bankAccountId,
                     categoryId: input.categoryId,
                     costCenterId: input.costCenterId,
                     counterpartyId: input.counterpartyId,
                     description: input.description || "",
                     dueDate,
                     id: crypto.randomUUID(),
                     interestTemplateId: input.interestTemplateId,
                     isRecurring: true,
                     issueDate: futureIssueDates[index] ?? null,
                     notes: input.notes,
                     organizationId,
                     originalAmount: input.originalAmount?.toString(),
                     parentBillId: firstBill.id,
                     recurrencePattern: input.recurrencePattern,
                     type: input.type,
                  });

                  // Set tags for future bills too
                  if (input.tagIds && input.tagIds.length > 0) {
                     await setBillTags(
                        resolvedCtx.db,
                        futureBill.id,
                        input.tagIds,
                     );
                  }

                  return futureBill;
               },
            );

            await Promise.all(futureBillsPromises);
         }

         return firstBill;
      }),

   createWithInstallments: protectedProcedure
      .input(createBillWithInstallmentsSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         // Verify all tags belong to this organization
         if (input.tagIds && input.tagIds.length > 0) {
            const orgTags = await findTagsByOrganizationId(
               resolvedCtx.db,
               organizationId,
            );
            const validTagIds = new Set(orgTags.map((t) => t.id));
            const hasInvalidTags = input.tagIds.some(
               (id) => !validTagIds.has(id),
            );
            if (hasInvalidTags) {
               throw APIError.validation(
                  "One or more tags do not belong to this organization",
               );
            }
         }

         const result = await createBillWithInstallments(resolvedCtx.db, {
            amount: input.amount.toString(),
            bankAccountId: input.bankAccountId,
            categoryId: input.categoryId,
            costCenterId: input.costCenterId,
            counterpartyId: input.counterpartyId,
            description: input.description || "",
            dueDate: new Date(input.dueDate),
            id: crypto.randomUUID(),
            installments: input.installments,
            interestTemplateId: input.interestTemplateId,
            issueDate: input.issueDate ? new Date(input.issueDate) : null,
            notes: input.notes,
            organizationId,
            type: input.type,
         });

         // Set tags for all installment bills
         if (input.tagIds && input.tagIds.length > 0) {
            const tagPromises = result.bills.map((bill) =>
               setBillTags(resolvedCtx.db, bill.id, input.tagIds as string[]),
            );
            await Promise.all(tagPromises);
         }

         return result;
      }),

   delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingBill = await findBillById(resolvedCtx.db, input.id);

         if (!existingBill || existingBill.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         if (existingBill.completionDate && existingBill.transactionId) {
            throw APIError.conflict(
               "Cannot delete completed bill. Delete the associated transaction first.",
            );
         }

         return deleteBill(resolvedCtx.db, input.id);
      }),

   deleteAttachment: protectedProcedure
      .input(z.object({ attachmentId: z.string(), billId: z.string() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const bill = await findBillById(resolvedCtx.db, input.billId);

         if (!bill || bill.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         const attachment = await findBillAttachmentById(
            resolvedCtx.db,
            input.attachmentId,
         );

         if (!attachment || attachment.billId !== input.billId) {
            throw APIError.notFound("Attachment not found");
         }

         try {
            const bucketName = resolvedCtx.minioBucket;
            const minioClient = resolvedCtx.minioClient;
            await minioClient.removeObject(bucketName, attachment.storageKey);
         } catch (error) {
            console.error("Error deleting attachment file:", error);
         }

         await deleteBillAttachment(resolvedCtx.db, input.attachmentId);

         return { success: true };
      }),

   deleteMany: protectedProcedure
      .input(z.object({ ids: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const result = await deleteManyBills(
            resolvedCtx.db,
            input.ids,
            organizationId,
         );

         return result;
      }),

   generateNext: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingBill = await findBillById(resolvedCtx.db, input.id);

         if (!existingBill || existingBill.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         if (!existingBill.isRecurring || !existingBill.recurrencePattern) {
            throw APIError.validation("Bill is not recurring");
         }

         const nextDueDate = getNextDueDate(
            existingBill.dueDate,
            existingBill.recurrencePattern as RecurrencePattern,
         );

         const nextIssueDate = existingBill.issueDate
            ? getNextDueDate(
                 existingBill.issueDate,
                 existingBill.recurrencePattern as RecurrencePattern,
              )
            : nextDueDate;

         return createBill(resolvedCtx.db, {
            amount: existingBill.amount,
            bankAccountId: existingBill.bankAccountId,
            categoryId: existingBill.categoryId,
            counterpartyId: existingBill.counterpartyId,
            description: existingBill.description,
            dueDate: nextDueDate,
            id: crypto.randomUUID(),
            interestTemplateId: existingBill.interestTemplateId,
            isRecurring: existingBill.isRecurring,
            issueDate: nextIssueDate,
            notes: existingBill.notes,
            organizationId,
            parentBillId: existingBill.id,
            recurrencePattern: existingBill.recurrencePattern,
            type: existingBill.type,
         });
      }),

   getAll: protectedProcedure
      .input(filterSchema.optional())
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         if (input && (input.month || input.type)) {
            return findBillsByOrganizationIdFiltered(
               resolvedCtx.db,
               organizationId,
               input,
            );
         }

         return findBillsByOrganizationId(resolvedCtx.db, organizationId);
      }),

   getAllPaginated: protectedProcedure
      .input(paginationSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return findBillsByOrganizationIdPaginated(
            resolvedCtx.db,
            organizationId,
            {
               ...input,
               endDate: input.endDate ? new Date(input.endDate) : undefined,
               startDate: input.startDate
                  ? new Date(input.startDate)
                  : undefined,
            },
         );
      }),

   getAttachmentData: protectedProcedure
      .input(z.object({ attachmentId: z.string(), billId: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const bill = await findBillById(resolvedCtx.db, input.billId);

         if (!bill || bill.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         const attachment = await findBillAttachmentById(
            resolvedCtx.db,
            input.attachmentId,
         );

         if (!attachment || attachment.billId !== input.billId) {
            throw APIError.notFound("Attachment not found");
         }

         const bucketName = resolvedCtx.minioBucket;

         try {
            const { buffer, contentType } = await streamFileForProxy(
               attachment.storageKey,
               bucketName,
               resolvedCtx.minioClient,
            );
            const base64 = buffer.toString("base64");
            return {
               contentType,
               data: `data:${contentType};base64,${base64}`,
               fileName: attachment.fileName,
               id: attachment.id,
            };
         } catch (error) {
            console.error("Error fetching attachment:", error);
            return null;
         }
      }),

   getAttachments: protectedProcedure
      .input(z.object({ billId: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const bill = await findBillById(resolvedCtx.db, input.billId);

         if (!bill || bill.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         const attachments = await findBillAttachmentsByBillId(
            resolvedCtx.db,
            input.billId,
         );

         return attachments;
      }),

   getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const billData = await findBillById(resolvedCtx.db, input.id);

         if (!billData || billData.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         return billData;
      }),

   getByTransactionId: protectedProcedure
      .input(z.object({ transactionId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const billData = await findBillByTransactionId(
            resolvedCtx.db,
            input.transactionId,
         );

         if (!billData || billData.organizationId !== organizationId) {
            return null;
         }

         return billData;
      }),

   getByInstallmentGroup: protectedProcedure
      .input(z.object({ installmentGroupId: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const bills = await findBillsByInstallmentGroupId(
            resolvedCtx.db,
            input.installmentGroupId,
         );

         const filteredBills = bills.filter(
            (bill) => bill.organizationId === organizationId,
         );

         if (filteredBills.length === 0) {
            throw APIError.notFound("Installment group not found");
         }

         return filteredBills;
      }),

   getByType: protectedProcedure
      .input(z.object({ type: z.enum(["income", "expense"]) }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return findBillsByOrganizationIdAndType(
            resolvedCtx.db,
            organizationId,
            input.type,
         );
      }),

   getCompleted: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      return findCompletedBillsByOrganizationId(resolvedCtx.db, organizationId);
   }),

   getOverdue: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      return findOverdueBillsByOrganizationId(resolvedCtx.db, organizationId);
   }),

   getPending: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      return findPendingBillsByOrganizationId(resolvedCtx.db, organizationId);
   }),

   getStats: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      const [
         totalBills,
         totalPendingPayables,
         totalPendingReceivables,
         totalOverdue,
         totalOverduePayables,
         totalOverdueReceivables,
      ] = await Promise.all([
         getTotalBillsByOrganizationId(resolvedCtx.db, organizationId),
         getTotalPendingPayablesByOrganizationId(
            resolvedCtx.db,
            organizationId,
         ),
         getTotalPendingReceivablesByOrganizationId(
            resolvedCtx.db,
            organizationId,
         ),
         getTotalOverdueBillsByOrganizationId(resolvedCtx.db, organizationId),
         getTotalOverduePayablesByOrganizationId(
            resolvedCtx.db,
            organizationId,
         ),
         getTotalOverdueReceivablesByOrganizationId(
            resolvedCtx.db,
            organizationId,
         ),
      ]);

      return {
         totalBills,
         totalOverdue: totalOverdue || 0,
         totalOverduePayables: totalOverduePayables || 0,
         totalOverdueReceivables: totalOverdueReceivables || 0,
         totalPendingPayables: totalPendingPayables || 0,
         totalPendingReceivables: totalPendingReceivables || 0,
      };
   }),

   update: protectedProcedure
      .input(
         z.object({
            data: updateBillSchema,
            id: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingBill = await findBillById(resolvedCtx.db, input.id);

         if (!existingBill || existingBill.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         if (existingBill.completionDate) {
            const metadataFields = new Set([
               "notes",
               "categoryId",
               "tagIds",
               "counterpartyId",
               "costCenterId",
            ]);
            const requestedFields = Object.keys(input.data).filter(
               (key) =>
                  input.data[key as keyof typeof input.data] !== undefined,
            );
            const hasNonMetadataField = requestedFields.some(
               (field) => !metadataFields.has(field),
            );
            if (hasNonMetadataField) {
               throw APIError.conflict(
                  "Cannot edit financial fields on completed bill. Only metadata (notes, category, tags, counterparty, cost center) can be updated.",
               );
            }
         }

         const updateData: Partial<NewBill> = {};

         if (input.data.amount !== undefined) {
            updateData.amount = input.data.amount.toString();
         }

         if (input.data.dueDate !== undefined) {
            updateData.dueDate = new Date(input.data.dueDate);
         }

         if (input.data.issueDate !== undefined) {
            updateData.issueDate = new Date(input.data.issueDate);
         }

         if (input.data.bankAccountId !== undefined) {
            updateData.bankAccountId = input.data.bankAccountId;
         }

         if (input.data.categoryId !== undefined) {
            updateData.categoryId = input.data.categoryId;
         }

         if (input.data.description !== undefined) {
            updateData.description = input.data.description;
         }

         if (input.data.type !== undefined) {
            updateData.type = input.data.type;
         }

         if (input.data.counterpartyId !== undefined) {
            updateData.counterpartyId = input.data.counterpartyId;
         }

         if (input.data.interestTemplateId !== undefined) {
            updateData.interestTemplateId = input.data.interestTemplateId;
         }

         if (input.data.notes !== undefined) {
            updateData.notes = input.data.notes;
         }

         if (input.data.isRecurring !== undefined) {
            updateData.isRecurring = input.data.isRecurring;
         }

         if (input.data.recurrencePattern !== undefined) {
            updateData.recurrencePattern = input.data.recurrencePattern;
         }

         if (input.data.autoCreateNext !== undefined) {
            updateData.autoCreateNext = input.data.autoCreateNext;
         }

         if (input.data.costCenterId !== undefined) {
            updateData.costCenterId = input.data.costCenterId;
         }

         const updatedBill = await updateBill(
            resolvedCtx.db,
            input.id,
            updateData,
         );

         // Update tags if provided
         if (input.data.tagIds !== undefined) {
            // Verify all tags belong to this organization
            if (input.data.tagIds.length > 0) {
               const orgTags = await findTagsByOrganizationId(
                  resolvedCtx.db,
                  organizationId,
               );
               const validTagIds = new Set(orgTags.map((t) => t.id));
               const hasInvalidTags = input.data.tagIds.some(
                  (id) => !validTagIds.has(id),
               );
               if (hasInvalidTags) {
                  throw APIError.validation(
                     "One or more tags do not belong to this organization",
                  );
               }
            }
            await setBillTags(resolvedCtx.db, input.id, input.data.tagIds);
         }

         return updatedBill;
      }),

   getBillTags: protectedProcedure
      .input(z.object({ billId: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const bill = await findBillById(resolvedCtx.db, input.billId);

         if (!bill || bill.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         return findTagsByBillId(resolvedCtx.db, input.billId);
      }),

   setBillTags: protectedProcedure
      .input(
         z.object({
            billId: z.string().uuid(),
            tagIds: z.array(z.string().uuid()),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const bill = await findBillById(resolvedCtx.db, input.billId);

         if (!bill || bill.organizationId !== organizationId) {
            throw APIError.notFound("Bill not found");
         }

         // Verify all tags belong to this organization
         if (input.tagIds.length > 0) {
            const orgTags = await findTagsByOrganizationId(
               resolvedCtx.db,
               organizationId,
            );
            const validTagIds = new Set(orgTags.map((t) => t.id));
            const hasInvalidTags = input.tagIds.some(
               (id) => !validTagIds.has(id),
            );
            if (hasInvalidTags) {
               throw APIError.validation(
                  "One or more tags do not belong to this organization",
               );
            }
         }

         return setBillTags(resolvedCtx.db, input.billId, input.tagIds);
      }),
});
