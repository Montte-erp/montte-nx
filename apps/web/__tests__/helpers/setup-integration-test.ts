import { PGlite } from "@electric-sql/pglite";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { relations } from "@core/database/relations";
import { drizzle } from "drizzle-orm/pglite";
import { pushSchema } from "drizzle-kit/api-postgres";
import { vi } from "vitest";
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
         relations: typeof relations;
      }) => DatabaseInstance
   )({
      client,
      schema,
      relations,
   });

   const { apply } = await pushSchema(
      schema,
      db as unknown as Parameters<typeof pushSchema>[1],
      "snake_case",
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
            session.session.activeOrganizationId =
               options.organizationId === "auto"
                  ? org.id
                  : options.organizationId;
            session.session.activeTeamId =
               options.teamId === "auto" ? team.id : options.teamId;
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
