import { PGlite } from "@electric-sql/pglite";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { session as sessionTable } from "@core/database/schemas/auth";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { pushSchema } from "drizzle-kit/api";
import { vi } from "vitest";
import type { createJobPublisher } from "@packages/notifications/publisher";
import { createTestAuth } from "./create-test-auth";
import { testStore } from "./test-store";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";

let cachedDb: DatabaseInstance | null = null;
let cachedClient: PGlite | null = null;

export async function setupIntegrationDb(): Promise<DatabaseInstance> {
   if (cachedDb) return cachedDb;

   const client = new PGlite();
   const db = (
      drizzle as unknown as (opts: {
         client: PGlite;
         schema: typeof schema;
      }) => DatabaseInstance
   )({
      client,
      schema,
   });

   const { apply } = await pushSchema(
      schema,
      db as unknown as Parameters<typeof pushSchema>[1],
      ["public", "auth", "platform", "finance", "crm", "inventory"],
   );
   await apply();

   cachedClient = client;
   cachedDb = db;
   testStore.db = db;

   return db;
}

let counter = 0;

export async function setupIntegrationTest() {
   const db = await setupIntegrationDb();
   const auth = createTestAuth(db);
   testStore.auth = auth;
   const ctx = await auth.$context;
   const testHelpers = ctx.test;

   async function createAuthenticatedContext(options?: {
      organizationId?: string;
      teamId?: string;
   }): Promise<ORPCContextWithAuth> {
      counter++;
      const email = `test-${counter}-${Date.now()}@example.com`;
      const name = `Test User ${counter}`;

      const signUpResult = await auth.api.signUpEmail({
         body: {
            email,
            password: "test-password-123",
            name,
         },
      });

      const loginResult = await testHelpers.login({
         userId: signUpResult.user.id,
      });
      const headers = new Headers(loginResult.headers);

      let session = await auth.api.getSession({ headers });

      if (options?.organizationId && options?.teamId) {
         const org = await auth.api.createOrganization({
            body: {
               name: `Test Org ${counter}`,
               slug: `test-org-${counter}-${Date.now()}`,
            },
            headers,
         });

         const team = await auth.api.createTeam({
            body: {
               name: `Test Team ${counter}`,
               organizationId: org.id,
               slug: `test-team-${counter}`,
            },
            headers,
         });

         await auth.api.setActiveOrganization({
            body: { organizationId: org.id },
            headers,
         });

         session = await auth.api.getSession({ headers });

         if (session) {
            const resolvedOrgId =
               options.organizationId === "auto"
                  ? org.id
                  : options.organizationId;
            const resolvedTeamId =
               options.teamId === "auto" ? team.id : options.teamId;

            session.session.activeOrganizationId = resolvedOrgId;
            session.session.activeTeamId = resolvedTeamId;

            await db
               .update(sessionTable)
               .set({
                  activeOrganizationId: resolvedOrgId,
                  activeTeamId: resolvedTeamId,
               })
               .where(eq(sessionTable.id, session.session.id));
         }
      }

      return {
         headers,
         request: new Request("http://localhost:3000", { headers }),
         auth: auth as unknown as ORPCContextWithAuth["auth"],
         db,
         session: session as ORPCContextWithAuth["session"],
         posthog: {
            capture: vi.fn(),
            identify: vi.fn(),
            groupIdentify: vi.fn(),
            shutdown: vi.fn(),
         } as unknown as ORPCContextWithAuth["posthog"],
         stripeClient: undefined,
         jobPublisher: {
            publish: vi.fn(),
            subscribe: vi.fn(),
         } as unknown as ReturnType<typeof createJobPublisher>,
      };
   }

   return {
      db,
      auth,
      testHelpers,
      createAuthenticatedContext,
   };
}

export async function cleanupIntegrationTest() {
   if (cachedClient) {
      await cachedClient.close();
      cachedClient = null;
      cachedDb = null;
      testStore.db = null;
      testStore.auth = null;
   }
}
