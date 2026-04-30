import { apiKeyClient } from "@better-auth/api-key/client";
import {
   emailOTPClient,
   inferAdditionalFields,
   lastLoginMethodClient,
   magicLinkClient,
   organizationClient,
   twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient as createBetterAuthClient } from "better-auth/react";
import type { AuthInstance } from "@core/authentication/server";
import { toast } from "sonner";
import { invalidateAllQueries } from "./query-bridge";

export const authClient = createBetterAuthClient({
   baseURL: "",
   fetchOptions: {
      onError: (context) => {
         const path = "auth";
         const code = `HTTP_${context.response.status}`;
         const message = context.error?.message || context.response.statusText;
         toast.error(message, { description: `${path} (${code})` });
      },
      onSuccess: () => {
         invalidateAllQueries();
      },
   },
   plugins: [
      inferAdditionalFields<AuthInstance>(),
      magicLinkClient(),
      emailOTPClient(),
      organizationClient({ teams: { enabled: true } }),
      apiKeyClient(),
      twoFactorClient(),
      lastLoginMethodClient(),
   ],
});

export const { useSession, signIn, signUp, signOut } = authClient;

export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
