/**
 * Encryption Service
 *
 * Provides server-side application-level encryption helpers for sensitive fields.
 * Uses AES-256-GCM encryption with the ENCRYPTION_KEY environment variable.
 *
 * Sensitive fields to encrypt:
 * - Transaction: description, notes
 * - Bill: description, notes
 * - Counterparty: notes
 */

import {
   decryptIfNeeded,
   encryptField,
   isEncrypted,
   type EncryptedData,
} from "./server";
import { createSearchIndex } from "./search-index";

/**
 * Gets the encryption key from environment
 * Returns null if encryption is not configured
 */
function getEncryptionKey(): string | null {
   const key = process.env.ENCRYPTION_KEY;
   if (!key || key.length !== 64) {
      return null;
   }
   return key;
}

/**
 * Gets the search key from environment
 * Returns null if search indexing is not configured
 */
function getSearchKey(): string | null {
   const key = process.env.SEARCH_KEY;
   if (!key || key.length !== 64) {
      return null;
   }
   return key;
}

/**
 * Checks if server-side encryption is enabled
 */
export function isEncryptionEnabled(): boolean {
   return getEncryptionKey() !== null;
}

/**
 * Generates a search index for blind index search if enabled
 * Returns null if description is empty or search key is not configured
 */
function generateSearchIndexIfEnabled(
   description: string | null | undefined,
): string | null {
   if (!description) return null;
   const searchKey = getSearchKey();
   if (!searchKey) return null;
   return createSearchIndex(description, searchKey);
}

/**
 * Decrypts a field value if it contains encrypted data
 * Handles JSON parsing and encryption detection
 */
function decryptFieldValue(
   field: string | null | undefined,
   key: string,
): string | null | undefined {
   if (!field) return field;
   try {
      const parsed = JSON.parse(field);
      if (isEncrypted(parsed)) {
         return decryptIfNeeded(parsed, key);
      }
      return field;
   } catch {
      return field;
   }
}

/**
 * Encrypts a value if encryption is enabled
 * Returns the original value if encryption is not configured
 */
export function encryptValue(value: string): string | EncryptedData {
   const key = getEncryptionKey();
   if (!key) {
      return value;
   }
   return encryptField(value, key);
}

/**
 * Decrypts a value if it's encrypted
 * Returns the original value if not encrypted or encryption is not configured
 */
export function decryptValue(value: string | EncryptedData): string {
   const key = getEncryptionKey();
   if (!key) {
      if (isEncrypted(value)) {
         throw new Error("Cannot decrypt: ENCRYPTION_KEY not configured");
      }
      return value as string;
   }
   return decryptIfNeeded(value, key);
}

/**
 * Encrypts sensitive fields in a transaction
 * Also generates search index for blind index search
 */
export function encryptTransactionFields<
   T extends {
      description?: string | null;
      notes?: string | null;
      searchIndex?: string | null;
   },
>(transaction: T): T {
   const encryptionKey = getEncryptionKey();
   const searchIndex = generateSearchIndexIfEnabled(transaction.description);

   if (!encryptionKey) {
      return {
         ...transaction,
         searchIndex,
      };
   }

   return {
      ...transaction,
      description: transaction.description
         ? JSON.stringify(encryptField(transaction.description, encryptionKey))
         : transaction.description,
      notes: transaction.notes
         ? JSON.stringify(encryptField(transaction.notes, encryptionKey))
         : transaction.notes,
      searchIndex,
   };
}

/**
 * Decrypts sensitive fields in a transaction
 */
export function decryptTransactionFields<
   T extends { description?: string | null; notes?: string | null },
>(transaction: T): T {
   const key = getEncryptionKey();
   if (!key) return transaction;

   return {
      ...transaction,
      description: decryptFieldValue(transaction.description, key),
      notes: decryptFieldValue(transaction.notes, key),
   } as T;
}

/**
 * Encrypts sensitive fields in a bill
 * Also generates search index for blind index search
 */
export function encryptBillFields<
   T extends {
      description?: string | null;
      notes?: string | null;
      searchIndex?: string | null;
   },
>(bill: T): T {
   const encryptionKey = getEncryptionKey();
   const searchIndex = generateSearchIndexIfEnabled(bill.description);

   if (!encryptionKey) {
      return {
         ...bill,
         searchIndex,
      };
   }

   return {
      ...bill,
      description: bill.description
         ? JSON.stringify(encryptField(bill.description, encryptionKey))
         : bill.description,
      notes: bill.notes
         ? JSON.stringify(encryptField(bill.notes, encryptionKey))
         : bill.notes,
      searchIndex,
   };
}

/**
 * Decrypts sensitive fields in a bill
 */
export function decryptBillFields<
   T extends { description?: string | null; notes?: string | null },
>(bill: T): T {
   const key = getEncryptionKey();
   if (!key) return bill;

   return {
      ...bill,
      description: decryptFieldValue(bill.description, key),
      notes: decryptFieldValue(bill.notes, key),
   } as T;
}

/**
 * Encrypts sensitive fields in a counterparty
 */
export function encryptCounterpartyFields<T extends { notes?: string | null }>(
   counterparty: T,
): T {
   const key = getEncryptionKey();
   if (!key) return counterparty;

   return {
      ...counterparty,
      notes: counterparty.notes
         ? JSON.stringify(encryptField(counterparty.notes, key))
         : counterparty.notes,
   };
}

/**
 * Decrypts sensitive fields in a counterparty
 */
export function decryptCounterpartyFields<T extends { notes?: string | null }>(
   counterparty: T,
): T {
   const key = getEncryptionKey();
   if (!key) return counterparty;

   return {
      ...counterparty,
      notes: decryptFieldValue(counterparty.notes, key),
   } as T;
}

/**
 * Helper to decrypt an array of items
 */
export function decryptArray<T>(items: T[], decryptFn: (item: T) => T): T[] {
   return items.map(decryptFn);
}
