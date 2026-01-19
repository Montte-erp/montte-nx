/**
 * @packages/encryption
 *
 * Server-side encryption system for Montte:
 *
 * Application-Level Encryption (server.ts)
 *    - Server encrypts sensitive fields with ENCRYPTION_KEY environment variable
 *    - Transparent to user - no action required
 *    - Server can still search/query encrypted data (decrypts on server)
 */

// Server-side encryption exports
export {
   encryptField,
   decryptField,
   isEncrypted,
   type EncryptedData,
} from "./server";
