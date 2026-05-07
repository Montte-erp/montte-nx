import { config as loadEnv } from "dotenv";
import path from "node:path";
import { eq } from "drizzle-orm";
import { fromThrowable } from "neverthrow";
import { createDb, type DatabaseInstance } from "@core/database/client";
import {
   member,
   organization,
   team,
   user as userTable,
} from "@core/database/schemas/auth";

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

export async function closeDb() {
   if (!cachedDb) return;
   await cachedDb.$client.end();
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

export async function countMemberOrgsByEmail(email: string) {
   const u = await findUserByEmail(email);
   if (!u) return 0;
   const members = await db().query.member.findMany({
      where: (f, { eq: eqOp }) => eqOp(f.userId, u.id),
   });
   return members.length;
}
