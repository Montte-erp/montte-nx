import type Stripe from "stripe";
import { z } from "zod";
import type { DatabaseInstance } from "@core/database/client";
import type { PostHog } from "@core/posthog/server";
import type { Redis } from "@core/redis/connection";
import type { ResendClient } from "@core/transactional/utils";
export declare const ORGANIZATION_LIMIT = 3;
export declare function getDevMagicLink(email: string): string | undefined;
export interface CreateAuthDeps {
   db: DatabaseInstance;
   redis: Redis;
   posthog: PostHog;
   stripeClient: Stripe;
   resendClient: ResendClient;
   env: {
      BETTER_AUTH_URL?: string;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_TRUSTED_ORIGINS: string;
      BETTER_AUTH_GOOGLE_CLIENT_ID: string;
      BETTER_AUTH_GOOGLE_CLIENT_SECRET: string;
      STRIPE_WEBHOOK_SECRET: string;
      STRIPE_BOOST_PRICE_ID?: string;
      STRIPE_SCALE_PRICE_ID?: string;
      STRIPE_ENTERPRISE_PRICE_ID?: string;
   };
}
export declare function createAuth(
   deps: CreateAuthDeps,
): import("better-auth").Auth<{
   baseURL: string | undefined;
   secret: string;
   trustedOrigins: string[];
   account: {
      accountLinking: {
         enabled: true;
      };
   };
   socialProviders: {
      google: {
         clientId: string;
         clientSecret: string;
      };
   };
   advanced: {
      database: {
         generateId: "uuid";
      };
   };
   secondaryStorage: import("@core/authentication/cache").SecondaryStorage;
   database: (
      options: import("better-auth").BetterAuthOptions,
   ) => import("better-auth").DBAdapter<
      import("better-auth").BetterAuthOptions
   >;
   databaseHooks: {
      session: {
         create: {
            before: (
               session: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  userId: string;
                  expiresAt: Date;
                  token: string;
                  ipAddress?: string | null | undefined;
                  userAgent?: string | null | undefined;
               } & Record<string, unknown>,
            ) => Promise<{
               data: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  userId: string;
                  expiresAt: Date;
                  token: string;
                  ipAddress?: string | null | undefined;
                  userAgent?: string | null | undefined;
               } & Record<string, unknown>;
            }>;
         };
      };
      user: {
         create: {
            after: (
               _user: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
               } & Record<string, unknown>,
            ) => Promise<void>;
         };
      };
   };
   emailAndPassword: {
      enabled: true;
      requireEmailVerification: boolean;
   };
   emailVerification: {
      autoSignInAfterVerification: true;
      sendOnSignUp: boolean;
   };
   experimental: {
      joins: true;
   };
   session: {
      storeSessionInDatabase: true;
      cookieCache: {
         enabled: true;
         maxAge: number;
      };
   };
   user: {
      changeEmail: {
         enabled: true;
      };
      additionalFields: {
         telemetryConsent: {
            defaultValue: false;
            input: true;
            required: true;
            type: "boolean";
         };
      };
   };
   plugins: [
      {
         id: "admin";
         init(): {
            options: {
               databaseHooks: {
                  user: {
                     create: {
                        before(
                           user: {
                              id: string;
                              createdAt: Date;
                              updatedAt: Date;
                              email: string;
                              emailVerified: boolean;
                              name: string;
                              image?: string | null | undefined;
                           } & Record<string, unknown>,
                        ): Promise<{
                           data: {
                              id: string;
                              createdAt: Date;
                              updatedAt: Date;
                              email: string;
                              emailVerified: boolean;
                              name: string;
                              image?: string | null | undefined;
                              role: string;
                           };
                        }>;
                     };
                  };
                  session: {
                     create: {
                        before(
                           session: {
                              id: string;
                              createdAt: Date;
                              updatedAt: Date;
                              userId: string;
                              expiresAt: Date;
                              token: string;
                              ipAddress?: string | null | undefined;
                              userAgent?: string | null | undefined;
                           } & Record<string, unknown>,
                           ctx:
                              | import("better-auth").GenericEndpointContext
                              | null,
                        ): Promise<void>;
                     };
                  };
               };
            };
         };
         hooks: {
            after: {
               matcher(
                  context: import("better-auth").HookEndpointContext,
               ): boolean;
               handler: (
                  inputContext: import("better-call").MiddlewareInputContext<
                     import("better-call").MiddlewareOptions
                  >,
               ) => Promise<
                  | import("better-auth/plugins").SessionWithImpersonatedBy[]
                  | undefined
               >;
            }[];
         };
         endpoints: {
            setRole: import("better-call").StrictEndpoint<
               "/admin/set-role",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        userId: z.ZodCoercedString<unknown>;
                        role: z.ZodUnion<
                           readonly [z.ZodString, z.ZodArray<z.ZodString>]
                        >;
                     },
                     z.core.$strip
                  >;
                  requireHeaders: true;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          user: {
                                             $ref: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                     $Infer: {
                        body: {
                           userId: string;
                           role: "admin" | "user" | ("admin" | "user")[];
                        };
                     };
                  };
               },
               {
                  user: import("better-auth/plugins").UserWithRole;
               }
            >;
            getUser: import("better-call").StrictEndpoint<
               "/admin/get-user",
               {
                  method: "GET";
                  query: z.ZodObject<
                     {
                        id: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          user: {
                                             $ref: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               import("better-auth/plugins").UserWithRole
            >;
            createUser: import("better-call").StrictEndpoint<
               "/admin/create-user",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        email: z.ZodString;
                        password: z.ZodOptional<z.ZodString>;
                        name: z.ZodString;
                        role: z.ZodOptional<
                           z.ZodUnion<
                              readonly [z.ZodString, z.ZodArray<z.ZodString>]
                           >
                        >;
                        data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          user: {
                                             $ref: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                     $Infer: {
                        body: {
                           email: string;
                           password?: string | undefined;
                           name: string;
                           role?:
                              | "admin"
                              | "user"
                              | ("admin" | "user")[]
                              | undefined;
                           data?: Record<string, any> | undefined;
                        };
                     };
                  };
               },
               {
                  user: import("better-auth/plugins").UserWithRole;
               }
            >;
            adminUpdateUser: import("better-call").StrictEndpoint<
               "/admin/update-user",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        userId: z.ZodCoercedString<unknown>;
                        data: z.ZodRecord<z.ZodAny, z.ZodAny>;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          user: {
                                             $ref: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               import("better-auth/plugins").UserWithRole
            >;
            listUsers: import("better-call").StrictEndpoint<
               "/admin/list-users",
               {
                  method: "GET";
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                     };
                  }>)[];
                  query: z.ZodObject<
                     {
                        searchValue: z.ZodOptional<z.ZodString>;
                        searchField: z.ZodOptional<
                           z.ZodEnum<{
                              name: "name";
                              email: "email";
                           }>
                        >;
                        searchOperator: z.ZodOptional<
                           z.ZodEnum<{
                              contains: "contains";
                              starts_with: "starts_with";
                              ends_with: "ends_with";
                           }>
                        >;
                        limit: z.ZodOptional<
                           z.ZodUnion<[z.ZodString, z.ZodNumber]>
                        >;
                        offset: z.ZodOptional<
                           z.ZodUnion<[z.ZodString, z.ZodNumber]>
                        >;
                        sortBy: z.ZodOptional<z.ZodString>;
                        sortDirection: z.ZodOptional<
                           z.ZodEnum<{
                              asc: "asc";
                              desc: "desc";
                           }>
                        >;
                        filterField: z.ZodOptional<z.ZodString>;
                        filterValue: z.ZodOptional<
                           z.ZodUnion<
                              [
                                 z.ZodUnion<
                                    [
                                       z.ZodUnion<
                                          [
                                             z.ZodUnion<
                                                [z.ZodString, z.ZodNumber]
                                             >,
                                             z.ZodBoolean,
                                          ]
                                       >,
                                       z.ZodArray<z.ZodString>,
                                    ]
                                 >,
                                 z.ZodArray<z.ZodNumber>,
                              ]
                           >
                        >;
                        filterOperator: z.ZodOptional<
                           z.ZodEnum<{
                              eq: "eq";
                              ne: "ne";
                              gt: "gt";
                              gte: "gte";
                              lt: "lt";
                              lte: "lte";
                              in: "in";
                              not_in: "not_in";
                              contains: "contains";
                              starts_with: "starts_with";
                              ends_with: "ends_with";
                           }>
                        >;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          users: {
                                             type: string;
                                             items: {
                                                $ref: string;
                                             };
                                          };
                                          total: {
                                             type: string;
                                          };
                                          limit: {
                                             type: string;
                                          };
                                          offset: {
                                             type: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  users: import("better-auth/plugins").UserWithRole[];
                  total: number;
               }
            >;
            listUserSessions: import("better-call").StrictEndpoint<
               "/admin/list-user-sessions",
               {
                  method: "POST";
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                     };
                  }>)[];
                  body: z.ZodObject<
                     {
                        userId: z.ZodCoercedString<unknown>;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          sessions: {
                                             type: string;
                                             items: {
                                                $ref: string;
                                             };
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  sessions: import("better-auth/plugins").SessionWithImpersonatedBy[];
               }
            >;
            unbanUser: import("better-call").StrictEndpoint<
               "/admin/unban-user",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        userId: z.ZodCoercedString<unknown>;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          user: {
                                             $ref: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  user: import("better-auth/plugins").UserWithRole;
               }
            >;
            banUser: import("better-call").StrictEndpoint<
               "/admin/ban-user",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        userId: z.ZodCoercedString<unknown>;
                        banReason: z.ZodOptional<z.ZodString>;
                        banExpiresIn: z.ZodOptional<z.ZodNumber>;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          user: {
                                             $ref: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  user: import("better-auth/plugins").UserWithRole;
               }
            >;
            impersonateUser: import("better-call").StrictEndpoint<
               "/admin/impersonate-user",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        userId: z.ZodCoercedString<unknown>;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          session: {
                                             $ref: string;
                                          };
                                          user: {
                                             $ref: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  session: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     userId: string;
                     expiresAt: Date;
                     token: string;
                     ipAddress?: string | null | undefined;
                     userAgent?: string | null | undefined;
                  };
                  user: import("better-auth/plugins").UserWithRole;
               }
            >;
            stopImpersonating: import("better-call").StrictEndpoint<
               "/admin/stop-impersonating",
               {
                  method: "POST";
                  requireHeaders: true;
               },
               {
                  session: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     userId: string;
                     expiresAt: Date;
                     token: string;
                     ipAddress?: string | null | undefined;
                     userAgent?: string | null | undefined;
                  } & Record<string, any>;
                  user: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  } & Record<string, any>;
               }
            >;
            revokeUserSession: import("better-call").StrictEndpoint<
               "/admin/revoke-user-session",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        sessionToken: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          success: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  success: boolean;
               }
            >;
            revokeUserSessions: import("better-call").StrictEndpoint<
               "/admin/revoke-user-sessions",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        userId: z.ZodCoercedString<unknown>;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          success: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  success: boolean;
               }
            >;
            removeUser: import("better-call").StrictEndpoint<
               "/admin/remove-user",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        userId: z.ZodCoercedString<unknown>;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          success: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  success: boolean;
               }
            >;
            setUserPassword: import("better-call").StrictEndpoint<
               "/admin/set-user-password",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        newPassword: z.ZodString;
                        userId: z.ZodCoercedString<unknown>;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          status: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  status: boolean;
               }
            >;
            userHasPermission: import("better-call").StrictEndpoint<
               "/admin/has-permission",
               {
                  method: "POST";
                  body: z.ZodIntersection<
                     z.ZodObject<
                        {
                           userId: z.ZodOptional<z.ZodCoercedString<unknown>>;
                           role: z.ZodOptional<z.ZodString>;
                        },
                        z.core.$strip
                     >,
                     z.ZodUnion<
                        readonly [
                           z.ZodObject<
                              {
                                 permission: z.ZodRecord<
                                    z.ZodString,
                                    z.ZodArray<z.ZodString>
                                 >;
                                 permissions: z.ZodUndefined;
                              },
                              z.core.$strip
                           >,
                           z.ZodObject<
                              {
                                 permission: z.ZodUndefined;
                                 permissions: z.ZodRecord<
                                    z.ZodString,
                                    z.ZodArray<z.ZodString>
                                 >;
                              },
                              z.core.$strip
                           >,
                        ]
                     >
                  >;
                  metadata: {
                     openapi: {
                        description: string;
                        requestBody: {
                           content: {
                              "application/json": {
                                 schema: {
                                    type: "object";
                                    properties: {
                                       permissions: {
                                          type: string;
                                          description: string;
                                       };
                                    };
                                    required: string[];
                                 };
                              };
                           };
                        };
                        responses: {
                           "200": {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          error: {
                                             type: string;
                                          };
                                          success: {
                                             type: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                     $Infer: {
                        body: {
                           permissions: {
                              readonly user?:
                                 | (
                                      | "ban"
                                      | "create"
                                      | "delete"
                                      | "get"
                                      | "impersonate"
                                      | "impersonate-admins"
                                      | "list"
                                      | "set-password"
                                      | "set-role"
                                      | "update"
                                   )[]
                                 | undefined;
                              readonly session?:
                                 | ("delete" | "list" | "revoke")[]
                                 | undefined;
                           };
                        } & {
                           userId?: string | undefined;
                           role?: "admin" | "user" | undefined;
                        };
                     };
                  };
               },
               {
                  error: null;
                  success: boolean;
               }
            >;
         };
         $ERROR_CODES: {
            USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: import("better-auth").RawError<"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL">;
            FAILED_TO_CREATE_USER: import("better-auth").RawError<"FAILED_TO_CREATE_USER">;
            USER_ALREADY_EXISTS: import("better-auth").RawError<"USER_ALREADY_EXISTS">;
            YOU_CANNOT_BAN_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_BAN_YOURSELF">;
            YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE">;
            YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS">;
            YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS">;
            YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS">;
            YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_BAN_USERS">;
            YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS">;
            YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS">;
            YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS">;
            YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD">;
            BANNED_USER: import("better-auth").RawError<"BANNED_USER">;
            YOU_ARE_NOT_ALLOWED_TO_GET_USER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_GET_USER">;
            NO_DATA_TO_UPDATE: import("better-auth").RawError<"NO_DATA_TO_UPDATE">;
            YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS">;
            YOU_CANNOT_REMOVE_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_REMOVE_YOURSELF">;
            YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE">;
            YOU_CANNOT_IMPERSONATE_ADMINS: import("better-auth").RawError<"YOU_CANNOT_IMPERSONATE_ADMINS">;
            INVALID_ROLE_TYPE: import("better-auth").RawError<"INVALID_ROLE_TYPE">;
         };
         schema: {
            user: {
               fields: {
                  role: {
                     type: "string";
                     required: false;
                     input: false;
                  };
                  banned: {
                     type: "boolean";
                     defaultValue: false;
                     required: false;
                     input: false;
                  };
                  banReason: {
                     type: "string";
                     required: false;
                     input: false;
                  };
                  banExpires: {
                     type: "date";
                     required: false;
                     input: false;
                  };
               };
            };
            session: {
               fields: {
                  impersonatedBy: {
                     type: "string";
                     required: false;
                  };
               };
            };
         };
         options: NoInfer<import("better-auth/plugins").AdminOptions>;
      },
      {
         id: "magic-link";
         endpoints: {
            signInMagicLink: import("better-call").StrictEndpoint<
               "/sign-in/magic-link",
               {
                  method: "POST";
                  requireHeaders: true;
                  body: z.ZodObject<
                     {
                        email: z.ZodEmail;
                        name: z.ZodOptional<z.ZodString>;
                        callbackURL: z.ZodOptional<z.ZodString>;
                        newUserCallbackURL: z.ZodOptional<z.ZodString>;
                        errorCallbackURL: z.ZodOptional<z.ZodString>;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          status: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  status: boolean;
               }
            >;
            magicLinkVerify: import("better-call").StrictEndpoint<
               "/magic-link/verify",
               {
                  method: "GET";
                  query: z.ZodObject<
                     {
                        token: z.ZodString;
                        callbackURL: z.ZodOptional<z.ZodString>;
                        errorCallbackURL: z.ZodOptional<z.ZodString>;
                        newUserCallbackURL: z.ZodOptional<z.ZodString>;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<void>)[];
                  requireHeaders: true;
                  metadata: {
                     openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          session: {
                                             $ref: string;
                                          };
                                          user: {
                                             $ref: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  token: string;
                  user: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  };
               }
            >;
         };
         rateLimit: {
            pathMatcher(path: string): boolean;
            window: number;
            max: number;
         }[];
         options: import("better-auth/plugins").MagicLinkOptions;
      },
      {
         id: "email-otp";
         init(ctx: import("better-auth").AuthContext):
            | {
                 options: {
                    emailVerification: {
                       sendVerificationEmail(
                          data: {
                             user: {
                                id: string;
                                createdAt: Date;
                                updatedAt: Date;
                                email: string;
                                emailVerified: boolean;
                                name: string;
                                image?: string | null | undefined;
                             };
                             url: string;
                             token: string;
                          },
                          request: Request | undefined,
                       ): Promise<void>;
                    };
                 };
              }
            | undefined;
         endpoints: {
            sendVerificationOTP: import("better-call").StrictEndpoint<
               "/email-otp/send-verification-otp",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        email: z.ZodString;
                        type: z.ZodEnum<{
                           "sign-in": "sign-in";
                           "change-email": "change-email";
                           "email-verification": "email-verification";
                           "forget-password": "forget-password";
                        }>;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          success: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  success: boolean;
               }
            >;
            createVerificationOTP: import("better-call").StrictEndpoint<
               string,
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        email: z.ZodString;
                        type: z.ZodEnum<{
                           "sign-in": "sign-in";
                           "change-email": "change-email";
                           "email-verification": "email-verification";
                           "forget-password": "forget-password";
                        }>;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "string";
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               string
            >;
            getVerificationOTP: import("better-call").StrictEndpoint<
               string,
               {
                  method: "GET";
                  query: z.ZodObject<
                     {
                        email: z.ZodString;
                        type: z.ZodEnum<{
                           "sign-in": "sign-in";
                           "change-email": "change-email";
                           "email-verification": "email-verification";
                           "forget-password": "forget-password";
                        }>;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                           "200": {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          otp: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               | {
                    otp: null;
                 }
               | {
                    otp: string;
                 }
            >;
            checkVerificationOTP: import("better-call").StrictEndpoint<
               "/email-otp/check-verification-otp",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        email: z.ZodString;
                        type: z.ZodEnum<{
                           "sign-in": "sign-in";
                           "change-email": "change-email";
                           "email-verification": "email-verification";
                           "forget-password": "forget-password";
                        }>;
                        otp: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          success: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  success: boolean;
               }
            >;
            verifyEmailOTP: import("better-call").StrictEndpoint<
               "/email-otp/verify-email",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        email: z.ZodString;
                        otp: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          status: {
                                             type: string;
                                             description: string;
                                             enum: boolean[];
                                          };
                                          token: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          user: {
                                             $ref: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               | {
                    status: boolean;
                    token: string;
                    user: {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & Record<string, any>;
                 }
               | {
                    status: boolean;
                    token: null;
                    user: {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & Record<string, any>;
                 }
            >;
            signInEmailOTP: import("better-call").StrictEndpoint<
               "/sign-in/email-otp",
               {
                  method: "POST";
                  body: z.ZodIntersection<
                     z.ZodObject<
                        {
                           email: z.ZodString;
                           otp: z.ZodString;
                           name: z.ZodOptional<z.ZodString>;
                           image: z.ZodOptional<z.ZodString>;
                        },
                        z.core.$strip
                     >,
                     z.ZodRecord<z.ZodString, z.ZodAny>
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          token: {
                                             type: string;
                                             description: string;
                                          };
                                          user: {
                                             $ref: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  token: string;
                  user: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  };
               }
            >;
            requestPasswordResetEmailOTP: import("better-call").StrictEndpoint<
               "/email-otp/request-password-reset",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        email: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          success: {
                                             type: string;
                                             description: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  success: boolean;
               }
            >;
            forgetPasswordEmailOTP: import("better-call").StrictEndpoint<
               "/forget-password/email-otp",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        email: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          success: {
                                             type: string;
                                             description: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  success: boolean;
               }
            >;
            resetPasswordEmailOTP: import("better-call").StrictEndpoint<
               "/email-otp/reset-password",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        email: z.ZodString;
                        otp: z.ZodString;
                        password: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          success: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  success: boolean;
               }
            >;
            requestEmailChangeEmailOTP: import("better-call").StrictEndpoint<
               "/email-otp/request-email-change",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        newEmail: z.ZodString;
                        otp: z.ZodOptional<z.ZodString>;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        session: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           email: string;
                           emailVerified: boolean;
                           name: string;
                           image?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          success: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  success: boolean;
               }
            >;
            changeEmailEmailOTP: import("better-call").StrictEndpoint<
               "/email-otp/change-email",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        newEmail: z.ZodString;
                        otp: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        session: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           email: string;
                           emailVerified: boolean;
                           name: string;
                           image?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          success: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  success: boolean;
               }
            >;
         };
         hooks: {
            after: {
               matcher(
                  context: import("better-auth").HookEndpointContext,
               ): boolean;
               handler: (
                  inputContext: import("better-call").MiddlewareInputContext<
                     import("better-call").MiddlewareOptions
                  >,
               ) => Promise<void>;
            }[];
         };
         rateLimit: (
            | {
                 pathMatcher(
                    path: string,
                 ): path is "/email-otp/send-verification-otp";
                 window: number;
                 max: number;
              }
            | {
                 pathMatcher(
                    path: string,
                 ): path is "/email-otp/check-verification-otp";
                 window: number;
                 max: number;
              }
            | {
                 pathMatcher(path: string): path is "/email-otp/verify-email";
                 window: number;
                 max: number;
              }
            | {
                 pathMatcher(path: string): path is "/sign-in/email-otp";
                 window: number;
                 max: number;
              }
            | {
                 pathMatcher(
                    path: string,
                 ): path is "/email-otp/request-password-reset";
                 window: number;
                 max: number;
              }
            | {
                 pathMatcher(path: string): path is "/email-otp/reset-password";
                 window: number;
                 max: number;
              }
            | {
                 pathMatcher(
                    path: string,
                 ): path is "/forget-password/email-otp";
                 window: number;
                 max: number;
              }
            | {
                 pathMatcher(
                    path: string,
                 ): path is "/email-otp/request-email-change";
                 window: number;
                 max: number;
              }
            | {
                 pathMatcher(path: string): path is "/email-otp/change-email";
                 window: number;
                 max: number;
              }
         )[];
         options: import("better-auth/plugins").EmailOTPOptions;
         $ERROR_CODES: {
            OTP_EXPIRED: import("better-auth").RawError<"OTP_EXPIRED">;
            INVALID_OTP: import("better-auth").RawError<"INVALID_OTP">;
            TOO_MANY_ATTEMPTS: import("better-auth").RawError<"TOO_MANY_ATTEMPTS">;
         };
      },
      {
         id: "last-login-method";
         init(ctx: import("better-auth").AuthContext): {
            options: {
               databaseHooks: {
                  user: {
                     create: {
                        before(
                           user: {
                              id: string;
                              createdAt: Date;
                              updatedAt: Date;
                              email: string;
                              emailVerified: boolean;
                              name: string;
                              image?: string | null | undefined;
                           } & Record<string, unknown>,
                           context:
                              | import("better-auth").GenericEndpointContext
                              | null,
                        ): Promise<
                           | {
                                data: {
                                   lastLoginMethod: any;
                                   id: string;
                                   createdAt: Date;
                                   updatedAt: Date;
                                   email: string;
                                   emailVerified: boolean;
                                   name: string;
                                   image?: string | null | undefined;
                                };
                             }
                           | undefined
                        >;
                     };
                  };
                  session: {
                     create: {
                        after(
                           session: {
                              id: string;
                              createdAt: Date;
                              updatedAt: Date;
                              userId: string;
                              expiresAt: Date;
                              token: string;
                              ipAddress?: string | null | undefined;
                              userAgent?: string | null | undefined;
                           } & Record<string, unknown>,
                           context:
                              | import("better-auth").GenericEndpointContext
                              | null,
                        ): Promise<void>;
                     };
                  };
               };
            };
         };
         hooks: {
            after: {
               matcher(): true;
               handler: (
                  inputContext: import("better-call").MiddlewareInputContext<
                     import("better-call").MiddlewareOptions
                  >,
               ) => Promise<void>;
            }[];
         };
         schema: undefined;
         options: NoInfer<import("better-auth/plugins").LastLoginMethodOptions>;
      },
      {
         id: "organization";
         endpoints: import("better-auth/plugins").OrganizationEndpoints<{
            organizationLimit: number;
            schema: {
               organization: {
                  additionalFields: {
                     context: {
                        defaultValue: string;
                        input: true;
                        required: false;
                        type: "string";
                     };
                     description: {
                        defaultValue: string;
                        input: true;
                        required: false;
                        type: "string";
                     };
                     onboardingCompleted: {
                        defaultValue: false;
                        input: true;
                        required: false;
                        type: "boolean";
                     };
                  };
               };
               team: {
                  additionalFields: {
                     slug: {
                        input: true;
                        required: true;
                        type: "string";
                     };
                     description: {
                        defaultValue: string;
                        input: true;
                        required: false;
                        type: "string";
                     };
                     allowedDomains: {
                        type: "string[]";
                        input: true;
                        required: false;
                        validator: {
                           input: z.ZodArray<z.ZodString>;
                        };
                     };
                     onboardingCompleted: {
                        defaultValue: false;
                        input: true;
                        required: false;
                        type: "boolean";
                     };
                     onboardingProducts: {
                        defaultValue: null;
                        input: true;
                        required: false;
                        type: "json";
                        validator: {
                           input: z.ZodNullable<
                              z.ZodArray<
                                 z.ZodEnum<{
                                    analytics: "analytics";
                                    content: "content";
                                    forms: "forms";
                                 }>
                              >
                           >;
                        };
                     };
                     onboardingTasks: {
                        defaultValue: null;
                        input: true;
                        required: false;
                        type: "json";
                        validator: {
                           input: z.ZodNullable<
                              z.ZodRecord<z.ZodString, z.ZodBoolean>
                           >;
                        };
                     };
                     accountType: {
                        defaultValue: string;
                        input: true;
                        required: false;
                        type: "string";
                        validator: {
                           input: z.ZodOptional<
                              z.ZodNullable<
                                 z.ZodEnum<{
                                    business: "business";
                                    personal: "personal";
                                 }>
                              >
                           >;
                        };
                     };
                  };
               };
            };
            sendInvitationEmail(data: {
               id: string;
               role: string;
               email: string;
               organization: {
                  id: string;
                  name: string;
                  slug: string;
                  logo?: string | null | undefined;
                  metadata?: any;
                  createdAt: Date;
               };
               invitation: {
                  id: string;
                  organizationId: string;
                  email: string;
                  role: string;
                  status: "accepted" | "canceled" | "pending" | "rejected";
                  teamId?: string | null | undefined;
                  inviterId: string;
                  expiresAt: Date;
                  createdAt: Date;
               };
               inviter: {
                  id: string;
                  organizationId: string;
                  userId: string;
                  role: string;
                  createdAt: Date;
               } & {
                  user: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  };
               };
            }): Promise<void>;
            teams: {
               allowRemovingAllTeams: false;
               defaultTeam: {
                  enabled: false;
               };
               enabled: true;
               maximumMembersPerTeam: number;
               maximumTeams: number;
            };
         }> &
            import("better-auth/plugins").TeamEndpoints<{
               organizationLimit: number;
               schema: {
                  organization: {
                     additionalFields: {
                        context: {
                           defaultValue: string;
                           input: true;
                           required: false;
                           type: "string";
                        };
                        description: {
                           defaultValue: string;
                           input: true;
                           required: false;
                           type: "string";
                        };
                        onboardingCompleted: {
                           defaultValue: false;
                           input: true;
                           required: false;
                           type: "boolean";
                        };
                     };
                  };
                  team: {
                     additionalFields: {
                        slug: {
                           input: true;
                           required: true;
                           type: "string";
                        };
                        description: {
                           defaultValue: string;
                           input: true;
                           required: false;
                           type: "string";
                        };
                        allowedDomains: {
                           type: "string[]";
                           input: true;
                           required: false;
                           validator: {
                              input: z.ZodArray<z.ZodString>;
                           };
                        };
                        onboardingCompleted: {
                           defaultValue: false;
                           input: true;
                           required: false;
                           type: "boolean";
                        };
                        onboardingProducts: {
                           defaultValue: null;
                           input: true;
                           required: false;
                           type: "json";
                           validator: {
                              input: z.ZodNullable<
                                 z.ZodArray<
                                    z.ZodEnum<{
                                       analytics: "analytics";
                                       content: "content";
                                       forms: "forms";
                                    }>
                                 >
                              >;
                           };
                        };
                        onboardingTasks: {
                           defaultValue: null;
                           input: true;
                           required: false;
                           type: "json";
                           validator: {
                              input: z.ZodNullable<
                                 z.ZodRecord<z.ZodString, z.ZodBoolean>
                              >;
                           };
                        };
                        accountType: {
                           defaultValue: string;
                           input: true;
                           required: false;
                           type: "string";
                           validator: {
                              input: z.ZodOptional<
                                 z.ZodNullable<
                                    z.ZodEnum<{
                                       business: "business";
                                       personal: "personal";
                                    }>
                                 >
                              >;
                           };
                        };
                     };
                  };
               };
               sendInvitationEmail(data: {
                  id: string;
                  role: string;
                  email: string;
                  organization: {
                     id: string;
                     name: string;
                     slug: string;
                     logo?: string | null | undefined;
                     metadata?: any;
                     createdAt: Date;
                  };
                  invitation: {
                     id: string;
                     organizationId: string;
                     email: string;
                     role: string;
                     status: "accepted" | "canceled" | "pending" | "rejected";
                     teamId?: string | null | undefined;
                     inviterId: string;
                     expiresAt: Date;
                     createdAt: Date;
                  };
                  inviter: {
                     id: string;
                     organizationId: string;
                     userId: string;
                     role: string;
                     createdAt: Date;
                  } & {
                     user: {
                        id: string;
                        createdAt: Date;
                        updatedAt: Date;
                        email: string;
                        emailVerified: boolean;
                        name: string;
                        image?: string | null | undefined;
                     };
                  };
               }): Promise<void>;
               teams: {
                  allowRemovingAllTeams: false;
                  defaultTeam: {
                     enabled: false;
                  };
                  enabled: true;
                  maximumMembersPerTeam: number;
                  maximumTeams: number;
               };
            }>;
         schema: import("better-auth/plugins").OrganizationSchema<{
            organizationLimit: number;
            schema: {
               organization: {
                  additionalFields: {
                     context: {
                        defaultValue: string;
                        input: true;
                        required: false;
                        type: "string";
                     };
                     description: {
                        defaultValue: string;
                        input: true;
                        required: false;
                        type: "string";
                     };
                     onboardingCompleted: {
                        defaultValue: false;
                        input: true;
                        required: false;
                        type: "boolean";
                     };
                  };
               };
               team: {
                  additionalFields: {
                     slug: {
                        input: true;
                        required: true;
                        type: "string";
                     };
                     description: {
                        defaultValue: string;
                        input: true;
                        required: false;
                        type: "string";
                     };
                     allowedDomains: {
                        type: "string[]";
                        input: true;
                        required: false;
                        validator: {
                           input: z.ZodArray<z.ZodString>;
                        };
                     };
                     onboardingCompleted: {
                        defaultValue: false;
                        input: true;
                        required: false;
                        type: "boolean";
                     };
                     onboardingProducts: {
                        defaultValue: null;
                        input: true;
                        required: false;
                        type: "json";
                        validator: {
                           input: z.ZodNullable<
                              z.ZodArray<
                                 z.ZodEnum<{
                                    analytics: "analytics";
                                    content: "content";
                                    forms: "forms";
                                 }>
                              >
                           >;
                        };
                     };
                     onboardingTasks: {
                        defaultValue: null;
                        input: true;
                        required: false;
                        type: "json";
                        validator: {
                           input: z.ZodNullable<
                              z.ZodRecord<z.ZodString, z.ZodBoolean>
                           >;
                        };
                     };
                     accountType: {
                        defaultValue: string;
                        input: true;
                        required: false;
                        type: "string";
                        validator: {
                           input: z.ZodOptional<
                              z.ZodNullable<
                                 z.ZodEnum<{
                                    business: "business";
                                    personal: "personal";
                                 }>
                              >
                           >;
                        };
                     };
                  };
               };
            };
            sendInvitationEmail(data: {
               id: string;
               role: string;
               email: string;
               organization: {
                  id: string;
                  name: string;
                  slug: string;
                  logo?: string | null | undefined;
                  metadata?: any;
                  createdAt: Date;
               };
               invitation: {
                  id: string;
                  organizationId: string;
                  email: string;
                  role: string;
                  status: "accepted" | "canceled" | "pending" | "rejected";
                  teamId?: string | null | undefined;
                  inviterId: string;
                  expiresAt: Date;
                  createdAt: Date;
               };
               inviter: {
                  id: string;
                  organizationId: string;
                  userId: string;
                  role: string;
                  createdAt: Date;
               } & {
                  user: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  };
               };
            }): Promise<void>;
            teams: {
               allowRemovingAllTeams: false;
               defaultTeam: {
                  enabled: false;
               };
               enabled: true;
               maximumMembersPerTeam: number;
               maximumTeams: number;
            };
         }>;
         $Infer: {
            Organization: {
               id: string;
               name: string;
               slug: string;
               logo?: string | null | undefined;
               metadata?: any;
               createdAt: Date;
               context?: string | undefined;
               description?: string | undefined;
               onboardingCompleted?: boolean | undefined;
            };
            Invitation: {
               id: string;
               organizationId: string;
               email: string;
               role: "admin" | "member" | "owner";
               status: import("better-auth/plugins").InvitationStatus;
               inviterId: string;
               expiresAt: Date;
               createdAt: Date;
               teamId?: string | undefined;
            };
            Member: {
               id: string;
               organizationId: string;
               role: "admin" | "member" | "owner";
               createdAt: Date;
               userId: string;
               teamId?: string | undefined;
               user: {
                  id: string;
                  email: string;
                  name: string;
                  image?: string | undefined;
               };
            };
            Team: {
               id: string;
               name: string;
               organizationId: string;
               createdAt: Date;
               updatedAt?: Date | undefined;
            };
            TeamMember: {
               id: string;
               teamId: string;
               userId: string;
               createdAt: Date;
            };
            ActiveOrganization: {
               members: {
                  id: string;
                  organizationId: string;
                  role: "admin" | "member" | "owner";
                  createdAt: Date;
                  userId: string;
                  teamId?: string | undefined;
                  user: {
                     id: string;
                     email: string;
                     name: string;
                     image?: string | undefined;
                  };
               }[];
               invitations: {
                  id: string;
                  organizationId: string;
                  email: string;
                  role: "admin" | "member" | "owner";
                  status: import("better-auth/plugins").InvitationStatus;
                  inviterId: string;
                  expiresAt: Date;
                  createdAt: Date;
                  teamId?: string | undefined;
               }[];
               teams: {
                  id: string;
                  name: string;
                  organizationId: string;
                  createdAt: Date;
                  updatedAt?: Date | undefined;
                  slug: string;
                  description?: string | undefined;
                  allowedDomains?: string[] | undefined;
                  onboardingCompleted?: boolean | undefined;
                  onboardingProducts?: Record<string, any> | undefined;
                  onboardingTasks?: Record<string, any> | undefined;
                  accountType?: string | undefined;
               }[];
            } & {
               id: string;
               name: string;
               slug: string;
               logo?: string | null | undefined;
               metadata?: any;
               createdAt: Date;
               context?: string | undefined;
               description?: string | undefined;
               onboardingCompleted?: boolean | undefined;
            };
         };
         $ERROR_CODES: {
            YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION">;
            YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS: import("better-auth").RawError<"YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS">;
            ORGANIZATION_ALREADY_EXISTS: import("better-auth").RawError<"ORGANIZATION_ALREADY_EXISTS">;
            ORGANIZATION_SLUG_ALREADY_TAKEN: import("better-auth").RawError<"ORGANIZATION_SLUG_ALREADY_TAKEN">;
            ORGANIZATION_NOT_FOUND: import("better-auth").RawError<"ORGANIZATION_NOT_FOUND">;
            USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: import("better-auth").RawError<"USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION">;
            YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION">;
            YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION">;
            NO_ACTIVE_ORGANIZATION: import("better-auth").RawError<"NO_ACTIVE_ORGANIZATION">;
            USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: import("better-auth").RawError<"USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION">;
            MEMBER_NOT_FOUND: import("better-auth").RawError<"MEMBER_NOT_FOUND">;
            ROLE_NOT_FOUND: import("better-auth").RawError<"ROLE_NOT_FOUND">;
            YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM">;
            TEAM_ALREADY_EXISTS: import("better-auth").RawError<"TEAM_ALREADY_EXISTS">;
            TEAM_NOT_FOUND: import("better-auth").RawError<"TEAM_NOT_FOUND">;
            YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: import("better-auth").RawError<"YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER">;
            YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: import("better-auth").RawError<"YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER">;
            YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER">;
            YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION">;
            USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: import("better-auth").RawError<"USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION">;
            INVITATION_NOT_FOUND: import("better-auth").RawError<"INVITATION_NOT_FOUND">;
            YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: import("better-auth").RawError<"YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION">;
            EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION: import("better-auth").RawError<"EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION">;
            YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION">;
            INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION: import("better-auth").RawError<"INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION">;
            YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE">;
            FAILED_TO_RETRIEVE_INVITATION: import("better-auth").RawError<"FAILED_TO_RETRIEVE_INVITATION">;
            YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS: import("better-auth").RawError<"YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS">;
            UNABLE_TO_REMOVE_LAST_TEAM: import("better-auth").RawError<"UNABLE_TO_REMOVE_LAST_TEAM">;
            YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER">;
            ORGANIZATION_MEMBERSHIP_LIMIT_REACHED: import("better-auth").RawError<"ORGANIZATION_MEMBERSHIP_LIMIT_REACHED">;
            YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION">;
            YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION">;
            YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM">;
            YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM">;
            INVITATION_LIMIT_REACHED: import("better-auth").RawError<"INVITATION_LIMIT_REACHED">;
            TEAM_MEMBER_LIMIT_REACHED: import("better-auth").RawError<"TEAM_MEMBER_LIMIT_REACHED">;
            USER_IS_NOT_A_MEMBER_OF_THE_TEAM: import("better-auth").RawError<"USER_IS_NOT_A_MEMBER_OF_THE_TEAM">;
            YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM: import("better-auth").RawError<"YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM">;
            YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM: import("better-auth").RawError<"YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM">;
            YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER">;
            YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER">;
            YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION">;
            YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION">;
            MISSING_AC_INSTANCE: import("better-auth").RawError<"MISSING_AC_INSTANCE">;
            YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE: import("better-auth").RawError<"YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE">;
            YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE">;
            YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE">;
            YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE">;
            YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE">;
            YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE">;
            YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE">;
            TOO_MANY_ROLES: import("better-auth").RawError<"TOO_MANY_ROLES">;
            INVALID_RESOURCE: import("better-auth").RawError<"INVALID_RESOURCE">;
            ROLE_NAME_IS_ALREADY_TAKEN: import("better-auth").RawError<"ROLE_NAME_IS_ALREADY_TAKEN">;
            CANNOT_DELETE_A_PRE_DEFINED_ROLE: import("better-auth").RawError<"CANNOT_DELETE_A_PRE_DEFINED_ROLE">;
            ROLE_IS_ASSIGNED_TO_MEMBERS: import("better-auth").RawError<"ROLE_IS_ASSIGNED_TO_MEMBERS">;
         };
         options: NoInfer<{
            organizationLimit: number;
            schema: {
               organization: {
                  additionalFields: {
                     context: {
                        defaultValue: string;
                        input: true;
                        required: false;
                        type: "string";
                     };
                     description: {
                        defaultValue: string;
                        input: true;
                        required: false;
                        type: "string";
                     };
                     onboardingCompleted: {
                        defaultValue: false;
                        input: true;
                        required: false;
                        type: "boolean";
                     };
                  };
               };
               team: {
                  additionalFields: {
                     slug: {
                        input: true;
                        required: true;
                        type: "string";
                     };
                     description: {
                        defaultValue: string;
                        input: true;
                        required: false;
                        type: "string";
                     };
                     allowedDomains: {
                        type: "string[]";
                        input: true;
                        required: false;
                        validator: {
                           input: z.ZodArray<z.ZodString>;
                        };
                     };
                     onboardingCompleted: {
                        defaultValue: false;
                        input: true;
                        required: false;
                        type: "boolean";
                     };
                     onboardingProducts: {
                        defaultValue: null;
                        input: true;
                        required: false;
                        type: "json";
                        validator: {
                           input: z.ZodNullable<
                              z.ZodArray<
                                 z.ZodEnum<{
                                    analytics: "analytics";
                                    content: "content";
                                    forms: "forms";
                                 }>
                              >
                           >;
                        };
                     };
                     onboardingTasks: {
                        defaultValue: null;
                        input: true;
                        required: false;
                        type: "json";
                        validator: {
                           input: z.ZodNullable<
                              z.ZodRecord<z.ZodString, z.ZodBoolean>
                           >;
                        };
                     };
                     accountType: {
                        defaultValue: string;
                        input: true;
                        required: false;
                        type: "string";
                        validator: {
                           input: z.ZodOptional<
                              z.ZodNullable<
                                 z.ZodEnum<{
                                    business: "business";
                                    personal: "personal";
                                 }>
                              >
                           >;
                        };
                     };
                  };
               };
            };
            sendInvitationEmail(data: {
               id: string;
               role: string;
               email: string;
               organization: {
                  id: string;
                  name: string;
                  slug: string;
                  logo?: string | null | undefined;
                  metadata?: any;
                  createdAt: Date;
               };
               invitation: {
                  id: string;
                  organizationId: string;
                  email: string;
                  role: string;
                  status: "accepted" | "canceled" | "pending" | "rejected";
                  teamId?: string | null | undefined;
                  inviterId: string;
                  expiresAt: Date;
                  createdAt: Date;
               };
               inviter: {
                  id: string;
                  organizationId: string;
                  userId: string;
                  role: string;
                  createdAt: Date;
               } & {
                  user: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  };
               };
            }): Promise<void>;
            teams: {
               allowRemovingAllTeams: false;
               defaultTeam: {
                  enabled: false;
               };
               enabled: true;
               maximumMembersPerTeam: number;
               maximumTeams: number;
            };
         }>;
      },
      {
         id: "two-factor";
         endpoints: {
            enableTwoFactor: import("better-call").StrictEndpoint<
               "/two-factor/enable",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        password: z.ZodString;
                        issuer: z.ZodOptional<z.ZodString>;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        session: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           email: string;
                           emailVerified: boolean;
                           name: string;
                           image?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          totpURI: {
                                             type: string;
                                             description: string;
                                          };
                                          backupCodes: {
                                             type: string;
                                             items: {
                                                type: string;
                                             };
                                             description: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  totpURI: string;
                  backupCodes: string[];
               }
            >;
            disableTwoFactor: import("better-call").StrictEndpoint<
               "/two-factor/disable",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        password: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        session: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           email: string;
                           emailVerified: boolean;
                           name: string;
                           image?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          status: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  status: boolean;
               }
            >;
            verifyBackupCode: import("better-call").StrictEndpoint<
               "/two-factor/verify-backup-code",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        code: z.ZodString;
                        disableSession: z.ZodOptional<z.ZodBoolean>;
                        trustDevice: z.ZodOptional<z.ZodBoolean>;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        description: string;
                        responses: {
                           "200": {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          user: {
                                             type: string;
                                             properties: {
                                                id: {
                                                   type: string;
                                                   description: string;
                                                };
                                                email: {
                                                   type: string;
                                                   format: string;
                                                   nullable: boolean;
                                                   description: string;
                                                };
                                                emailVerified: {
                                                   type: string;
                                                   nullable: boolean;
                                                   description: string;
                                                };
                                                name: {
                                                   type: string;
                                                   nullable: boolean;
                                                   description: string;
                                                };
                                                image: {
                                                   type: string;
                                                   format: string;
                                                   nullable: boolean;
                                                   description: string;
                                                };
                                                twoFactorEnabled: {
                                                   type: string;
                                                   description: string;
                                                };
                                                createdAt: {
                                                   type: string;
                                                   format: string;
                                                   description: string;
                                                };
                                                updatedAt: {
                                                   type: string;
                                                   format: string;
                                                   description: string;
                                                };
                                             };
                                             required: string[];
                                             description: string;
                                          };
                                          session: {
                                             type: string;
                                             properties: {
                                                token: {
                                                   type: string;
                                                   description: string;
                                                };
                                                userId: {
                                                   type: string;
                                                   description: string;
                                                };
                                                createdAt: {
                                                   type: string;
                                                   format: string;
                                                   description: string;
                                                };
                                                expiresAt: {
                                                   type: string;
                                                   format: string;
                                                   description: string;
                                                };
                                             };
                                             required: string[];
                                             description: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  token: string | undefined;
                  user:
                     | import("better-auth/plugins").UserWithTwoFactor
                     | (Record<string, any> & {
                          id: string;
                          createdAt: Date;
                          updatedAt: Date;
                          email: string;
                          emailVerified: boolean;
                          name: string;
                          image?: string | null | undefined;
                       });
               }
            >;
            generateBackupCodes: import("better-call").StrictEndpoint<
               "/two-factor/generate-backup-codes",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        password: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        session: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           email: string;
                           emailVerified: boolean;
                           name: string;
                           image?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        description: string;
                        responses: {
                           "200": {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          status: {
                                             type: string;
                                             description: string;
                                             enum: boolean[];
                                          };
                                          backupCodes: {
                                             type: string;
                                             items: {
                                                type: string;
                                             };
                                             description: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  status: boolean;
                  backupCodes: string[];
               }
            >;
            viewBackupCodes: import("better-call").StrictEndpoint<
               string,
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        userId: z.ZodCoercedString<unknown>;
                     },
                     z.core.$strip
                  >;
               },
               {
                  status: boolean;
                  backupCodes: string[];
               }
            >;
            sendTwoFactorOTP: import("better-call").StrictEndpoint<
               "/two-factor/send-otp",
               {
                  method: "POST";
                  body: z.ZodOptional<
                     z.ZodObject<
                        {
                           trustDevice: z.ZodOptional<z.ZodBoolean>;
                        },
                        z.core.$strip
                     >
                  >;
                  metadata: {
                     openapi: {
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          status: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  status: boolean;
               }
            >;
            verifyTwoFactorOTP: import("better-call").StrictEndpoint<
               "/two-factor/verify-otp",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        code: z.ZodString;
                        trustDevice: z.ZodOptional<z.ZodBoolean>;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        summary: string;
                        description: string;
                        responses: {
                           "200": {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          token: {
                                             type: string;
                                             description: string;
                                          };
                                          user: {
                                             type: string;
                                             properties: {
                                                id: {
                                                   type: string;
                                                   description: string;
                                                };
                                                email: {
                                                   type: string;
                                                   format: string;
                                                   nullable: boolean;
                                                   description: string;
                                                };
                                                emailVerified: {
                                                   type: string;
                                                   nullable: boolean;
                                                   description: string;
                                                };
                                                name: {
                                                   type: string;
                                                   nullable: boolean;
                                                   description: string;
                                                };
                                                image: {
                                                   type: string;
                                                   format: string;
                                                   nullable: boolean;
                                                   description: string;
                                                };
                                                createdAt: {
                                                   type: string;
                                                   format: string;
                                                   description: string;
                                                };
                                                updatedAt: {
                                                   type: string;
                                                   format: string;
                                                   description: string;
                                                };
                                             };
                                             required: string[];
                                             description: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               | {
                    token: string;
                    user: import("better-auth/plugins").UserWithTwoFactor;
                 }
               | {
                    token: string;
                    user: Record<string, any> & {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    };
                 }
            >;
            generateTOTP: import("better-call").StrictEndpoint<
               string,
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        secret: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          code: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  code: string;
               }
            >;
            getTOTPURI: import("better-call").StrictEndpoint<
               "/two-factor/get-totp-uri",
               {
                  method: "POST";
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        session: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           email: string;
                           emailVerified: boolean;
                           name: string;
                           image?: string | null | undefined;
                        };
                     };
                  }>)[];
                  body: z.ZodObject<
                     {
                        password: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          totpURI: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  totpURI: string;
               }
            >;
            verifyTOTP: import("better-call").StrictEndpoint<
               "/two-factor/verify-totp",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        code: z.ZodString;
                        trustDevice: z.ZodOptional<z.ZodBoolean>;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        summary: string;
                        description: string;
                        responses: {
                           200: {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          status: {
                                             type: string;
                                          };
                                       };
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               | {
                    token: string;
                    user: import("better-auth/plugins").UserWithTwoFactor;
                 }
               | {
                    token: string;
                    user: Record<string, any> & {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    };
                 }
            >;
         };
         options: NoInfer<{
            issuer: string;
            skipVerificationOnEnable: false;
            totpOptions: {
               digits: 6;
               period: number;
            };
            backupCodeOptions: {
               amount: number;
               length: number;
            };
         }>;
         hooks: {
            after: {
               matcher(
                  context: import("better-auth").HookEndpointContext,
               ): boolean;
               handler: (
                  inputContext: import("better-call").MiddlewareInputContext<
                     import("better-call").MiddlewareOptions
                  >,
               ) => Promise<
                  | {
                       twoFactorRedirect: boolean;
                    }
                  | undefined
               >;
            }[];
         };
         schema: {
            user: {
               fields: {
                  twoFactorEnabled: {
                     type: "boolean";
                     required: false;
                     defaultValue: false;
                     input: false;
                  };
               };
            };
            twoFactor: {
               fields: {
                  secret: {
                     type: "string";
                     required: true;
                     returned: false;
                     index: true;
                  };
                  backupCodes: {
                     type: "string";
                     required: true;
                     returned: false;
                  };
                  userId: {
                     type: "string";
                     required: true;
                     returned: false;
                     references: {
                        model: string;
                        field: string;
                     };
                     index: true;
                  };
               };
            };
         };
         rateLimit: {
            pathMatcher(path: string): boolean;
            window: number;
            max: number;
         }[];
         $ERROR_CODES: {
            OTP_NOT_ENABLED: import("better-auth").RawError<"OTP_NOT_ENABLED">;
            OTP_HAS_EXPIRED: import("better-auth").RawError<"OTP_HAS_EXPIRED">;
            TOTP_NOT_ENABLED: import("better-auth").RawError<"TOTP_NOT_ENABLED">;
            TWO_FACTOR_NOT_ENABLED: import("better-auth").RawError<"TWO_FACTOR_NOT_ENABLED">;
            BACKUP_CODES_NOT_ENABLED: import("better-auth").RawError<"BACKUP_CODES_NOT_ENABLED">;
            INVALID_BACKUP_CODE: import("better-auth").RawError<"INVALID_BACKUP_CODE">;
            INVALID_CODE: import("better-auth").RawError<"INVALID_CODE">;
            TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: import("better-auth").RawError<"TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE">;
            INVALID_TWO_FACTOR_COOKIE: import("better-auth").RawError<"INVALID_TWO_FACTOR_COOKIE">;
         };
      },
      {
         id: "api-key";
         $ERROR_CODES: {
            INVALID_METADATA_TYPE: import("better-auth").RawError<"INVALID_METADATA_TYPE">;
            REFILL_AMOUNT_AND_INTERVAL_REQUIRED: import("better-auth").RawError<"REFILL_AMOUNT_AND_INTERVAL_REQUIRED">;
            REFILL_INTERVAL_AND_AMOUNT_REQUIRED: import("better-auth").RawError<"REFILL_INTERVAL_AND_AMOUNT_REQUIRED">;
            USER_BANNED: import("better-auth").RawError<"USER_BANNED">;
            UNAUTHORIZED_SESSION: import("better-auth").RawError<"UNAUTHORIZED_SESSION">;
            KEY_NOT_FOUND: import("better-auth").RawError<"KEY_NOT_FOUND">;
            KEY_DISABLED: import("better-auth").RawError<"KEY_DISABLED">;
            KEY_EXPIRED: import("better-auth").RawError<"KEY_EXPIRED">;
            USAGE_EXCEEDED: import("better-auth").RawError<"USAGE_EXCEEDED">;
            KEY_NOT_RECOVERABLE: import("better-auth").RawError<"KEY_NOT_RECOVERABLE">;
            EXPIRES_IN_IS_TOO_SMALL: import("better-auth").RawError<"EXPIRES_IN_IS_TOO_SMALL">;
            EXPIRES_IN_IS_TOO_LARGE: import("better-auth").RawError<"EXPIRES_IN_IS_TOO_LARGE">;
            INVALID_REMAINING: import("better-auth").RawError<"INVALID_REMAINING">;
            INVALID_PREFIX_LENGTH: import("better-auth").RawError<"INVALID_PREFIX_LENGTH">;
            INVALID_NAME_LENGTH: import("better-auth").RawError<"INVALID_NAME_LENGTH">;
            METADATA_DISABLED: import("better-auth").RawError<"METADATA_DISABLED">;
            RATE_LIMIT_EXCEEDED: import("better-auth").RawError<"RATE_LIMIT_EXCEEDED">;
            NO_VALUES_TO_UPDATE: import("better-auth").RawError<"NO_VALUES_TO_UPDATE">;
            KEY_DISABLED_EXPIRATION: import("better-auth").RawError<"KEY_DISABLED_EXPIRATION">;
            INVALID_API_KEY: import("better-auth").RawError<"INVALID_API_KEY">;
            INVALID_USER_ID_FROM_API_KEY: import("better-auth").RawError<"INVALID_USER_ID_FROM_API_KEY">;
            INVALID_REFERENCE_ID_FROM_API_KEY: import("better-auth").RawError<"INVALID_REFERENCE_ID_FROM_API_KEY">;
            INVALID_API_KEY_GETTER_RETURN_TYPE: import("better-auth").RawError<"INVALID_API_KEY_GETTER_RETURN_TYPE">;
            SERVER_ONLY_PROPERTY: import("better-auth").RawError<"SERVER_ONLY_PROPERTY">;
            FAILED_TO_UPDATE_API_KEY: import("better-auth").RawError<"FAILED_TO_UPDATE_API_KEY">;
            NAME_REQUIRED: import("better-auth").RawError<"NAME_REQUIRED">;
            ORGANIZATION_ID_REQUIRED: import("better-auth").RawError<"ORGANIZATION_ID_REQUIRED">;
            USER_NOT_MEMBER_OF_ORGANIZATION: import("better-auth").RawError<"USER_NOT_MEMBER_OF_ORGANIZATION">;
            INSUFFICIENT_API_KEY_PERMISSIONS: import("better-auth").RawError<"INSUFFICIENT_API_KEY_PERMISSIONS">;
            NO_DEFAULT_API_KEY_CONFIGURATION_FOUND: import("better-auth").RawError<"NO_DEFAULT_API_KEY_CONFIGURATION_FOUND">;
            ORGANIZATION_PLUGIN_REQUIRED: import("better-auth").RawError<"ORGANIZATION_PLUGIN_REQUIRED">;
         };
         hooks: {
            before: {
               matcher: (
                  ctx: import("better-auth").HookEndpointContext,
               ) => boolean;
               handler: (
                  inputContext: import("better-call").MiddlewareInputContext<
                     import("better-call").MiddlewareOptions
                  >,
               ) => Promise<
                  | {
                       user: {
                          id: string;
                          createdAt: Date;
                          updatedAt: Date;
                          email: string;
                          emailVerified: boolean;
                          name: string;
                          image?: string | null | undefined;
                       };
                       session: {
                          id: string;
                          token: string;
                          userId: string;
                          userAgent: string | null;
                          ipAddress: string | null;
                          createdAt: Date;
                          updatedAt: Date;
                          expiresAt: Date;
                       };
                    }
                  | {
                       context: import("better-call").MiddlewareContext<
                          import("better-call").MiddlewareOptions,
                          {
                             returned?: unknown;
                             responseHeaders?: Headers | undefined;
                          } & import("better-auth").PluginContext<
                             import("better-auth").BetterAuthOptions
                          > &
                             import("better-auth").InfoContext & {
                                options: import("better-auth").BetterAuthOptions;
                                trustedOrigins: string[];
                                trustedProviders: string[];
                                isTrustedOrigin: (
                                   url: string,
                                   settings?:
                                      | {
                                           allowRelativePaths: boolean;
                                        }
                                      | undefined,
                                ) => boolean;
                                oauthConfig: {
                                   skipStateCookieCheck?: boolean | undefined;
                                   storeStateStrategy: "cookie" | "database";
                                };
                                newSession: {
                                   session: {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      userId: string;
                                      expiresAt: Date;
                                      token: string;
                                      ipAddress?: string | null | undefined;
                                      userAgent?: string | null | undefined;
                                   } & Record<string, any>;
                                   user: {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      email: string;
                                      emailVerified: boolean;
                                      name: string;
                                      image?: string | null | undefined;
                                   } & Record<string, any>;
                                } | null;
                                session: {
                                   session: {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      userId: string;
                                      expiresAt: Date;
                                      token: string;
                                      ipAddress?: string | null | undefined;
                                      userAgent?: string | null | undefined;
                                   } & Record<string, any>;
                                   user: {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      email: string;
                                      emailVerified: boolean;
                                      name: string;
                                      image?: string | null | undefined;
                                   } & Record<string, any>;
                                } | null;
                                setNewSession: (
                                   session: {
                                      session: {
                                         id: string;
                                         createdAt: Date;
                                         updatedAt: Date;
                                         userId: string;
                                         expiresAt: Date;
                                         token: string;
                                         ipAddress?: string | null | undefined;
                                         userAgent?: string | null | undefined;
                                      } & Record<string, any>;
                                      user: {
                                         id: string;
                                         createdAt: Date;
                                         updatedAt: Date;
                                         email: string;
                                         emailVerified: boolean;
                                         name: string;
                                         image?: string | null | undefined;
                                      } & Record<string, any>;
                                   } | null,
                                ) => void;
                                socialProviders: import("better-auth").OAuthProvider<
                                   Record<string, any>,
                                   Partial<
                                      import("better-auth").ProviderOptions<any>
                                   >
                                >[];
                                authCookies: import("better-auth").BetterAuthCookies;
                                logger: import("better-auth").InternalLogger;
                                rateLimit: {
                                   enabled: boolean;
                                   window: number;
                                   max: number;
                                   storage:
                                      | "database"
                                      | "memory"
                                      | "secondary-storage";
                                } & Omit<
                                   import("better-auth").BetterAuthRateLimitOptions,
                                   "enabled" | "max" | "storage" | "window"
                                >;
                                adapter: import("better-auth").DBAdapter<
                                   import("better-auth").BetterAuthOptions
                                >;
                                internalAdapter: import("better-auth").InternalAdapter<
                                   import("better-auth").BetterAuthOptions
                                >;
                                createAuthCookie: (
                                   cookieName: string,
                                   overrideAttributes?:
                                      | Partial<
                                           import("better-call").CookieOptions
                                        >
                                      | undefined,
                                ) => import("better-auth").BetterAuthCookie;
                                secret: string;
                                secretConfig:
                                   | string
                                   | import("better-auth").SecretConfig;
                                sessionConfig: {
                                   updateAge: number;
                                   expiresIn: number;
                                   freshAge: number;
                                   cookieRefreshCache:
                                      | false
                                      | {
                                           enabled: true;
                                           updateAge: number;
                                        };
                                };
                                generateId: (options: {
                                   model: import("better-auth").ModelNames;
                                   size?: number | undefined;
                                }) => string | false;
                                secondaryStorage:
                                   | import("better-auth").SecondaryStorage
                                   | undefined;
                                password: {
                                   hash: (password: string) => Promise<string>;
                                   verify: (data: {
                                      password: string;
                                      hash: string;
                                   }) => Promise<boolean>;
                                   config: {
                                      minPasswordLength: number;
                                      maxPasswordLength: number;
                                   };
                                   checkPassword: (
                                      userId: string,
                                      ctx: import("better-auth").GenericEndpointContext<
                                         import("better-auth").BetterAuthOptions
                                      >,
                                   ) => Promise<boolean>;
                                };
                                tables: import("better-auth").BetterAuthDBSchema;
                                runMigrations: () => Promise<void>;
                                publishTelemetry: (event: {
                                   type: string;
                                   anonymousId?: string | undefined;
                                   payload: Record<string, any>;
                                }) => Promise<void>;
                                skipOriginCheck: boolean | string[];
                                skipCSRFCheck: boolean;
                                runInBackground: (
                                   promise: Promise<unknown>,
                                ) => void;
                                runInBackgroundOrAwait: (
                                   promise: void | Promise<unknown>,
                                ) => unknown;
                             }
                       >;
                    }
               >;
            }[];
         };
         endpoints: {
            createApiKey: import("better-call").StrictEndpoint<
               "/api-key/create",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        configId: z.ZodOptional<z.ZodString>;
                        name: z.ZodOptional<z.ZodString>;
                        expiresIn: z.ZodDefault<
                           z.ZodNullable<z.ZodOptional<z.ZodNumber>>
                        >;
                        prefix: z.ZodOptional<z.ZodString>;
                        remaining: z.ZodDefault<
                           z.ZodNullable<z.ZodOptional<z.ZodNumber>>
                        >;
                        metadata: z.ZodOptional<z.ZodAny>;
                        refillAmount: z.ZodOptional<z.ZodNumber>;
                        refillInterval: z.ZodOptional<z.ZodNumber>;
                        rateLimitTimeWindow: z.ZodOptional<z.ZodNumber>;
                        rateLimitMax: z.ZodOptional<z.ZodNumber>;
                        rateLimitEnabled: z.ZodOptional<z.ZodBoolean>;
                        permissions: z.ZodOptional<
                           z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>
                        >;
                        userId: z.ZodOptional<z.ZodCoercedString<unknown>>;
                        organizationId: z.ZodOptional<
                           z.ZodCoercedString<unknown>
                        >;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        description: string;
                        responses: {
                           "200": {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          id: {
                                             type: string;
                                             description: string;
                                          };
                                          createdAt: {
                                             type: string;
                                             format: string;
                                             description: string;
                                          };
                                          updatedAt: {
                                             type: string;
                                             format: string;
                                             description: string;
                                          };
                                          name: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          prefix: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          start: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          key: {
                                             type: string;
                                             description: string;
                                          };
                                          enabled: {
                                             type: string;
                                             description: string;
                                          };
                                          expiresAt: {
                                             type: string;
                                             format: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          referenceId: {
                                             type: string;
                                             description: string;
                                          };
                                          lastRefillAt: {
                                             type: string;
                                             format: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          lastRequest: {
                                             type: string;
                                             format: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          metadata: {
                                             type: string;
                                             nullable: boolean;
                                             additionalProperties: boolean;
                                             description: string;
                                          };
                                          rateLimitMax: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          rateLimitTimeWindow: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          remaining: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          refillAmount: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          refillInterval: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          rateLimitEnabled: {
                                             type: string;
                                             description: string;
                                          };
                                          requestCount: {
                                             type: string;
                                             description: string;
                                          };
                                          permissions: {
                                             type: string;
                                             nullable: boolean;
                                             additionalProperties: {
                                                type: string;
                                                items: {
                                                   type: string;
                                                };
                                             };
                                             description: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  key: string;
                  metadata: any;
                  permissions: any;
                  id: string;
                  configId: string;
                  name: string | null;
                  start: string | null;
                  prefix: string | null;
                  referenceId: string;
                  refillInterval: number | null;
                  refillAmount: number | null;
                  lastRefillAt: Date | null;
                  enabled: boolean;
                  rateLimitEnabled: boolean;
                  rateLimitTimeWindow: number | null;
                  rateLimitMax: number | null;
                  requestCount: number;
                  remaining: number | null;
                  lastRequest: Date | null;
                  expiresAt: Date | null;
                  createdAt: Date;
                  updatedAt: Date;
               }
            >;
            verifyApiKey: import("better-call").StrictEndpoint<
               string,
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        configId: z.ZodOptional<z.ZodString>;
                        key: z.ZodString;
                        permissions: z.ZodOptional<
                           z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>
                        >;
                     },
                     z.core.$strip
                  >;
               },
               | {
                    valid: boolean;
                    error: {
                       message: import("better-auth").RawError<"INVALID_API_KEY">;
                       code: "KEY_NOT_FOUND";
                    };
                    key: null;
                 }
               | {
                    valid: boolean;
                    error: {
                       message: string | undefined;
                       code: string;
                       cause?: unknown;
                    };
                    key: null;
                 }
               | {
                    valid: boolean;
                    error: {
                       message: import("better-auth").RawError<"INVALID_API_KEY">;
                       code: "INVALID_API_KEY";
                    };
                    key: null;
                 }
               | {
                    valid: boolean;
                    error: null;
                    key: Omit<
                       import("@better-auth/api-key").ApiKey,
                       "key"
                    > | null;
                 }
            >;
            getApiKey: import("better-call").StrictEndpoint<
               "/api-key/get",
               {
                  method: "GET";
                  query: z.ZodObject<
                     {
                        configId: z.ZodOptional<z.ZodString>;
                        id: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        session: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           email: string;
                           emailVerified: boolean;
                           name: string;
                           image?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        description: string;
                        responses: {
                           "200": {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          id: {
                                             type: string;
                                             description: string;
                                          };
                                          name: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          start: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          prefix: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          userId: {
                                             type: string;
                                             description: string;
                                          };
                                          refillInterval: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          refillAmount: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          lastRefillAt: {
                                             type: string;
                                             format: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          enabled: {
                                             type: string;
                                             description: string;
                                             default: boolean;
                                          };
                                          rateLimitEnabled: {
                                             type: string;
                                             description: string;
                                          };
                                          rateLimitTimeWindow: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          rateLimitMax: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          requestCount: {
                                             type: string;
                                             description: string;
                                          };
                                          remaining: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          lastRequest: {
                                             type: string;
                                             format: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          expiresAt: {
                                             type: string;
                                             format: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          createdAt: {
                                             type: string;
                                             format: string;
                                             description: string;
                                          };
                                          updatedAt: {
                                             type: string;
                                             format: string;
                                             description: string;
                                          };
                                          metadata: {
                                             type: string;
                                             nullable: boolean;
                                             additionalProperties: boolean;
                                             description: string;
                                          };
                                          permissions: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  metadata: Record<string, any> | null;
                  permissions: {
                     [key: string]: string[];
                  } | null;
                  id: string;
                  configId: string;
                  name: string | null;
                  start: string | null;
                  prefix: string | null;
                  referenceId: string;
                  refillInterval: number | null;
                  refillAmount: number | null;
                  lastRefillAt: Date | null;
                  enabled: boolean;
                  rateLimitEnabled: boolean;
                  rateLimitTimeWindow: number | null;
                  rateLimitMax: number | null;
                  requestCount: number;
                  remaining: number | null;
                  lastRequest: Date | null;
                  expiresAt: Date | null;
                  createdAt: Date;
                  updatedAt: Date;
               }
            >;
            updateApiKey: import("better-call").StrictEndpoint<
               "/api-key/update",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        configId: z.ZodOptional<z.ZodString>;
                        keyId: z.ZodString;
                        userId: z.ZodOptional<z.ZodCoercedString<unknown>>;
                        name: z.ZodOptional<z.ZodString>;
                        enabled: z.ZodOptional<z.ZodBoolean>;
                        remaining: z.ZodOptional<z.ZodNumber>;
                        refillAmount: z.ZodOptional<z.ZodNumber>;
                        refillInterval: z.ZodOptional<z.ZodNumber>;
                        metadata: z.ZodOptional<z.ZodAny>;
                        expiresIn: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
                        rateLimitEnabled: z.ZodOptional<z.ZodBoolean>;
                        rateLimitTimeWindow: z.ZodOptional<z.ZodNumber>;
                        rateLimitMax: z.ZodOptional<z.ZodNumber>;
                        permissions: z.ZodNullable<
                           z.ZodOptional<
                              z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>
                           >
                        >;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        description: string;
                        responses: {
                           "200": {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          id: {
                                             type: string;
                                             description: string;
                                          };
                                          name: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          start: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          prefix: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          userId: {
                                             type: string;
                                             description: string;
                                          };
                                          refillInterval: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          refillAmount: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          lastRefillAt: {
                                             type: string;
                                             format: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          enabled: {
                                             type: string;
                                             description: string;
                                             default: boolean;
                                          };
                                          rateLimitEnabled: {
                                             type: string;
                                             description: string;
                                          };
                                          rateLimitTimeWindow: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          rateLimitMax: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          requestCount: {
                                             type: string;
                                             description: string;
                                          };
                                          remaining: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          lastRequest: {
                                             type: string;
                                             format: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          expiresAt: {
                                             type: string;
                                             format: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          createdAt: {
                                             type: string;
                                             format: string;
                                             description: string;
                                          };
                                          updatedAt: {
                                             type: string;
                                             format: string;
                                             description: string;
                                          };
                                          metadata: {
                                             type: string;
                                             nullable: boolean;
                                             additionalProperties: boolean;
                                             description: string;
                                          };
                                          permissions: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  metadata: Record<string, any> | null;
                  permissions: {
                     [key: string]: string[];
                  } | null;
                  id: string;
                  configId: string;
                  name: string | null;
                  start: string | null;
                  prefix: string | null;
                  referenceId: string;
                  refillInterval: number | null;
                  refillAmount: number | null;
                  lastRefillAt: Date | null;
                  enabled: boolean;
                  rateLimitEnabled: boolean;
                  rateLimitTimeWindow: number | null;
                  rateLimitMax: number | null;
                  requestCount: number;
                  remaining: number | null;
                  lastRequest: Date | null;
                  expiresAt: Date | null;
                  createdAt: Date;
                  updatedAt: Date;
               }
            >;
            deleteApiKey: import("better-call").StrictEndpoint<
               "/api-key/delete",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        configId: z.ZodOptional<z.ZodString>;
                        keyId: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        session: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           email: string;
                           emailVerified: boolean;
                           name: string;
                           image?: string | null | undefined;
                        };
                     };
                  }>)[];
                  metadata: {
                     openapi: {
                        description: string;
                        requestBody: {
                           content: {
                              "application/json": {
                                 schema: {
                                    type: "object";
                                    properties: {
                                       keyId: {
                                          type: string;
                                          description: string;
                                       };
                                    };
                                    required: string[];
                                 };
                              };
                           };
                        };
                        responses: {
                           "200": {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          success: {
                                             type: string;
                                             description: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  success: boolean;
               }
            >;
            listApiKeys: import("better-call").StrictEndpoint<
               "/api-key/list",
               {
                  method: "GET";
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<{
                     session: {
                        session: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           userId: string;
                           expiresAt: Date;
                           token: string;
                           ipAddress?: string | null | undefined;
                           userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                           id: string;
                           createdAt: Date;
                           updatedAt: Date;
                           email: string;
                           emailVerified: boolean;
                           name: string;
                           image?: string | null | undefined;
                        };
                     };
                  }>)[];
                  query: z.ZodOptional<
                     z.ZodObject<
                        {
                           configId: z.ZodOptional<z.ZodString>;
                           organizationId: z.ZodOptional<z.ZodString>;
                           limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                           offset: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                           sortBy: z.ZodOptional<z.ZodString>;
                           sortDirection: z.ZodOptional<
                              z.ZodEnum<{
                                 asc: "asc";
                                 desc: "desc";
                              }>
                           >;
                        },
                        z.core.$strip
                     >
                  >;
                  metadata: {
                     openapi: {
                        description: string;
                        responses: {
                           "200": {
                              description: string;
                              content: {
                                 "application/json": {
                                    schema: {
                                       type: "object";
                                       properties: {
                                          apiKeys: {
                                             type: string;
                                             items: {
                                                type: string;
                                                properties: {
                                                   id: {
                                                      type: string;
                                                      description: string;
                                                   };
                                                   name: {
                                                      type: string;
                                                      nullable: boolean;
                                                      description: string;
                                                   };
                                                   start: {
                                                      type: string;
                                                      nullable: boolean;
                                                      description: string;
                                                   };
                                                   prefix: {
                                                      type: string;
                                                      nullable: boolean;
                                                      description: string;
                                                   };
                                                   userId: {
                                                      type: string;
                                                      description: string;
                                                   };
                                                   refillInterval: {
                                                      type: string;
                                                      nullable: boolean;
                                                      description: string;
                                                   };
                                                   refillAmount: {
                                                      type: string;
                                                      nullable: boolean;
                                                      description: string;
                                                   };
                                                   lastRefillAt: {
                                                      type: string;
                                                      format: string;
                                                      nullable: boolean;
                                                      description: string;
                                                   };
                                                   enabled: {
                                                      type: string;
                                                      description: string;
                                                      default: boolean;
                                                   };
                                                   rateLimitEnabled: {
                                                      type: string;
                                                      description: string;
                                                   };
                                                   rateLimitTimeWindow: {
                                                      type: string;
                                                      nullable: boolean;
                                                      description: string;
                                                   };
                                                   rateLimitMax: {
                                                      type: string;
                                                      nullable: boolean;
                                                      description: string;
                                                   };
                                                   requestCount: {
                                                      type: string;
                                                      description: string;
                                                   };
                                                   remaining: {
                                                      type: string;
                                                      nullable: boolean;
                                                      description: string;
                                                   };
                                                   lastRequest: {
                                                      type: string;
                                                      format: string;
                                                      nullable: boolean;
                                                      description: string;
                                                   };
                                                   expiresAt: {
                                                      type: string;
                                                      format: string;
                                                      nullable: boolean;
                                                      description: string;
                                                   };
                                                   createdAt: {
                                                      type: string;
                                                      format: string;
                                                      description: string;
                                                   };
                                                   updatedAt: {
                                                      type: string;
                                                      format: string;
                                                      description: string;
                                                   };
                                                   metadata: {
                                                      type: string;
                                                      nullable: boolean;
                                                      additionalProperties: boolean;
                                                      description: string;
                                                   };
                                                   permissions: {
                                                      type: string;
                                                      nullable: boolean;
                                                      description: string;
                                                   };
                                                };
                                                required: string[];
                                             };
                                          };
                                          total: {
                                             type: string;
                                             description: string;
                                          };
                                          limit: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                          offset: {
                                             type: string;
                                             nullable: boolean;
                                             description: string;
                                          };
                                       };
                                       required: string[];
                                    };
                                 };
                              };
                           };
                        };
                     };
                  };
               },
               {
                  apiKeys: {
                     metadata: Record<string, any> | null;
                     permissions: {
                        [key: string]: string[];
                     } | null;
                     id: string;
                     configId: string;
                     name: string | null;
                     start: string | null;
                     prefix: string | null;
                     referenceId: string;
                     refillInterval: number | null;
                     refillAmount: number | null;
                     lastRefillAt: Date | null;
                     enabled: boolean;
                     rateLimitEnabled: boolean;
                     rateLimitTimeWindow: number | null;
                     rateLimitMax: number | null;
                     requestCount: number;
                     remaining: number | null;
                     lastRequest: Date | null;
                     expiresAt: Date | null;
                     createdAt: Date;
                     updatedAt: Date;
                  }[];
                  total: number;
                  limit: number | undefined;
                  offset: number | undefined;
               }
            >;
            deleteAllExpiredApiKeys: import("better-call").StrictEndpoint<
               string,
               {
                  method: "POST";
               },
               {
                  success: boolean;
                  error: unknown;
               }
            >;
         };
         schema: {
            apikey: {
               fields: {
                  configId: {
                     type: "string";
                     required: true;
                     defaultValue: string;
                     input: false;
                     index: true;
                  };
                  name: {
                     type: "string";
                     required: false;
                     input: false;
                  };
                  start: {
                     type: "string";
                     required: false;
                     input: false;
                  };
                  referenceId: {
                     type: "string";
                     required: true;
                     input: false;
                     index: true;
                  };
                  prefix: {
                     type: "string";
                     required: false;
                     input: false;
                  };
                  key: {
                     type: "string";
                     required: true;
                     input: false;
                     index: true;
                  };
                  refillInterval: {
                     type: "number";
                     required: false;
                     input: false;
                  };
                  refillAmount: {
                     type: "number";
                     required: false;
                     input: false;
                  };
                  lastRefillAt: {
                     type: "date";
                     required: false;
                     input: false;
                  };
                  enabled: {
                     type: "boolean";
                     required: false;
                     input: false;
                     defaultValue: true;
                  };
                  rateLimitEnabled: {
                     type: "boolean";
                     required: false;
                     input: false;
                     defaultValue: true;
                  };
                  rateLimitTimeWindow: {
                     type: "number";
                     required: false;
                     input: false;
                     defaultValue: number;
                  };
                  rateLimitMax: {
                     type: "number";
                     required: false;
                     input: false;
                     defaultValue: number;
                  };
                  requestCount: {
                     type: "number";
                     required: false;
                     input: false;
                     defaultValue: number;
                  };
                  remaining: {
                     type: "number";
                     required: false;
                     input: false;
                  };
                  lastRequest: {
                     type: "date";
                     required: false;
                     input: false;
                  };
                  expiresAt: {
                     type: "date";
                     required: false;
                     input: false;
                  };
                  createdAt: {
                     type: "date";
                     required: true;
                     input: false;
                  };
                  updatedAt: {
                     type: "date";
                     required: true;
                     input: false;
                  };
                  permissions: {
                     type: "string";
                     required: false;
                     input: false;
                  };
                  metadata: {
                     type: "string";
                     required: false;
                     input: true;
                     transform: {
                        input(value: import("better-auth").DBPrimitive): string;
                        output(value: import("better-auth").DBPrimitive): any;
                     };
                  };
               };
            };
         };
         configurations: (import("@better-auth/api-key").ApiKeyConfigurationOptions &
            Required<
               Pick<
                  import("@better-auth/api-key").ApiKeyConfigurationOptions,
                  | "apiKeyHeaders"
                  | "defaultKeyLength"
                  | "deferUpdates"
                  | "disableKeyHashing"
                  | "enableMetadata"
                  | "enableSessionForAPIKeys"
                  | "fallbackToDatabase"
                  | "keyExpiration"
                  | "maximumNameLength"
                  | "maximumPrefixLength"
                  | "minimumNameLength"
                  | "minimumPrefixLength"
                  | "rateLimit"
                  | "requireName"
                  | "startingCharactersConfig"
                  | "storage"
               >
            > & {
               keyExpiration: Required<{
                  defaultExpiresIn?: number | null | undefined;
                  disableCustomExpiresTime?: boolean | undefined;
                  minExpiresIn?: number | undefined;
                  maxExpiresIn?: number | undefined;
               }>;
               startingCharactersConfig: Required<{
                  shouldStore?: boolean | undefined;
                  charactersLength?: number | undefined;
               }>;
               rateLimit: Required<{
                  enabled?: boolean | undefined;
                  timeWindow?: number | undefined;
                  maxRequests?: number | undefined;
               }>;
            })[];
      },
      {
         id: "stripe";
         endpoints: {
            stripeWebhook: import("better-call").StrictEndpoint<
               "/stripe/webhook",
               {
                  method: "POST";
                  metadata: {
                     openapi: {
                        operationId: string;
                     };
                     scope: "server";
                  };
                  cloneRequest: true;
                  disableBody: true;
               },
               {
                  success: boolean;
               }
            >;
         } & {
            upgradeSubscription: import("better-call").StrictEndpoint<
               "/subscription/upgrade",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        plan: z.ZodString;
                        annual: z.ZodOptional<z.ZodBoolean>;
                        referenceId: z.ZodOptional<z.ZodString>;
                        subscriptionId: z.ZodOptional<z.ZodString>;
                        customerType: z.ZodOptional<
                           z.ZodEnum<{
                              user: "user";
                              organization: "organization";
                           }>
                        >;
                        metadata: z.ZodOptional<
                           z.ZodRecord<z.ZodString, z.ZodAny>
                        >;
                        seats: z.ZodOptional<z.ZodNumber>;
                        locale: z.ZodOptional<
                           z.ZodCustom<
                              Stripe.Checkout.Session.Locale,
                              Stripe.Checkout.Session.Locale
                           >
                        >;
                        successUrl: z.ZodDefault<z.ZodString>;
                        cancelUrl: z.ZodDefault<z.ZodString>;
                        returnUrl: z.ZodOptional<z.ZodString>;
                        scheduleAtPeriodEnd: z.ZodDefault<z.ZodBoolean>;
                        disableRedirect: z.ZodDefault<z.ZodBoolean>;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                     };
                  };
                  use: (
                     | ((
                          inputContext: import("better-call").MiddlewareInputContext<{
                             use: ((
                                inputContext: import("better-call").MiddlewareInputContext<
                                   import("better-call").MiddlewareOptions
                                >,
                             ) => Promise<{
                                session: {
                                   session: Record<string, any> & {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      userId: string;
                                      expiresAt: Date;
                                      token: string;
                                      ipAddress?: string | null | undefined;
                                      userAgent?: string | null | undefined;
                                   };
                                   user: Record<string, any> & {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      email: string;
                                      emailVerified: boolean;
                                      name: string;
                                      image?: string | null | undefined;
                                   };
                                };
                             }>)[];
                          }>,
                       ) => Promise<{
                          session: import("@better-auth/stripe").StripeCtxSession;
                       }>)
                     | ((
                          inputContext: import("better-call").MiddlewareInputContext<
                             import("better-call").MiddlewareOptions
                          >,
                       ) => Promise<void>)
                  )[];
               },
               | {
                    url: string;
                    redirect: boolean;
                 }
               | {
                    redirect: boolean;
                    id: string;
                    object: "checkout.session";
                    adaptive_pricing: Stripe.Checkout.Session.AdaptivePricing | null;
                    after_expiration: Stripe.Checkout.Session.AfterExpiration | null;
                    allow_promotion_codes: boolean | null;
                    amount_subtotal: number | null;
                    amount_total: number | null;
                    automatic_tax: Stripe.Checkout.Session.AutomaticTax;
                    billing_address_collection: Stripe.Checkout.Session.BillingAddressCollection | null;
                    branding_settings?:
                       | Stripe.Checkout.Session.BrandingSettings
                       | undefined;
                    cancel_url: string | null;
                    client_reference_id: string | null;
                    client_secret: string | null;
                    collected_information: Stripe.Checkout.Session.CollectedInformation | null;
                    consent: Stripe.Checkout.Session.Consent | null;
                    consent_collection: Stripe.Checkout.Session.ConsentCollection | null;
                    created: number;
                    currency: string | null;
                    currency_conversion: Stripe.Checkout.Session.CurrencyConversion | null;
                    custom_fields: Stripe.Checkout.Session.CustomField[];
                    custom_text: Stripe.Checkout.Session.CustomText;
                    customer:
                       | string
                       | Stripe.Customer
                       | Stripe.DeletedCustomer
                       | null;
                    customer_account: string | null;
                    customer_creation: Stripe.Checkout.Session.CustomerCreation | null;
                    customer_details: Stripe.Checkout.Session.CustomerDetails | null;
                    customer_email: string | null;
                    discounts: Stripe.Checkout.Session.Discount[] | null;
                    excluded_payment_method_types?: string[] | undefined;
                    expires_at: number;
                    invoice: string | Stripe.Invoice | null;
                    invoice_creation: Stripe.Checkout.Session.InvoiceCreation | null;
                    line_items?: Stripe.ApiList<Stripe.LineItem> | undefined;
                    livemode: boolean;
                    locale: Stripe.Checkout.Session.Locale | null;
                    metadata: Stripe.Metadata | null;
                    mode: Stripe.Checkout.Session.Mode;
                    name_collection?:
                       | Stripe.Checkout.Session.NameCollection
                       | undefined;
                    optional_items?:
                       | Stripe.Checkout.Session.OptionalItem[]
                       | null
                       | undefined;
                    origin_context: Stripe.Checkout.Session.OriginContext | null;
                    payment_intent: string | Stripe.PaymentIntent | null;
                    payment_link: string | Stripe.PaymentLink | null;
                    payment_method_collection: Stripe.Checkout.Session.PaymentMethodCollection | null;
                    payment_method_configuration_details: Stripe.Checkout.Session.PaymentMethodConfigurationDetails | null;
                    payment_method_options: Stripe.Checkout.Session.PaymentMethodOptions | null;
                    payment_method_types: string[];
                    payment_status: Stripe.Checkout.Session.PaymentStatus;
                    permissions: Stripe.Checkout.Session.Permissions | null;
                    phone_number_collection?:
                       | Stripe.Checkout.Session.PhoneNumberCollection
                       | undefined;
                    presentment_details?:
                       | Stripe.Checkout.Session.PresentmentDetails
                       | undefined;
                    recovered_from: string | null;
                    redirect_on_completion?:
                       | Stripe.Checkout.Session.RedirectOnCompletion
                       | undefined;
                    return_url?: string | undefined;
                    saved_payment_method_options: Stripe.Checkout.Session.SavedPaymentMethodOptions | null;
                    setup_intent: string | Stripe.SetupIntent | null;
                    shipping_address_collection: Stripe.Checkout.Session.ShippingAddressCollection | null;
                    shipping_cost: Stripe.Checkout.Session.ShippingCost | null;
                    shipping_options: Stripe.Checkout.Session.ShippingOption[];
                    status: Stripe.Checkout.Session.Status | null;
                    submit_type: Stripe.Checkout.Session.SubmitType | null;
                    subscription: string | Stripe.Subscription | null;
                    success_url: string | null;
                    tax_id_collection?:
                       | Stripe.Checkout.Session.TaxIdCollection
                       | undefined;
                    total_details: Stripe.Checkout.Session.TotalDetails | null;
                    ui_mode: Stripe.Checkout.Session.UiMode | null;
                    url: string | null;
                    wallet_options: Stripe.Checkout.Session.WalletOptions | null;
                    lastResponse: {
                       headers: {
                          [key: string]: string;
                       };
                       requestId: string;
                       statusCode: number;
                       apiVersion?: string | undefined;
                       idempotencyKey?: string | undefined;
                       stripeAccount?: string | undefined;
                    };
                 }
            >;
            cancelSubscription: import("better-call").StrictEndpoint<
               "/subscription/cancel",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        referenceId: z.ZodOptional<z.ZodString>;
                        subscriptionId: z.ZodOptional<z.ZodString>;
                        customerType: z.ZodOptional<
                           z.ZodEnum<{
                              user: "user";
                              organization: "organization";
                           }>
                        >;
                        returnUrl: z.ZodString;
                        disableRedirect: z.ZodDefault<z.ZodBoolean>;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                     };
                  };
                  use: (
                     | ((
                          inputContext: import("better-call").MiddlewareInputContext<{
                             use: ((
                                inputContext: import("better-call").MiddlewareInputContext<
                                   import("better-call").MiddlewareOptions
                                >,
                             ) => Promise<{
                                session: {
                                   session: Record<string, any> & {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      userId: string;
                                      expiresAt: Date;
                                      token: string;
                                      ipAddress?: string | null | undefined;
                                      userAgent?: string | null | undefined;
                                   };
                                   user: Record<string, any> & {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      email: string;
                                      emailVerified: boolean;
                                      name: string;
                                      image?: string | null | undefined;
                                   };
                                };
                             }>)[];
                          }>,
                       ) => Promise<{
                          session: import("@better-auth/stripe").StripeCtxSession;
                       }>)
                     | ((
                          inputContext: import("better-call").MiddlewareInputContext<
                             import("better-call").MiddlewareOptions
                          >,
                       ) => Promise<void>)
                  )[];
               },
               {
                  url: string;
                  redirect: boolean;
               }
            >;
            restoreSubscription: import("better-call").StrictEndpoint<
               "/subscription/restore",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        referenceId: z.ZodOptional<z.ZodString>;
                        subscriptionId: z.ZodOptional<z.ZodString>;
                        customerType: z.ZodOptional<
                           z.ZodEnum<{
                              user: "user";
                              organization: "organization";
                           }>
                        >;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                     };
                  };
                  use: (
                     | ((
                          inputContext: import("better-call").MiddlewareInputContext<{
                             use: ((
                                inputContext: import("better-call").MiddlewareInputContext<
                                   import("better-call").MiddlewareOptions
                                >,
                             ) => Promise<{
                                session: {
                                   session: Record<string, any> & {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      userId: string;
                                      expiresAt: Date;
                                      token: string;
                                      ipAddress?: string | null | undefined;
                                      userAgent?: string | null | undefined;
                                   };
                                   user: Record<string, any> & {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      email: string;
                                      emailVerified: boolean;
                                      name: string;
                                      image?: string | null | undefined;
                                   };
                                };
                             }>)[];
                          }>,
                       ) => Promise<{
                          session: import("@better-auth/stripe").StripeCtxSession;
                       }>)
                     | ((
                          inputContext: import("better-call").MiddlewareInputContext<
                             import("better-call").MiddlewareOptions
                          >,
                       ) => Promise<void>)
                  )[];
               },
               Stripe.Response<Stripe.Subscription>
            >;
            listActiveSubscriptions: import("better-call").StrictEndpoint<
               "/subscription/list",
               {
                  method: "GET";
                  query: z.ZodOptional<
                     z.ZodObject<
                        {
                           referenceId: z.ZodOptional<z.ZodString>;
                           customerType: z.ZodOptional<
                              z.ZodEnum<{
                                 user: "user";
                                 organization: "organization";
                              }>
                           >;
                        },
                        z.core.$strip
                     >
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                     };
                  };
                  use: (
                     | ((
                          inputContext: import("better-call").MiddlewareInputContext<{
                             use: ((
                                inputContext: import("better-call").MiddlewareInputContext<
                                   import("better-call").MiddlewareOptions
                                >,
                             ) => Promise<{
                                session: {
                                   session: Record<string, any> & {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      userId: string;
                                      expiresAt: Date;
                                      token: string;
                                      ipAddress?: string | null | undefined;
                                      userAgent?: string | null | undefined;
                                   };
                                   user: Record<string, any> & {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      email: string;
                                      emailVerified: boolean;
                                      name: string;
                                      image?: string | null | undefined;
                                   };
                                };
                             }>)[];
                          }>,
                       ) => Promise<{
                          session: import("@better-auth/stripe").StripeCtxSession;
                       }>)
                     | ((
                          inputContext: import("better-call").MiddlewareInputContext<
                             import("better-call").MiddlewareOptions
                          >,
                       ) => Promise<void>)
                  )[];
               },
               {
                  limits: Record<string, unknown> | undefined;
                  priceId: string | undefined;
                  id: string;
                  plan: string;
                  stripeCustomerId?: string | undefined;
                  stripeSubscriptionId?: string | undefined;
                  trialStart?: Date | undefined;
                  trialEnd?: Date | undefined;
                  referenceId: string;
                  status:
                     | "active"
                     | "canceled"
                     | "incomplete"
                     | "incomplete_expired"
                     | "past_due"
                     | "paused"
                     | "trialing"
                     | "unpaid";
                  periodStart?: Date | undefined;
                  periodEnd?: Date | undefined;
                  cancelAtPeriodEnd?: boolean | undefined;
                  cancelAt?: Date | undefined;
                  canceledAt?: Date | undefined;
                  endedAt?: Date | undefined;
                  groupId?: string | undefined;
                  seats?: number | undefined;
                  billingInterval?:
                     | "day"
                     | "month"
                     | "week"
                     | "year"
                     | undefined;
                  stripeScheduleId?: string | undefined;
               }[]
            >;
            subscriptionSuccess: import("better-call").StrictEndpoint<
               "/subscription/success",
               {
                  method: "GET";
                  query: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
                  metadata: {
                     openapi: {
                        operationId: string;
                     };
                  };
                  use: ((
                     inputContext: import("better-call").MiddlewareInputContext<
                        import("better-call").MiddlewareOptions
                     >,
                  ) => Promise<void>)[];
               },
               never
            >;
            createBillingPortal: import("better-call").StrictEndpoint<
               "/subscription/billing-portal",
               {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        locale: z.ZodOptional<
                           z.ZodCustom<
                              Stripe.Checkout.Session.Locale,
                              Stripe.Checkout.Session.Locale
                           >
                        >;
                        referenceId: z.ZodOptional<z.ZodString>;
                        customerType: z.ZodOptional<
                           z.ZodEnum<{
                              user: "user";
                              organization: "organization";
                           }>
                        >;
                        returnUrl: z.ZodDefault<z.ZodString>;
                        disableRedirect: z.ZodDefault<z.ZodBoolean>;
                     },
                     z.core.$strip
                  >;
                  metadata: {
                     openapi: {
                        operationId: string;
                     };
                  };
                  use: (
                     | ((
                          inputContext: import("better-call").MiddlewareInputContext<{
                             use: ((
                                inputContext: import("better-call").MiddlewareInputContext<
                                   import("better-call").MiddlewareOptions
                                >,
                             ) => Promise<{
                                session: {
                                   session: Record<string, any> & {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      userId: string;
                                      expiresAt: Date;
                                      token: string;
                                      ipAddress?: string | null | undefined;
                                      userAgent?: string | null | undefined;
                                   };
                                   user: Record<string, any> & {
                                      id: string;
                                      createdAt: Date;
                                      updatedAt: Date;
                                      email: string;
                                      emailVerified: boolean;
                                      name: string;
                                      image?: string | null | undefined;
                                   };
                                };
                             }>)[];
                          }>,
                       ) => Promise<{
                          session: import("@better-auth/stripe").StripeCtxSession;
                       }>)
                     | ((
                          inputContext: import("better-call").MiddlewareInputContext<
                             import("better-call").MiddlewareOptions
                          >,
                       ) => Promise<void>)
                  )[];
               },
               {
                  url: string;
                  redirect: boolean;
               }
            >;
         };
         init(ctx: import("better-auth").AuthContext):
            | {
                 options: {
                    databaseHooks: {
                       user: {
                          create: {
                             after(
                                user: {
                                   id: string;
                                   createdAt: Date;
                                   updatedAt: Date;
                                   email: string;
                                   emailVerified: boolean;
                                   name: string;
                                   image?: string | null | undefined;
                                } & import("@better-auth/stripe").WithStripeCustomerId,
                                ctx:
                                   | import("better-auth").GenericEndpointContext
                                   | null,
                             ): Promise<void>;
                          };
                          update: {
                             after(
                                user: {
                                   id: string;
                                   createdAt: Date;
                                   updatedAt: Date;
                                   email: string;
                                   emailVerified: boolean;
                                   name: string;
                                   image?: string | null | undefined;
                                } & import("@better-auth/stripe").WithStripeCustomerId,
                                ctx:
                                   | import("better-auth").GenericEndpointContext
                                   | null,
                             ): Promise<void>;
                          };
                       };
                    };
                 };
              }
            | undefined;
         schema: {
            user: {
               fields: {
                  stripeCustomerId: {
                     type: "string";
                     required: false;
                  };
               };
            };
         } & {
            subscription: {
               fields: {
                  plan: {
                     type: "string";
                     required: true;
                  };
                  referenceId: {
                     type: "string";
                     required: true;
                  };
                  stripeCustomerId: {
                     type: "string";
                     required: false;
                  };
                  stripeSubscriptionId: {
                     type: "string";
                     required: false;
                  };
                  status: {
                     type: "string";
                     defaultValue: string;
                  };
                  periodStart: {
                     type: "date";
                     required: false;
                  };
                  periodEnd: {
                     type: "date";
                     required: false;
                  };
                  trialStart: {
                     type: "date";
                     required: false;
                  };
                  trialEnd: {
                     type: "date";
                     required: false;
                  };
                  cancelAtPeriodEnd: {
                     type: "boolean";
                     required: false;
                     defaultValue: false;
                  };
                  cancelAt: {
                     type: "date";
                     required: false;
                  };
                  canceledAt: {
                     type: "date";
                     required: false;
                  };
                  endedAt: {
                     type: "date";
                     required: false;
                  };
                  seats: {
                     type: "number";
                     required: false;
                  };
                  billingInterval: {
                     type: "string";
                     required: false;
                  };
                  stripeScheduleId: {
                     type: "string";
                     required: false;
                  };
               };
            };
         };
         options: NoInfer<{
            createCustomerOnSignUp: true;
            stripeClient: Stripe;
            stripeWebhookSecret: string;
            subscription: {
               authorizeReference: ({
                  user,
                  referenceId,
               }: {
                  user: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  } & Record<string, any>;
                  session: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     userId: string;
                     expiresAt: Date;
                     token: string;
                     ipAddress?: string | null | undefined;
                     userAgent?: string | null | undefined;
                  } & Record<string, any>;
                  referenceId: string;
                  action: import("@better-auth/stripe").AuthorizeReferenceAction;
               }) => Promise<boolean>;
               enabled: true;
               getCheckoutSessionParams: () => Promise<{
                  params: {
                     allow_promotion_codes: true;
                  };
               }>;
               plans: {
                  name: string;
                  priceId: string | undefined;
               }[];
            };
            onSubscriptionComplete: ({
               subscription,
               stripeSubscription,
            }: {
               subscription: {
                  id: string;
                  plan: string;
                  referenceId: string;
               };
               stripeSubscription: Stripe.Subscription;
            }) => Promise<void>;
            onSubscriptionCancel: ({
               subscription,
            }: {
               subscription: {
                  id: string;
                  plan: string;
                  referenceId: string;
               };
            }) => Promise<void>;
         }>;
         $ERROR_CODES: {
            UNAUTHORIZED: import("better-auth").RawError<"UNAUTHORIZED">;
            INVALID_REQUEST_BODY: import("better-auth").RawError<"INVALID_REQUEST_BODY">;
            SUBSCRIPTION_NOT_FOUND: import("better-auth").RawError<"SUBSCRIPTION_NOT_FOUND">;
            SUBSCRIPTION_PLAN_NOT_FOUND: import("better-auth").RawError<"SUBSCRIPTION_PLAN_NOT_FOUND">;
            ALREADY_SUBSCRIBED_PLAN: import("better-auth").RawError<"ALREADY_SUBSCRIBED_PLAN">;
            REFERENCE_ID_NOT_ALLOWED: import("better-auth").RawError<"REFERENCE_ID_NOT_ALLOWED">;
            CUSTOMER_NOT_FOUND: import("better-auth").RawError<"CUSTOMER_NOT_FOUND">;
            UNABLE_TO_CREATE_CUSTOMER: import("better-auth").RawError<"UNABLE_TO_CREATE_CUSTOMER">;
            UNABLE_TO_CREATE_BILLING_PORTAL: import("better-auth").RawError<"UNABLE_TO_CREATE_BILLING_PORTAL">;
            STRIPE_SIGNATURE_NOT_FOUND: import("better-auth").RawError<"STRIPE_SIGNATURE_NOT_FOUND">;
            STRIPE_WEBHOOK_SECRET_NOT_FOUND: import("better-auth").RawError<"STRIPE_WEBHOOK_SECRET_NOT_FOUND">;
            STRIPE_WEBHOOK_ERROR: import("better-auth").RawError<"STRIPE_WEBHOOK_ERROR">;
            FAILED_TO_CONSTRUCT_STRIPE_EVENT: import("better-auth").RawError<"FAILED_TO_CONSTRUCT_STRIPE_EVENT">;
            FAILED_TO_FETCH_PLANS: import("better-auth").RawError<"FAILED_TO_FETCH_PLANS">;
            EMAIL_VERIFICATION_REQUIRED: import("better-auth").RawError<"EMAIL_VERIFICATION_REQUIRED">;
            SUBSCRIPTION_NOT_ACTIVE: import("better-auth").RawError<"SUBSCRIPTION_NOT_ACTIVE">;
            SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION: import("better-auth").RawError<"SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION">;
            SUBSCRIPTION_NOT_PENDING_CHANGE: import("better-auth").RawError<"SUBSCRIPTION_NOT_PENDING_CHANGE">;
            ORGANIZATION_NOT_FOUND: import("better-auth").RawError<"ORGANIZATION_NOT_FOUND">;
            ORGANIZATION_SUBSCRIPTION_NOT_ENABLED: import("better-auth").RawError<"ORGANIZATION_SUBSCRIPTION_NOT_ENABLED">;
            AUTHORIZE_REFERENCE_REQUIRED: import("better-auth").RawError<"AUTHORIZE_REFERENCE_REQUIRED">;
            ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION: import("better-auth").RawError<"ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION">;
            ORGANIZATION_REFERENCE_ID_REQUIRED: import("better-auth").RawError<"ORGANIZATION_REFERENCE_ID_REQUIRED">;
         };
      },
      {
         id: "tanstack-start-cookies";
         hooks: {
            after: {
               matcher(ctx: import("better-auth").HookEndpointContext): true;
               handler: (
                  inputContext: import("better-call").MiddlewareInputContext<
                     import("better-call").MiddlewareOptions
                  >,
               ) => Promise<void>;
            }[];
         };
      },
   ];
}>;
export type AuthInstance = ReturnType<typeof createAuth>;
//# sourceMappingURL=server.d.ts.map
