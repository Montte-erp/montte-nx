import { config as loadEnv } from "dotenv";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { fromThrowable } from "neverthrow";
import { Pool } from "pg";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import {
   invitation as invitationTable,
   member,
   organization,
   team,
   user as userTable,
} from "@core/database/schemas/auth";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";

loadEnv({
   path: path.join(import.meta.dirname, "..", "..", "web", ".env.local"),
});

assertLocalOnly();

function assertLocalOnly() {
   const url = process.env.DATABASE_URL;
   if (!url) {
      throw new Error("DATABASE_URL is not set for e2e");
   }
   const parse = fromThrowable(
      (raw: string) => new URL(raw),
      () => null,
   );
   const host = parse(url)
      .map((u) => u.host)
      .unwrapOr("");
   if (!/^(localhost|127\.0\.0\.1)(:|$)/.test(host)) {
      throw new Error(
         `e2e refuses non-local DATABASE_URL: "${url}". Only localhost/127.0.0.1 allowed.`,
      );
   }
}

type CachedDb = {
   db: DatabaseInstance;
   pool: Pool;
};

let cachedDb: CachedDb | undefined;

function db(): DatabaseInstance {
   if (!cachedDb) {
      const pool = new Pool({
         connectionString: process.env.DATABASE_URL ?? "",
         max: 2,
      });
      cachedDb = {
         db: drizzle({
            casing: "snake_case",
            client: pool,
            schema,
         }),
         pool,
      };
   }
   return cachedDb.db;
}

export async function closeDb() {
   if (!cachedDb) return;
   await cachedDb.pool.end();
   cachedDb = undefined;
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

export async function findTeamByOrgAndSlug(orgSlug: string, teamSlug: string) {
   const org = await db().query.organization.findFirst({
      where: (f, { eq: eqOp }) => eqOp(f.slug, orgSlug),
   });
   if (!org) return null;

   return db().query.team.findFirst({
      where: (f, { and, eq: eqOp }) =>
         and(eqOp(f.organizationId, org.id), eqOp(f.slug, teamSlug)),
   });
}

export async function clearOrganizationLogoForEmail(email: string) {
   const org = await findFirstOrgByUserEmail(email);
   if (!org) return;
   await db()
      .update(organization)
      .set({ logo: null })
      .where(eq(organization.id, org.id));
}

export async function findPendingInvitationByEmail(email: string) {
   return db().query.invitation.findFirst({
      where: (f, { eq, and }) =>
         and(eq(f.email, email), eq(f.status, "pending")),
   });
}

export async function findInvitationByEmail(email: string) {
   return db().query.invitation.findFirst({
      where: (f, { eq }) => eq(f.email, email),
      orderBy: (f, { desc }) => [desc(f.createdAt)],
   });
}

export async function isUserMemberOfOrgByEmail(
   email: string,
   organizationId: string,
) {
   const u = await findUserByEmail(email);
   if (!u) return false;
   const m = await db().query.member.findFirst({
      where: (f, { eq, and }) =>
         and(eq(f.userId, u.id), eq(f.organizationId, organizationId)),
   });
   return !!m;
}

export async function deleteInvitationsByEmail(email: string) {
   await db().delete(invitationTable).where(eq(invitationTable.email, email));
}

export async function deleteUserByEmail(email: string) {
   const u = await findUserByEmail(email);
   if (!u) return;
   await db().delete(userTable).where(eq(userTable.id, u.id));
}

export async function clearUserName(email: string) {
   await db()
      .update(userTable)
      .set({ name: "" })
      .where(eq(userTable.email, email));
}

export async function markOnboardingIncomplete(orgSlug: string) {
   const org = await db().query.organization.findFirst({
      where: (f, { eq: eqOp }) => eqOp(f.slug, orgSlug),
   });
   if (!org) return;
   await db()
      .update(organization)
      .set({ onboardingCompleted: false })
      .where(eq(organization.id, org.id));
   await db()
      .update(team)
      .set({ onboardingCompleted: false })
      .where(eq(team.organizationId, org.id));
}

export async function findTeamsByOrgSlug(orgSlug: string) {
   const org = await db().query.organization.findFirst({
      where: (f, { eq: eqOp }) => eqOp(f.slug, orgSlug),
   });
   if (!org) return [];
   return db().query.team.findMany({
      where: (f, { eq: eqOp }) => eqOp(f.organizationId, org.id),
   });
}

export async function addMemberToOrg(
   userId: string,
   organizationId: string,
   role = "member",
) {
   await db().insert(member).values({
      userId,
      organizationId,
      role,
      createdAt: new Date(),
   });
}

export async function findBankAccountByName(teamId: string, name: string) {
   return db().query.bankAccounts.findFirst({
      where: (f, { and, eq }) => and(eq(f.teamId, teamId), eq(f.name, name)),
   });
}

export async function deleteBankAccountById(teamId: string, id: string) {
   await db()
      .delete(bankAccounts)
      .where(and(eq(bankAccounts.teamId, teamId), eq(bankAccounts.id, id)));
}

export async function findTransactionByName(teamId: string, name: string) {
   return db().query.transactions.findFirst({
      where: (f, { and, eq }) => and(eq(f.teamId, teamId), eq(f.name, name)),
   });
}

export async function deleteTransactionById(teamId: string, id: string) {
   await db()
      .delete(transactions)
      .where(and(eq(transactions.teamId, teamId), eq(transactions.id, id)));
}

export async function countMemberOrgsByEmail(email: string) {
   const u = await findUserByEmail(email);
   if (!u) return 0;
   const members = await db().query.member.findMany({
      where: (f, { eq: eqOp }) => eqOp(f.userId, u.id),
   });
   return members.length;
}
