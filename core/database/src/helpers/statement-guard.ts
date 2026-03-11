import { AppError } from "@core/logging/errors";
import { db } from "@core/database/client";

/**
 * Throws if the transaction's statement is already paid.
 * Call before update/delete of any transaction with creditCardId.
 */
export async function assertTransactionEditable(
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
