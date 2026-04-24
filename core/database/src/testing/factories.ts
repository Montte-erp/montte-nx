import { seed } from "drizzle-seed";
import type { DatabaseInstance } from "../client";
import * as schema from "../schema";

function rand() {
   return Math.floor(Math.random() * 1_000_000);
}

export async function seedTeam(db: DatabaseInstance) {
   const organizationId = crypto.randomUUID();
   const teamId = crypto.randomUUID();
   const now = new Date();
   await seed(
      db,
      { organization: schema.organization },
      { seed: rand() },
   ).refine((f) => ({
      organization: {
         count: 1,
         columns: {
            id: f.default({ defaultValue: organizationId }),
            createdAt: f.default({ defaultValue: now }),
         },
      },
   }));
   await seed(db, { team: schema.team }, { seed: rand() }).refine((f) => ({
      team: {
         count: 1,
         columns: {
            id: f.default({ defaultValue: teamId }),
            organizationId: f.default({ defaultValue: organizationId }),
            createdAt: f.default({ defaultValue: now }),
         },
      },
   }));
   return { organizationId, teamId };
}

export async function seedUser(db: DatabaseInstance) {
   const userId = crypto.randomUUID();
   await seed(db, { user: schema.user }, { seed: rand() }).refine((f) => ({
      user: {
         count: 1,
         columns: {
            id: f.default({ defaultValue: userId }),
            email: f.default({ defaultValue: `test-${userId}@example.com` }),
         },
      },
   }));
   return userId;
}
