import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { setupTestDb } from "../../src/testing/setup-test-db";
import { seedTeam, seedUser } from "../../src/testing/factories";
import { organization, team, user } from "../../src/schemas/auth";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

describe("seedTeam", () => {
   it("inserts organization and team rows and returns their IDs", async () => {
      const { organizationId, teamId } = await seedTeam(testDb.db);

      const [org] = await testDb.db
         .select()
         .from(organization)
         .where(eq(organization.id, organizationId));
      expect(org?.id).toBe(organizationId);

      const [row] = await testDb.db
         .select()
         .from(team)
         .where(eq(team.id, teamId));
      expect(row?.organizationId).toBe(organizationId);
   });
});

describe("seedUser", () => {
   it("inserts user row and returns the ID with a matching email", async () => {
      const userId = await seedUser(testDb.db);
      const [row] = await testDb.db
         .select()
         .from(user)
         .where(eq(user.id, userId));
      expect(row?.email).toBe(`test-${userId}@example.com`);
   });
});
