import { z } from "zod";
export declare const bankAccountTypeEnum: z.ZodEnum<{
   cash: "cash";
   checking: "checking";
   investment: "investment";
   payment: "payment";
   savings: "savings";
}>;
export declare const bankAccountStatusEnum: z.ZodEnum<{
   active: "active";
   archived: "archived";
}>;
export declare const BankAccountSchema: z.ZodObject<
   {
      id: z.ZodString;
      name: z.ZodString;
      type: z.ZodEnum<{
         cash: "cash";
         checking: "checking";
         investment: "investment";
         payment: "payment";
         savings: "savings";
      }>;
      status: z.ZodEnum<{
         active: "active";
         archived: "archived";
      }>;
      color: z.ZodString;
      iconUrl: z.ZodNullable<z.ZodString>;
      bankCode: z.ZodNullable<z.ZodString>;
      bankName: z.ZodNullable<z.ZodString>;
      branch: z.ZodNullable<z.ZodString>;
      accountNumber: z.ZodNullable<z.ZodString>;
      initialBalance: z.ZodString;
      initialBalanceDate: z.ZodNullable<z.ZodString>;
      notes: z.ZodNullable<z.ZodString>;
      currentBalance: z.ZodString;
      projectedBalance: z.ZodString;
      createdAt: z.ZodString;
      updatedAt: z.ZodString;
   },
   z.core.$strip
>;
export declare const CreateBankAccountSchema: z.ZodObject<
   {
      name: z.ZodString;
      type: z.ZodDefault<
         z.ZodEnum<{
            cash: "cash";
            checking: "checking";
            investment: "investment";
            payment: "payment";
            savings: "savings";
         }>
      >;
      color: z.ZodDefault<z.ZodString>;
      initialBalance: z.ZodDefault<z.ZodString>;
      initialBalanceDate: z.ZodOptional<z.ZodString>;
      bankCode: z.ZodOptional<z.ZodString>;
      bankName: z.ZodOptional<z.ZodString>;
      branch: z.ZodOptional<z.ZodString>;
      accountNumber: z.ZodOptional<z.ZodString>;
      iconUrl: z.ZodOptional<z.ZodString>;
      notes: z.ZodOptional<z.ZodString>;
   },
   z.core.$strip
>;
export declare const UpdateBankAccountSchema: z.ZodObject<
   {
      name: z.ZodOptional<z.ZodString>;
      type: z.ZodOptional<
         z.ZodDefault<
            z.ZodEnum<{
               cash: "cash";
               checking: "checking";
               investment: "investment";
               payment: "payment";
               savings: "savings";
            }>
         >
      >;
      color: z.ZodOptional<z.ZodDefault<z.ZodString>>;
      initialBalance: z.ZodOptional<z.ZodDefault<z.ZodString>>;
      initialBalanceDate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      bankCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      bankName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      branch: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      accountNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      iconUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
   },
   z.core.$strip
>;
export declare const transactionTypeEnum: z.ZodEnum<{
   expense: "expense";
   income: "income";
   transfer: "transfer";
}>;
export declare const paymentMethodEnum: z.ZodEnum<{
   automatic_debit: "automatic_debit";
   boleto: "boleto";
   cash: "cash";
   cheque: "cheque";
   credit_card: "credit_card";
   debit_card: "debit_card";
   other: "other";
   pix: "pix";
   transfer: "transfer";
}>;
export declare const TransactionSchema: z.ZodObject<
   {
      id: z.ZodString;
      name: z.ZodNullable<z.ZodString>;
      type: z.ZodEnum<{
         expense: "expense";
         income: "income";
         transfer: "transfer";
      }>;
      amount: z.ZodString;
      description: z.ZodNullable<z.ZodString>;
      date: z.ZodString;
      bankAccountId: z.ZodNullable<z.ZodString>;
      destinationBankAccountId: z.ZodNullable<z.ZodString>;
      creditCardId: z.ZodNullable<z.ZodString>;
      categoryId: z.ZodNullable<z.ZodString>;
      contactId: z.ZodNullable<z.ZodString>;
      paymentMethod: z.ZodNullable<
         z.ZodEnum<{
            automatic_debit: "automatic_debit";
            boleto: "boleto";
            cash: "cash";
            cheque: "cheque";
            credit_card: "credit_card";
            debit_card: "debit_card";
            other: "other";
            pix: "pix";
            transfer: "transfer";
         }>
      >;
      attachmentUrl: z.ZodNullable<z.ZodString>;
      createdAt: z.ZodString;
      updatedAt: z.ZodString;
   },
   z.core.$strip
>;
export declare const CreateTransactionSchema: z.ZodObject<
   {
      name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      type: z.ZodEnum<{
         expense: "expense";
         income: "income";
         transfer: "transfer";
      }>;
      amount: z.ZodString;
      date: z.ZodString;
      description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      bankAccountId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      destinationBankAccountId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      creditCardId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      categoryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      contactId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      paymentMethod: z.ZodOptional<
         z.ZodNullable<
            z.ZodEnum<{
               automatic_debit: "automatic_debit";
               boleto: "boleto";
               cash: "cash";
               cheque: "cheque";
               credit_card: "credit_card";
               debit_card: "debit_card";
               other: "other";
               pix: "pix";
               transfer: "transfer";
            }>
         >
      >;
      attachmentUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      tagIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
   },
   z.core.$strip
>;
export declare const UpdateTransactionSchema: z.ZodObject<
   {
      name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      amount: z.ZodOptional<z.ZodString>;
      date: z.ZodOptional<z.ZodString>;
      description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      bankAccountId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      destinationBankAccountId: z.ZodOptional<
         z.ZodOptional<z.ZodNullable<z.ZodString>>
      >;
      creditCardId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      categoryId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      contactId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      paymentMethod: z.ZodOptional<
         z.ZodOptional<
            z.ZodNullable<
               z.ZodEnum<{
                  automatic_debit: "automatic_debit";
                  boleto: "boleto";
                  cash: "cash";
                  cheque: "cheque";
                  credit_card: "credit_card";
                  debit_card: "debit_card";
                  other: "other";
                  pix: "pix";
                  transfer: "transfer";
               }>
            >
         >
      >;
      attachmentUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      tagIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
   },
   z.core.$strip
>;
export declare const ListTransactionsFilterSchema: z.ZodObject<
   {
      type: z.ZodOptional<
         z.ZodEnum<{
            expense: "expense";
            income: "income";
            transfer: "transfer";
         }>
      >;
      bankAccountId: z.ZodOptional<z.ZodString>;
      categoryId: z.ZodOptional<z.ZodString>;
      tagId: z.ZodOptional<z.ZodString>;
      contactId: z.ZodOptional<z.ZodString>;
      creditCardId: z.ZodOptional<z.ZodString>;
      dateFrom: z.ZodOptional<z.ZodString>;
      dateTo: z.ZodOptional<z.ZodString>;
      search: z.ZodOptional<z.ZodString>;
      uncategorized: z.ZodOptional<z.ZodBoolean>;
      paymentMethod: z.ZodOptional<
         z.ZodEnum<{
            automatic_debit: "automatic_debit";
            boleto: "boleto";
            cash: "cash";
            cheque: "cheque";
            credit_card: "credit_card";
            debit_card: "debit_card";
            other: "other";
            pix: "pix";
            transfer: "transfer";
         }>
      >;
      page: z.ZodDefault<z.ZodNumber>;
      pageSize: z.ZodDefault<z.ZodNumber>;
   },
   z.core.$strip
>;
export declare const TransactionSummarySchema: z.ZodObject<
   {
      totalCount: z.ZodNumber;
      incomeTotal: z.ZodString;
      expenseTotal: z.ZodString;
      balance: z.ZodString;
   },
   z.core.$strip
>;
export declare const PaginatedTransactionsSchema: z.ZodObject<
   {
      data: z.ZodArray<
         z.ZodObject<
            {
               id: z.ZodString;
               name: z.ZodNullable<z.ZodString>;
               type: z.ZodEnum<{
                  expense: "expense";
                  income: "income";
                  transfer: "transfer";
               }>;
               amount: z.ZodString;
               description: z.ZodNullable<z.ZodString>;
               date: z.ZodString;
               bankAccountId: z.ZodNullable<z.ZodString>;
               destinationBankAccountId: z.ZodNullable<z.ZodString>;
               creditCardId: z.ZodNullable<z.ZodString>;
               categoryId: z.ZodNullable<z.ZodString>;
               contactId: z.ZodNullable<z.ZodString>;
               paymentMethod: z.ZodNullable<
                  z.ZodEnum<{
                     automatic_debit: "automatic_debit";
                     boleto: "boleto";
                     cash: "cash";
                     cheque: "cheque";
                     credit_card: "credit_card";
                     debit_card: "debit_card";
                     other: "other";
                     pix: "pix";
                     transfer: "transfer";
                  }>
               >;
               attachmentUrl: z.ZodNullable<z.ZodString>;
               createdAt: z.ZodString;
               updatedAt: z.ZodString;
            },
            z.core.$strip
         >
      >;
      total: z.ZodNumber;
   },
   z.core.$strip
>;
export declare const categoryTypeEnum: z.ZodEnum<{
   expense: "expense";
   income: "income";
}>;
export declare const CategorySchema: z.ZodObject<
   {
      id: z.ZodString;
      parentId: z.ZodNullable<z.ZodString>;
      name: z.ZodString;
      type: z.ZodEnum<{
         expense: "expense";
         income: "income";
      }>;
      level: z.ZodNumber;
      description: z.ZodNullable<z.ZodString>;
      isDefault: z.ZodBoolean;
      color: z.ZodNullable<z.ZodString>;
      icon: z.ZodNullable<z.ZodString>;
      isArchived: z.ZodBoolean;
      keywords: z.ZodNullable<z.ZodArray<z.ZodString>>;
      notes: z.ZodNullable<z.ZodString>;
      createdAt: z.ZodString;
      updatedAt: z.ZodString;
   },
   z.core.$strip
>;
export declare const CreateCategorySchema: z.ZodObject<
   {
      name: z.ZodString;
      type: z.ZodEnum<{
         expense: "expense";
         income: "income";
      }>;
      parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      icon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      keywords: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
      notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
   },
   z.core.$strip
>;
export declare const UpdateCategorySchema: z.ZodObject<
   {
      name: z.ZodOptional<z.ZodString>;
      parentId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      color: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      icon: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      keywords: z.ZodOptional<
         z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>
      >;
      notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
   },
   z.core.$strip
>;
export declare const BudgetGoalSchema: z.ZodObject<
   {
      id: z.ZodString;
      categoryId: z.ZodString;
      month: z.ZodNumber;
      year: z.ZodNumber;
      limitAmount: z.ZodString;
      alertThreshold: z.ZodNullable<z.ZodNumber>;
      currentSpent: z.ZodString;
      percentUsed: z.ZodNumber;
      createdAt: z.ZodString;
      updatedAt: z.ZodString;
   },
   z.core.$strip
>;
export declare const CreateBudgetGoalSchema: z.ZodObject<
   {
      categoryId: z.ZodString;
      month: z.ZodNumber;
      year: z.ZodNumber;
      limitAmount: z.ZodString;
      alertThreshold: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
   },
   z.core.$strip
>;
export declare const UpdateBudgetGoalSchema: z.ZodObject<
   {
      limitAmount: z.ZodOptional<z.ZodString>;
      alertThreshold: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
   },
   z.core.$strip
>;
export declare const ListBudgetGoalsFilterSchema: z.ZodObject<
   {
      month: z.ZodNumber;
      year: z.ZodNumber;
   },
   z.core.$strip
>;
//# sourceMappingURL=schemas.d.ts.map
