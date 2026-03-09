import { wrapAuthHandler } from "@packages/arcjet/auth-wrapper";
import { createAuth } from "@core/authentication/server";
import { env } from "@core/environment/server";
import { db } from "./database";

const authInstance = createAuth({
   db,
   env,
});

const protectedHandler = await wrapAuthHandler(authInstance);

export const auth = {
   ...authInstance,
   handler: protectedHandler,
};
