import { AppError } from "@core/logging/errors";
import type { DatabaseInstance } from "@core/database/client";

export async function assertTransactionEditable(
   db: DatabaseInstance,
   creditCardId: string,
   statementPeriod: string,
) {
   const statement = await db.query.creditCardStatements.findFirst({
      where: { creditCardId, statementPeriod, status: "paid" },
   });
   if (statement) {
      throw AppError.conflict(
         "Não é possível editar lançamento de fatura paga.",
      );
   }
}
