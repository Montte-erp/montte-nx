import { wrapAuthHandler } from "@core/arcjet/auth-wrapper";
import { auth as authInstance } from "@core/authentication/server";

const protectedHandler = await wrapAuthHandler();

export const auth = {
   ...authInstance,
   handler: protectedHandler,
};
