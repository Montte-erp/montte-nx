import type { BetterAuthPlugin } from "better-auth";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { createHyprPayClient } from "../client";
import type { HyprPayCustomerFromContract as HyprPayCustomer } from "../contract";

interface HyprPayPluginOptions {
   apiKey: string;
   baseUrl?: string;
   createCustomerOnSignUp?: boolean;
   customerData?: (user: { id: string; name: string; email: string }) => {
      name: string;
      email?: string;
      externalId?: string;
      phone?: string;
      document?: string;
   };
   onCustomerCreate?: (
      customer: HyprPayCustomer,
      user: { id: string; name: string; email: string },
   ) => Promise<void>;
}

export function hyprpay(options: HyprPayPluginOptions): BetterAuthPlugin {
   const sdkClient = createHyprPayClient({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
   });

   const defaultMapper = (user: {
      id: string;
      name: string;
      email: string;
   }) => ({
      name: user.name,
      email: user.email,
      externalId: user.id,
   });

   const mapper = options.customerData ?? defaultMapper;

   return {
      id: "hyprpay",
      hooks: {
         after: [
            {
               matcher: (context) =>
                  context.path === "/sign-up/email" ||
                  context.path === "/sign-up/email-otp" ||
                  context.path === "/sign-in/magic-link",
               handler: async (context) => {
                  if (!options.createCustomerOnSignUp) return;

                  const body = context.body as
                     | { user?: { id: string; name: string; email: string } }
                     | undefined;
                  const user = body?.user;
                  if (!user?.id) return;

                  try {
                     const input = mapper(user);
                     const customer = await sdkClient.customers.create(input);
                     await options.onCustomerCreate?.(customer, user);
                  } catch {
                     // Non-blocking — never fail signup because of HyprPay
                  }
               },
            },
         ],
      },
   };
}

export function hyprpayClient(): BetterAuthClientPlugin {
   return {
      id: "hyprpay",
      $InferServerPlugin: {} as ReturnType<typeof hyprpay>,
      getActions: ($fetch) => ({
         hyprpay: {
            getCustomer: () =>
               $fetch<HyprPayCustomer>("/hyprpay/customer", { method: "GET" }),
         },
      }),
   };
}
