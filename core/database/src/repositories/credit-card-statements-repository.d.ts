import type { DatabaseInstance } from "@core/database/client";
export declare function getStatement(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   creditCardId: string;
   statementPeriod: string;
   closingDate: string;
   dueDate: string;
   status: "open" | "paid";
   billId: string | null;
   paymentTransactionId: string | null;
   createdAt: Date;
   updatedAt: Date;
   totalPurchases: string;
   transactionCount: number;
} | null>;
export declare function listStatements(
   db: DatabaseInstance,
   creditCardId: string,
): Promise<
   {
      statement: {
         id: string;
         creditCardId: string;
         statementPeriod: string;
         closingDate: string;
         dueDate: string;
         status: "open" | "paid";
         billId: string | null;
         paymentTransactionId: string | null;
         createdAt: Date;
         updatedAt: Date;
      };
      totalPurchases: string;
      transactionCount: number;
   }[]
>;
export declare function getOrCreateStatement(
   db: DatabaseInstance,
   creditCardId: string,
   statementPeriod: string,
): Promise<{
   billId: string | null;
   closingDate: string;
   createdAt: Date;
   creditCardId: string;
   dueDate: string;
   id: string;
   paymentTransactionId: string | null;
   statementPeriod: string;
   status: "open" | "paid";
   updatedAt: Date;
}>;
export declare function payStatement(
   db: DatabaseInstance,
   statementId: string,
   paymentDate: string,
): Promise<
   | {
        id: string;
        creditCardId: string;
        statementPeriod: string;
        closingDate: string;
        dueDate: string;
        status: "open" | "paid";
        billId: string | null;
        paymentTransactionId: string | null;
        createdAt: Date;
        updatedAt: Date;
     }
   | undefined
>;
export declare function getAvailableLimit(
   db: DatabaseInstance,
   creditCardId: string,
): Promise<{
   creditLimit: string;
   totalPending: string;
   availableLimit: string;
}>;
//# sourceMappingURL=credit-card-statements-repository.d.ts.map
