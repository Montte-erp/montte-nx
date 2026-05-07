import { test as base } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

export type E2ESession = {
   email: string;
   orgSlug: string;
   teamSlug: string;
};

const SESSION_FILE = path.join(import.meta.dirname, ".auth", "session.json");

function readSession(): E2ESession {
   return JSON.parse(fs.readFileSync(SESSION_FILE, "utf8")) as E2ESession;
}

type Fixtures = { e2eSession: E2ESession };

export const test = base.extend<Fixtures>({
   storageState: path.join(import.meta.dirname, ".auth", "user.json"),
   // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature
   e2eSession: async ({}, use) => use(readSession()),
});

export { expect } from "@playwright/test";
