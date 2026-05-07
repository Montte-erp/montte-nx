import { test as base } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";

const sessionSchema = z.object({
   email: z.string(),
   orgSlug: z.string(),
   teamSlug: z.string(),
});

export type E2ESession = z.infer<typeof sessionSchema>;

const SESSION_FILE = path.join(import.meta.dirname, ".auth", "session.json");

function readSession(): E2ESession {
   const raw = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
   return sessionSchema.parse(raw);
}

type Fixtures = { e2eSession: E2ESession };

export const test = base.extend<Fixtures>({
   storageState: path.join(import.meta.dirname, ".auth", "user.json"),
   // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature
   e2eSession: async ({}, use) => use(readSession()),
});

export { expect } from "@playwright/test";
