import { closeDb } from "./helpers/db";

export default async function globalTeardown() {
   await closeDb();
}
