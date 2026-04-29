export interface IdempotencyRecord<T = unknown> {
   key: string;
   response: T;
   createdAt: Date;
   expiresAt?: Date;
}

export interface IdempotencyStore {
   get(key: string): Promise<IdempotencyRecord | null>;
   put(
      key: string,
      response: unknown,
      opts?: { ttlSeconds?: number },
   ): Promise<void>;
   delete(key: string): Promise<void>;
}

export function deriveKey(...parts: ReadonlyArray<string | number>): string {
   return parts.map((p) => String(p)).join(":");
}

export function webhookKey(gatewayId: string, eventId: string): string {
   return deriveKey("webhook", gatewayId, eventId);
}

export function retryKey(callerKey: string, attempt: number): string {
   return deriveKey("retry", callerKey, attempt);
}

export function createMemoryIdempotencyStore(): IdempotencyStore {
   const store = new Map<string, IdempotencyRecord>();
   return {
      async get(key) {
         const record = store.get(key);
         if (!record) return null;
         if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
            store.delete(key);
            return null;
         }
         return record;
      },
      async put(key, response, opts) {
         const expiresAt = opts?.ttlSeconds
            ? new Date(Date.now() + opts.ttlSeconds * 1000)
            : undefined;
         store.set(key, { key, response, createdAt: new Date(), expiresAt });
      },
      async delete(key) {
         store.delete(key);
      },
   };
}
