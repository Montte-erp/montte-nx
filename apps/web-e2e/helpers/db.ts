import { config as loadEnv } from "dotenv";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createDb, type DatabaseInstance } from "@core/database/client";
import { organization, user as userTable } from "@core/database/schemas/auth";

loadEnv({
   path: path.join(import.meta.dirname, "..", "..", "web", ".env.local"),
});

assertLocalOnly();

function assertLocalOnly() {
   const url = process.env.DATABASE_URL ?? "";
   const host = (() => {
      try {
         return new URL(url).host;
      } catch {
         return "";
      }
   })();
   if (!/^(localhost|127\.0\.0\.1)(:|$)/.test(host)) {
      throw new Error(
         `e2e refuses non-local DATABASE_URL: "${url}". Only localhost/127.0.0.1 allowed.`,
      );
   }
}

let cachedDb: DatabaseInstance | undefined;

function db(): DatabaseInstance {
   if (!cachedDb) {
      cachedDb = createDb({
         databaseUrl: process.env.DATABASE_URL ?? "",
         max: 2,
      });
   }
   return cachedDb;
}

export async function findUserByEmail(email: string) {
   return db().query.user.findFirst({ where: eq(userTable.email, email) });
}

export async function findFirstOrgByUserEmail(email: string) {
   const u = await findUserByEmail(email);
   if (!u) return null;
   const member = await db().query.member.findFirst({
      where: (f, { eq: eqOp }) => eqOp(f.userId, u.id),
      with: { organization: true },
   });
   return member?.organization ?? null;
}

export async function clearOrganizationLogoForEmail(email: string) {
   const org = await findFirstOrgByUserEmail(email);
   if (!org) return;
   await db()
      .update(organization)
      .set({ logo: null })
      .where(eq(organization.id, org.id));
}

export async function deleteUserByEmail(email: string) {
   const u = await findUserByEmail(email);
   if (!u) return;
   await db().delete(userTable).where(eq(userTable.id, u.id));
}
