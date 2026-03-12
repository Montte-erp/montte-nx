import { wrapAuthHandler } from "@packages/arcjet/auth-wrapper";
import { auth as authInstance } from "@core/authentication/server";

const protectedHandler = await wrapAuthHandler(authInstance);

export const auth = {
   ...authInstance,
   handler: protectedHandler,
};
