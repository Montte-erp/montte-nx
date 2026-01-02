import {
   decodeOfxBuffer,
   generateBankStatement,
   type OFXAccountType,
   type OFXHeader,
   type OFXTransaction,
   type OFXTransactionType,
   parseStream,
} from "@f-o-t/ofx";
import { normalizeText } from "@packages/utils/text";

// Re-export library types for consumers
export type {
   OFXAccountType,
   OFXBalance,
   OFXBankAccount,
   OFXCreditCardAccount,
   OFXDate,
   OFXDocument,
   OFXHeader,
   OFXTransaction,
   OFXTransactionType,
} from "@f-o-t/ofx";

// Progress callback types
export type OfxProgressEvent =
   | { type: "header"; header: OFXHeader }
   | { type: "progress"; parsed: number }
   | { type: "complete"; totalParsed: number };

export type OfxProgressCallback = (event: OfxProgressEvent) => void;

export interface ParseOfxOptions {
   onProgress?: OfxProgressCallback;
}

/**
 * Transaction type classification.
 * - "expense": Negative amount (money going out)
 * - "income": Positive amount (money coming in)
 * - "zero": Zero amount - typically balance adjustments, memo entries, or data
 *   anomalies that callers should decide how to handle (ignore, log, or process)
 */
export type TransactionType = "expense" | "income" | "zero";

// Domain-specific parsed transaction
export interface ParsedTransaction {
   amount: number;
   date: Date;
   description: string;
   fitid: string;
   type: TransactionType;
}

/**
 * Classifies a transaction amount into expense, income, or zero.
 * Zero-amount transactions are separated so callers can decide whether to
 * ignore them, log them for review, or process them as balance adjustments.
 */
function classifyTransactionType(amount: number): TransactionType {
   if (amount === 0) {
      return "zero";
   }
   return amount < 0 ? "expense" : "income";
}

function mapTransaction(trn: OFXTransaction): ParsedTransaction {
   const amount = trn.TRNAMT;
   const date = trn.DTPOSTED.toDate();
   const rawDescription = trn.MEMO || trn.NAME || "No description";
   return {
      amount: Math.abs(amount),
      date,
      description: normalizeText(rawDescription),
      fitid: trn.FITID ?? "",
      type: classifyTransactionType(amount),
   };
}

/**
 * Creates an async iterable that yields chunks of the content string.
 * Yields to the main thread between chunks for UI responsiveness.
 */
async function* createChunkIterable(
   content: string,
   chunkSize = 65536,
): AsyncGenerator<string> {
   for (let i = 0; i < content.length; i += chunkSize) {
      yield content.slice(i, i + chunkSize);
      // Yield to main thread between chunks for UI responsiveness
      await new Promise((resolve) => setTimeout(resolve, 0));
   }
}

/**
 * Shared helper that parses OFX from an async iterable.
 * Handles progress callbacks, transaction mapping, and event processing.
 */
async function parseFromIterable(
   iterable: AsyncIterable<string>,
   options?: ParseOfxOptions,
): Promise<ParsedTransaction[]> {
   const transactions: ParsedTransaction[] = [];
   const onProgress = options?.onProgress;
   let count = 0;

   for await (const event of parseStream(iterable)) {
      switch (event.type) {
         case "header":
            onProgress?.({ type: "header", header: event.data });
            break;

         case "transaction":
            count++;
            transactions.push(mapTransaction(event.data));

            // Report progress every 50 transactions
            if (count % 50 === 0) {
               onProgress?.({ type: "progress", parsed: count });
            }
            break;

         case "complete":
            onProgress?.({
               type: "complete",
               totalParsed: transactions.length,
            });
            break;
      }
   }

   return transactions;
}

/**
 * Parses OFX content from a string using streaming.
 * Supports progress callbacks for UI updates.
 */
export async function parseOfxContent(
   content: string,
   options?: ParseOfxOptions,
): Promise<ParsedTransaction[]> {
   return parseFromIterable(createChunkIterable(content), options);
}

/**
 * Parses OFX content from a buffer using streaming.
 * Handles encoding detection automatically.
 * Supports progress callbacks for UI updates.
 */
export async function parseOfxBuffer(
   buffer: Uint8Array,
   options?: ParseOfxOptions,
): Promise<ParsedTransaction[]> {
   const content = decodeOfxBuffer(buffer);
   return parseFromIterable(createChunkIterable(content), options);
}

// Export types
export interface ExportTransaction {
   id: string;
   amount: string;
   date: Date;
   description: string;
   type: "income" | "expense" | "transfer";
   externalId?: string | null;
}

export interface ExportOfxOptions {
   accountId: string;
   bankId: string;
   accountType: "checking" | "savings" | "investment";
   currency?: string;
   startDate: Date;
   endDate: Date;
   organizationName?: string;
}

function mapAccountType(type: ExportOfxOptions["accountType"]): OFXAccountType {
   const mapping: Record<ExportOfxOptions["accountType"], OFXAccountType> = {
      checking: "CHECKING",
      investment: "MONEYMRKT",
      savings: "SAVINGS",
   };
   return mapping[type];
}

function mapTransactionType(
   type: ExportTransaction["type"],
   amount: number,
): OFXTransactionType {
   if (type === "transfer") {
      return "XFER";
   }
   if (type === "income") {
      return amount >= 0 ? "CREDIT" : "DEBIT";
   }
   return "DEBIT";
}

export function generateOfxContent(
   transactions: ExportTransaction[],
   options: ExportOfxOptions,
): string {
   const currency = options.currency ?? "BRL";

   const ofxTransactions = transactions.map((trn) => {
      const amount = Number.parseFloat(trn.amount);
      const signedAmount =
         trn.type === "expense" ? -Math.abs(amount) : Math.abs(amount);

      return {
         amount: signedAmount,
         datePosted: trn.date,
         fitId: trn.externalId ?? trn.id,
         memo: trn.description,
         type: mapTransactionType(trn.type, signedAmount),
      };
   });

   return generateBankStatement({
      accountId: options.accountId,
      accountType: mapAccountType(options.accountType),
      bankId: options.bankId,
      currency,
      endDate: options.endDate,
      financialInstitution: options.organizationName
         ? { org: options.organizationName }
         : undefined,
      startDate: options.startDate,
      transactions: ofxTransactions,
   });
}
