import type { BetterAuthPlugin } from "better-auth";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { fromPromise } from "neverthrow";
import { createHyprPayClient } from "../client";
import type { ContractRouterClient } from "@orpc/contract";
import type { billingContract } from "../contract";

type HyprPayContact = Awaited<
   ReturnType<
      ContractRouterClient<typeof billingContract>["contacts"]["create"]
   >
>;

type CustomerInput = {
   name: string;
   type?: "cliente" | "fornecedor" | "ambos";
   email?: string | null;
   phone?: string | null;
   document?: string | null;
   externalId?: string | null;
};

interface HyprPayPluginOptions {
   apiKey: string;
   baseUrl?: string;
   createCustomerOnSignUp?: boolean;
   syncCustomerOnUpdate?: boolean;
   customerData?: (user: {
      id: string;
      name: string;
      email: string;
   }) => CustomerInput;
   onCustomerCreate?: (
      contact: HyprPayContact,
      user: { id: string; name: string; email: string },
   ) => Promise<void>;
}

export function hyprpay(options: HyprPayPluginOptions): BetterAuthPlugin {
   const sdkClient = createHyprPayClient({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
   });

   const defaultMapper: (user: {
      id: string;
      name: string;
      email: string;
   }) => CustomerInput = (user) => ({
      name: user.name || user.email,
      type: "cliente",
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
                           const result = await fromPromise(
                              sdkClient.contacts.create({
                                 name: input.name,
                                 type: input.type ?? "cliente",
                                 email: input.email ?? null,
                                 phone: input.phone ?? null,
                                 document: input.document ?? null,
                                 externalId: input.externalId ?? user.id,
                              }),
                              (e) => e,
                           );

                           if (result.isErr()) {
                              console.error(
                                 "[hyprpay] contact creation failed",
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

                           const result = await fromPromise(
                              sdkClient.contacts.update({
                                 externalId: user.id,
                                 name: user.name,
                              }),
                              (e) => e,
                           );
                           if (result.isErr()) {
                              console.error(
                                 "[hyprpay] contact name sync failed",
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
