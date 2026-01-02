import { decodeOfxBuffer, getEncodingFromCharset } from "./parser";
import {
   balanceSchema,
   bankAccountSchema,
   creditCardAccountSchema,
   type OFXBalance,
   type OFXBankAccount,
   type OFXCreditCardAccount,
   type OFXHeader,
   type OFXTransaction,
   ofxHeaderSchema,
   transactionSchema,
} from "./schemas";
import { decodeEntities } from "./utils";

export interface StreamOptions {
   encoding?: string;
}

export type StreamEvent =
   | { type: "header"; data: OFXHeader }
   | { type: "transaction"; data: OFXTransaction }
   | { type: "account"; data: OFXBankAccount | OFXCreditCardAccount }
   | { type: "balance"; data: { ledger?: OFXBalance; available?: OFXBalance } }
   | { type: "complete"; transactionCount: number };

// Batch streaming types
export interface BatchFileInput {
   filename: string;
   buffer: Uint8Array;
}

export type BatchStreamEvent =
   | { type: "file_start"; fileIndex: number; filename: string }
   | { type: "header"; fileIndex: number; data: OFXHeader }
   | { type: "transaction"; fileIndex: number; data: OFXTransaction }
   | {
        type: "account";
        fileIndex: number;
        data: OFXBankAccount | OFXCreditCardAccount;
     }
   | {
        type: "balance";
        fileIndex: number;
        data: { ledger?: OFXBalance; available?: OFXBalance };
     }
   | {
        type: "file_complete";
        fileIndex: number;
        filename: string;
        transactionCount: number;
     }
   | { type: "file_error"; fileIndex: number; filename: string; error: string }
   | {
        type: "batch_complete";
        totalFiles: number;
        totalTransactions: number;
        errorCount: number;
     };

export interface BatchParsedFile {
   fileIndex: number;
   filename: string;
   header?: OFXHeader;
   transactions: OFXTransaction[];
   accounts: (OFXBankAccount | OFXCreditCardAccount)[];
   balances: { ledger?: OFXBalance; available?: OFXBalance }[];
   error?: string;
}

interface ParserState {
   buffer: string;
   inHeader: boolean;
   headerParsed: boolean;
   transactionCount: number;
   currentPath: string[];
   currentObject: Record<string, unknown>;
   objectStack: Record<string, unknown>[];
}

function parseHeaderFromBuffer(
   buffer: string,
): { header: OFXHeader; bodyStart: number } | null {
   const lines = buffer.split(/\r?\n/);
   const header: Record<string, string> = {};
   let bodyStartIndex = 0;

   for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? "";

      if (line.startsWith("<?xml") || line.startsWith("<OFX>")) {
         bodyStartIndex = i;
         break;
      }

      const match = line.match(/^(\w+):(.*)$/);
      if (match?.[1] && match[2] !== undefined) {
         header[match[1]] = match[2];
      }

      if (line === "" && Object.keys(header).length > 0) {
         bodyStartIndex = i + 1;
         break;
      }
   }

   if (Object.keys(header).length === 0) return null;

   const headerResult = ofxHeaderSchema.safeParse(header);
   if (!headerResult.success) return null;

   const bodyStartChar = lines.slice(0, bodyStartIndex).join("\n").length + 1;
   return { bodyStart: bodyStartChar, header: headerResult.data };
}

function tryParseTransaction(obj: unknown): OFXTransaction | null {
   const result = transactionSchema.safeParse(obj);
   return result.success ? result.data : null;
}

function tryParseBankAccount(obj: unknown): OFXBankAccount | null {
   const result = bankAccountSchema.safeParse(obj);
   return result.success ? result.data : null;
}

function tryParseCreditCardAccount(obj: unknown): OFXCreditCardAccount | null {
   const result = creditCardAccountSchema.safeParse(obj);
   return result.success ? result.data : null;
}

function tryParseBalance(obj: unknown): OFXBalance | null {
   const result = balanceSchema.safeParse(obj);
   return result.success ? result.data : null;
}

export async function* parseStream(
   input: ReadableStream<Uint8Array> | AsyncIterable<string>,
   options?: StreamOptions,
): AsyncGenerator<StreamEvent> {
   const state: ParserState = {
      buffer: "",
      currentObject: {},
      currentPath: [],
      headerParsed: false,
      inHeader: true,
      objectStack: [{}],
      transactionCount: 0,
   };

   let detectedEncoding: string | undefined = options?.encoding;
   let decoder = new TextDecoder((detectedEncoding ?? "utf-8") as Bun.Encoding);
   const tagRegex = /<(\/?)([\w.]+)>([^<]*)/g;

   let pendingLedgerBalance: OFXBalance | undefined;
   let pendingAvailableBalance: OFXBalance | undefined;
   let emittedBalanceForCurrentStatement = false;

   async function* processChunk(
      chunk: string,
      isLast = false,
   ): AsyncGenerator<StreamEvent> {
      state.buffer += chunk;

      if (!state.headerParsed) {
         const headerResult = parseHeaderFromBuffer(state.buffer);
         if (headerResult) {
            state.headerParsed = true;
            state.inHeader = false;

            if (!detectedEncoding && headerResult.header.CHARSET) {
               detectedEncoding = getEncodingFromCharset(
                  headerResult.header.CHARSET,
               );
               decoder = new TextDecoder(detectedEncoding as Bun.Encoding);
            }

            yield { data: headerResult.header, type: "header" };
            state.buffer = state.buffer.slice(headerResult.bodyStart);
         } else {
            return;
         }
      }

      const lastLt = state.buffer.lastIndexOf("<");
      const safeEnd = isLast ? state.buffer.length : lastLt;
      if (safeEnd <= 0) return;

      const safeBuffer = state.buffer.slice(0, safeEnd);
      let processedUpTo = 0;

      tagRegex.lastIndex = 0;
      for (
         let match = tagRegex.exec(safeBuffer);
         match !== null;
         match = tagRegex.exec(safeBuffer)
      ) {
         const isClosing = match[1] === "/";
         const tagName = match[2];
         const textContent = match[3]?.trim() ?? "";

         if (!tagName) continue;

         const currentObj = state.objectStack[state.objectStack.length - 1];
         if (!currentObj) continue;

         if (isClosing) {
            if (tagName === "STMTTRN") {
               const txn = tryParseTransaction(currentObj);
               if (txn) {
                  state.transactionCount++;
                  yield { data: txn, type: "transaction" };
               }
            } else if (tagName === "BANKACCTFROM") {
               const account = tryParseBankAccount(currentObj);
               if (account) {
                  yield { data: account, type: "account" };
               }
            } else if (tagName === "CCACCTFROM") {
               const account = tryParseCreditCardAccount(currentObj);
               if (account) {
                  yield { data: account, type: "account" };
               }
            } else if (tagName === "LEDGERBAL") {
               pendingLedgerBalance = tryParseBalance(currentObj) ?? undefined;
            } else if (tagName === "AVAILBAL") {
               pendingAvailableBalance =
                  tryParseBalance(currentObj) ?? undefined;
            } else if (
               (tagName === "STMTRS" || tagName === "CCSTMTRS") &&
               !emittedBalanceForCurrentStatement
            ) {
               if (pendingLedgerBalance || pendingAvailableBalance) {
                  yield {
                     data: {
                        available: pendingAvailableBalance,
                        ledger: pendingLedgerBalance,
                     },
                     type: "balance",
                  };
                  emittedBalanceForCurrentStatement = true;
               }
            } else if (tagName === "STMTTRNRS" || tagName === "CCSTMTTRNRS") {
               pendingLedgerBalance = undefined;
               pendingAvailableBalance = undefined;
               emittedBalanceForCurrentStatement = false;
            }

            const pathIndex = state.currentPath.lastIndexOf(tagName);
            if (pathIndex !== -1) {
               state.currentPath.length = pathIndex;
               state.objectStack.length = Math.max(pathIndex + 1, 1);
            }
         } else if (textContent) {
            const decoded = decodeEntities(textContent);
            const existing = currentObj[tagName];
            if (existing !== undefined) {
               if (Array.isArray(existing)) {
                  existing.push(decoded);
               } else {
                  currentObj[tagName] = [existing, decoded];
               }
            } else {
               currentObj[tagName] = decoded;
            }
         } else {
            const newObj: Record<string, unknown> = {};
            const existing = currentObj[tagName];
            if (existing !== undefined) {
               if (Array.isArray(existing)) {
                  existing.push(newObj);
               } else {
                  currentObj[tagName] = [existing, newObj];
               }
            } else {
               currentObj[tagName] = newObj;
            }
            state.currentPath.push(tagName);
            state.objectStack.push(newObj);
         }

         processedUpTo = tagRegex.lastIndex;
      }

      if (processedUpTo > 0) {
         state.buffer = state.buffer.slice(processedUpTo);
      }
      tagRegex.lastIndex = 0;
   }

   if (input instanceof ReadableStream) {
      const reader = input.getReader();
      const initialChunks: Uint8Array[] = [];
      let headerFound = false;

      try {
         while (!headerFound) {
            const { done, value } = await reader.read();
            if (done) break;
            initialChunks.push(value);

            const combined = new Uint8Array(
               initialChunks.reduce((sum, chunk) => sum + chunk.length, 0),
            );
            let offset = 0;
            for (const chunk of initialChunks) {
               combined.set(chunk, offset);
               offset += chunk.length;
            }

            const headerSection = new TextDecoder("windows-1252").decode(
               combined.slice(0, Math.min(combined.length, 1000)),
            );

            if (
               headerSection.includes("<OFX") ||
               headerSection.includes("<?xml")
            ) {
               const charsetMatch = headerSection.match(/CHARSET:(\S+)/i);
               if (charsetMatch && !detectedEncoding) {
                  detectedEncoding = getEncodingFromCharset(charsetMatch[1]);
                  decoder = new TextDecoder(detectedEncoding as Bun.Encoding);
               }
               headerFound = true;

               const content = decoder.decode(combined);
               yield* processChunk(content);
            }
         }

         while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            yield* processChunk(decoder.decode(value, { stream: true }));
         }
         yield* processChunk(decoder.decode(), true);
      } finally {
         reader.releaseLock();
      }
   } else {
      const chunks: string[] = [];
      for await (const chunk of input) {
         chunks.push(chunk);
      }
      for (let i = 0; i < chunks.length; i++) {
         yield* processChunk(chunks[i] ?? "", i === chunks.length - 1);
      }
   }

   yield { transactionCount: state.transactionCount, type: "complete" };
}

export async function parseStreamToArray(
   input: ReadableStream<Uint8Array> | AsyncIterable<string>,
   options?: StreamOptions,
): Promise<{
   header?: OFXHeader;
   transactions: OFXTransaction[];
   accounts: (OFXBankAccount | OFXCreditCardAccount)[];
   balances: { ledger?: OFXBalance; available?: OFXBalance }[];
}> {
   const result: {
      header?: OFXHeader;
      transactions: OFXTransaction[];
      accounts: (OFXBankAccount | OFXCreditCardAccount)[];
      balances: { ledger?: OFXBalance; available?: OFXBalance }[];
   } = {
      accounts: [],
      balances: [],
      transactions: [],
   };

   for await (const event of parseStream(input, options)) {
      switch (event.type) {
         case "header":
            result.header = event.data;
            break;
         case "transaction":
            result.transactions.push(event.data);
            break;
         case "account":
            result.accounts.push(event.data);
            break;
         case "balance":
            result.balances.push(event.data);
            break;
      }
   }

   return result;
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
 * Streaming batch parser - processes files sequentially, yielding events.
 * Yields control between files for UI responsiveness.
 *
 * @param files - Array of files with filename and buffer
 * @param options - Stream options (encoding)
 * @yields BatchStreamEvent for each file start, transaction, completion, or error
 */
export async function* parseBatchStream(
   files: BatchFileInput[],
   options?: StreamOptions,
): AsyncGenerator<BatchStreamEvent> {
   let totalTransactions = 0;
   let errorCount = 0;

   for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      yield { type: "file_start", fileIndex: i, filename: file.filename };

      try {
         let fileTransactionCount = 0;

         // Decode buffer with proper charset detection
         const content = decodeOfxBuffer(file.buffer);

         // Create chunked async iterable
         const chunkIterable = createChunkIterable(content);

         for await (const event of parseStream(chunkIterable, options)) {
            switch (event.type) {
               case "header":
                  yield { type: "header", fileIndex: i, data: event.data };
                  break;
               case "transaction":
                  yield { type: "transaction", fileIndex: i, data: event.data };
                  fileTransactionCount++;
                  break;
               case "account":
                  yield { type: "account", fileIndex: i, data: event.data };
                  break;
               case "balance":
                  yield { type: "balance", fileIndex: i, data: event.data };
                  break;
               case "complete":
                  // Handled below
                  break;
            }
         }

         totalTransactions += fileTransactionCount;
         yield {
            type: "file_complete",
            fileIndex: i,
            filename: file.filename,
            transactionCount: fileTransactionCount,
         };
      } catch (err) {
         errorCount++;
         yield {
            type: "file_error",
            fileIndex: i,
            filename: file.filename,
            error: err instanceof Error ? err.message : String(err),
         };
      }

      // Yield control between files for UI responsiveness
      await new Promise((resolve) => setTimeout(resolve, 0));
   }

   yield {
      type: "batch_complete",
      totalFiles: files.length,
      totalTransactions,
      errorCount,
   };
}

/**
 * Convenience function that collects streaming batch results into arrays.
 *
 * @param files - Array of files with filename and buffer
 * @param options - Stream options (encoding)
 * @returns Array of parsed file results
 */
export async function parseBatchStreamToArray(
   files: BatchFileInput[],
   options?: StreamOptions,
): Promise<BatchParsedFile[]> {
   const results: BatchParsedFile[] = files.map((file, index) => ({
      fileIndex: index,
      filename: file.filename,
      transactions: [],
      accounts: [],
      balances: [],
   }));

   for await (const event of parseBatchStream(files, options)) {
      switch (event.type) {
         case "header": {
            const result = results[event.fileIndex];
            if (result) result.header = event.data;
            break;
         }
         case "transaction": {
            const result = results[event.fileIndex];
            if (result) result.transactions.push(event.data);
            break;
         }
         case "account": {
            const result = results[event.fileIndex];
            if (result) result.accounts.push(event.data);
            break;
         }
         case "balance": {
            const result = results[event.fileIndex];
            if (result) result.balances.push(event.data);
            break;
         }
         case "file_error": {
            const result = results[event.fileIndex];
            if (result) result.error = event.error;
            break;
         }
      }
   }

   return results;
}
