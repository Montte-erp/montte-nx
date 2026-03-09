import { createAuth } from "@core/authentication/server";
import { createDb } from "@core/database/client";
import { env } from "@core/environment/server";

// Create singleton instances at module level (created once when imported)
const db = createDb({ databaseUrl: env.DATABASE_URL });
const auth = createAuth({ db, env });

export function getAuth() {
   return auth;
}

export type AuthInstance = typeof auth;
