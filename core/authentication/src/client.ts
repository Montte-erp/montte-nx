import { apiKey } from "@better-auth/api-key";
import { stripeClient } from "@better-auth/stripe/client";
import {
   adminClient,
   emailOTPClient,
   inferAdditionalFields,
   lastLoginMethodClient,
   magicLinkClient,
   organizationClient,
   twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient as createBetterAuthClient } from "better-auth/react";
import type { AuthInstance } from "@core/authentication/server";

export interface AuthClientError {
   status: number;
   statusText: string;
   message?: string;
}

export interface AuthClientOptions {
   apiBaseUrl: string;
   onSuccess?: () => void;
   onError?: (error: AuthClientError) => void;
}

export const createAuthClient = ({
   apiBaseUrl,
   onSuccess,
   onError,
}: AuthClientOptions) =>
   createBetterAuthClient({
      baseURL: apiBaseUrl,

      fetchOptions: {
         onError: (context) => {
            onError?.({
               message: context.error?.message,
               status: context.response.status,
               statusText: context.response.statusText,
            });
         },
         onSuccess: () => {
            onSuccess?.();
         },
      },
      plugins: [
         inferAdditionalFields<AuthInstance>(),
         stripeClient({
            subscription: true,
         }),
         magicLinkClient(),
         emailOTPClient(),
         adminClient(),
         organizationClient({
            teams: {
               enabled: true,
            },
         }),
         apiKey(),
         twoFactorClient(),
         lastLoginMethodClient(),
      ],
   });
