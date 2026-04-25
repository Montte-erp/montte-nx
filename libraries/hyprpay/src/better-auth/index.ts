import type { BetterAuthPlugin } from "better-auth";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { fromPromise } from "neverthrow";
import { createHyprPayClient } from "../client";
import type { HyprPayCustomerFromContract as HyprPayCustomer } from "../contract";

interface HyprPayPluginOptions {
   client: ReturnType<typeof createHyprPayClient>;
   createCustomerOnSignUp?: boolean;
   syncCustomerOnUpdate?: boolean;
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
   const { client } = options;

   const defaultMapper = (user: {
      id: string;
      name: string;
      email: string;
   }) => ({
      name: user.name || user.email,
      email: user.email,
      externalId: user.id,
   });

   const mapper = options.customerData ?? defaultMapper;

   return {
      id: "hyprpay",
      init() {
         return {
            options: {
               databaseHooks: {
                  user: {
                     create: {
                        after: async (user) => {
                           if (!options.createCustomerOnSignUp) return;

                           const input = mapper(user);
                           const result = await client.customers.create(input);

                           if (result.isErr()) {
                              console.error(
                                 "[hyprpay] customer creation failed",
                                 result.error,
                              );
                              return;
                           }

                           if (!options.onCustomerCreate) return;

                           const onCreateResult = await fromPromise(
                              options.onCustomerCreate(result.value, user),
                              (e) => e,
                           );
                           if (onCreateResult.isErr()) {
                              console.error(
                                 "[hyprpay] onCustomerCreate threw",
                                 onCreateResult.error,
                              );
                           }
                        },
                     },
                     update: {
                        after: async (user) => {
                           if (!options.syncCustomerOnUpdate) return;
                           if (!user.name) return;

                           const result = await client.customers.update(
                              user.id,
                              { name: user.name },
                           );
                           if (result.isErr()) {
                              console.error(
                                 "[hyprpay] customer name sync failed",
                                 result.error,
                              );
                           }
                        },
                     },
                  },
               },
            },
         };
      },
   };
}

export function hyprpayClient(): BetterAuthClientPlugin {
   return {
      id: "hyprpay",
      $InferServerPlugin: {} as ReturnType<typeof hyprpay>,
   };
}
