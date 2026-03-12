import type { betterAuth } from "better-auth";
import { auth } from "@core/authentication/server";

/**
 * @internal
 *
 * This export is needed strictly for the CLI to work with
 *     pnpm auth:schema:generate
 *
 * It should not be imported or used for any other purpose.
 *
 * The documentation for better-auth CLI can be found here:
 * - https://www.better-auth.com/docs/concepts/cli
 */
export default auth as unknown as ReturnType<typeof betterAuth>;
