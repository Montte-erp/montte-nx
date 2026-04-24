import type { HyprPayClient } from "@montte/hyprpay";
import { z } from "zod";
import type { DatabaseInstance } from "@core/database/client";
import type { PostHog } from "@core/posthog/server";
import type { Redis } from "@core/redis/connection";
import type { ResendClient } from "@core/transactional/utils";
export declare const cnpjDataSchema: z.ZodObject<
   {
      cnpj: z.ZodString;
      razao_social: z.ZodString;
      nome_fantasia: z.ZodNullable<z.ZodString>;
      cnae_fiscal: z.ZodNumber;
      cnae_fiscal_descricao: z.ZodNullable<z.ZodString>;
      cnaes_secundarios: z.ZodArray<
         z.ZodObject<
            {
               codigo: z.ZodNumber;
               descricao: z.ZodString;
            },
            z.core.$strip
         >
      >;
      porte: z.ZodNullable<z.ZodString>;
      natureza_juridica: z.ZodNullable<z.ZodString>;
      municipio: z.ZodNullable<z.ZodString>;
      uf: z.ZodNullable<z.ZodString>;
      data_inicio_atividade: z.ZodString;
      descricao_situacao_cadastral: z.ZodString;
      qsa: z.ZodArray<z.ZodUnknown>;
      regime_tributario: z.ZodNullable<z.ZodArray<z.ZodUnknown>>;
   },
   z.core.$strip
>;
export type CnpjData = z.infer<typeof cnpjDataSchema>;
export declare const ORGANIZATION_LIMIT = 3;
export declare function getDevMagicLink(email: string): string | undefined;
export interface CreateAuthDeps {
   db: DatabaseInstance;
   redis: Redis;
   posthog: PostHog;
   resendClient: ResendClient;
   hyprpayClient: HyprPayClient;
   env: {
      BETTER_AUTH_URL?: string;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_TRUSTED_ORIGINS: string;
      BETTER_AUTH_GOOGLE_CLIENT_ID: string;
      BETTER_AUTH_GOOGLE_CLIENT_SECRET: string;
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
      cookiePrefix: string;
   };
   secondaryStorage: {
      get: (key: string) => Promise<string | null>;
      set: (
         key: string,
         value: string,
         ttl: number | undefined,
      ) => Promise<void>;
      delete: (key: string) => Promise<void | string | null | undefined>;
   };
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
      deleteUser: {
         enabled: true;
      };
   };
   plugins: [
      {
         id: "magic-link";
         version: string;
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
                        metadata: z.ZodOptional<
                           z.ZodRecord<z.ZodString, z.ZodAny>
                        >;
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
         version: string;
         init(ctx: import("better-auth").AuthContext):
            | {
                 options: {
                    emailVerification: {
                       sendVerificationEmail(
                          data: {
                             user: import("better-auth").User;
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
         version: string;
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
         version: string;
         endpoints: import("better-auth/client").OrganizationEndpoints<{
            organizationLimit: number;
            schema: {
               organization: {
                  additionalFields: {
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
                     cnpj: {
                        defaultValue: null;
                        input: true;
                        required: false;
                        type: "string";
                        validator: {
                           input: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        };
                     };
                     cnpjData: {
                        defaultValue: null;
                        input: true;
                        required: false;
                        type: "json";
                        validator: {
                           input: z.ZodOptional<
                              z.ZodNullable<
                                 z.ZodObject<
                                    {
                                       cnpj: z.ZodString;
                                       razao_social: z.ZodString;
                                       nome_fantasia: z.ZodNullable<z.ZodString>;
                                       cnae_fiscal: z.ZodNumber;
                                       cnae_fiscal_descricao: z.ZodNullable<z.ZodString>;
                                       cnaes_secundarios: z.ZodArray<
                                          z.ZodObject<
                                             {
                                                codigo: z.ZodNumber;
                                                descricao: z.ZodString;
                                             },
                                             z.core.$strip
                                          >
                                       >;
                                       porte: z.ZodNullable<z.ZodString>;
                                       natureza_juridica: z.ZodNullable<z.ZodString>;
                                       municipio: z.ZodNullable<z.ZodString>;
                                       uf: z.ZodNullable<z.ZodString>;
                                       data_inicio_atividade: z.ZodString;
                                       descricao_situacao_cadastral: z.ZodString;
                                       qsa: z.ZodArray<z.ZodUnknown>;
                                       regime_tributario: z.ZodNullable<
                                          z.ZodArray<z.ZodUnknown>
                                       >;
                                    },
                                    z.core.$strip
                                 >
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
               organization: import("better-auth/client").Organization;
               invitation: import("better-auth/client").Invitation;
               inviter: import("better-auth/client").Member & {
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
            import("better-auth/client").TeamEndpoints<{
               organizationLimit: number;
               schema: {
                  organization: {
                     additionalFields: {
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
                        cnpj: {
                           defaultValue: null;
                           input: true;
                           required: false;
                           type: "string";
                           validator: {
                              input: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                           };
                        };
                        cnpjData: {
                           defaultValue: null;
                           input: true;
                           required: false;
                           type: "json";
                           validator: {
                              input: z.ZodOptional<
                                 z.ZodNullable<
                                    z.ZodObject<
                                       {
                                          cnpj: z.ZodString;
                                          razao_social: z.ZodString;
                                          nome_fantasia: z.ZodNullable<z.ZodString>;
                                          cnae_fiscal: z.ZodNumber;
                                          cnae_fiscal_descricao: z.ZodNullable<z.ZodString>;
                                          cnaes_secundarios: z.ZodArray<
                                             z.ZodObject<
                                                {
                                                   codigo: z.ZodNumber;
                                                   descricao: z.ZodString;
                                                },
                                                z.core.$strip
                                             >
                                          >;
                                          porte: z.ZodNullable<z.ZodString>;
                                          natureza_juridica: z.ZodNullable<z.ZodString>;
                                          municipio: z.ZodNullable<z.ZodString>;
                                          uf: z.ZodNullable<z.ZodString>;
                                          data_inicio_atividade: z.ZodString;
                                          descricao_situacao_cadastral: z.ZodString;
                                          qsa: z.ZodArray<z.ZodUnknown>;
                                          regime_tributario: z.ZodNullable<
                                             z.ZodArray<z.ZodUnknown>
                                          >;
                                       },
                                       z.core.$strip
                                    >
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
                  organization: import("better-auth/client").Organization;
                  invitation: import("better-auth/client").Invitation;
                  inviter: import("better-auth/client").Member & {
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
         schema: import("better-auth/client").OrganizationSchema<{
            organizationLimit: number;
            schema: {
               organization: {
                  additionalFields: {
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
                     cnpj: {
                        defaultValue: null;
                        input: true;
                        required: false;
                        type: "string";
                        validator: {
                           input: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        };
                     };
                     cnpjData: {
                        defaultValue: null;
                        input: true;
                        required: false;
                        type: "json";
                        validator: {
                           input: z.ZodOptional<
                              z.ZodNullable<
                                 z.ZodObject<
                                    {
                                       cnpj: z.ZodString;
                                       razao_social: z.ZodString;
                                       nome_fantasia: z.ZodNullable<z.ZodString>;
                                       cnae_fiscal: z.ZodNumber;
                                       cnae_fiscal_descricao: z.ZodNullable<z.ZodString>;
                                       cnaes_secundarios: z.ZodArray<
                                          z.ZodObject<
                                             {
                                                codigo: z.ZodNumber;
                                                descricao: z.ZodString;
                                             },
                                             z.core.$strip
                                          >
                                       >;
                                       porte: z.ZodNullable<z.ZodString>;
                                       natureza_juridica: z.ZodNullable<z.ZodString>;
                                       municipio: z.ZodNullable<z.ZodString>;
                                       uf: z.ZodNullable<z.ZodString>;
                                       data_inicio_atividade: z.ZodString;
                                       descricao_situacao_cadastral: z.ZodString;
                                       qsa: z.ZodArray<z.ZodUnknown>;
                                       regime_tributario: z.ZodNullable<
                                          z.ZodArray<z.ZodUnknown>
                                       >;
                                    },
                                    z.core.$strip
                                 >
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
               organization: import("better-auth/client").Organization;
               invitation: import("better-auth/client").Invitation;
               inviter: import("better-auth/client").Member & {
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
               description?: string | undefined;
               onboardingCompleted?: boolean | undefined;
            };
            Invitation: {
               id: string;
               organizationId: string;
               email: string;
               role: "admin" | "member" | "owner";
               status: import("better-auth/client").InvitationStatus;
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
                  status: import("better-auth/client").InvitationStatus;
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
                  onboardingCompleted?: boolean | undefined;
                  onboardingProducts?: Record<string, any> | undefined;
                  onboardingTasks?: Record<string, any> | undefined;
                  cnpj?: string | undefined;
                  cnpjData?: Record<string, any> | undefined;
               }[];
            } & {
               id: string;
               name: string;
               slug: string;
               logo?: string | null | undefined;
               metadata?: any;
               createdAt: Date;
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
                     cnpj: {
                        defaultValue: null;
                        input: true;
                        required: false;
                        type: "string";
                        validator: {
                           input: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        };
                     };
                     cnpjData: {
                        defaultValue: null;
                        input: true;
                        required: false;
                        type: "json";
                        validator: {
                           input: z.ZodOptional<
                              z.ZodNullable<
                                 z.ZodObject<
                                    {
                                       cnpj: z.ZodString;
                                       razao_social: z.ZodString;
                                       nome_fantasia: z.ZodNullable<z.ZodString>;
                                       cnae_fiscal: z.ZodNumber;
                                       cnae_fiscal_descricao: z.ZodNullable<z.ZodString>;
                                       cnaes_secundarios: z.ZodArray<
                                          z.ZodObject<
                                             {
                                                codigo: z.ZodNumber;
                                                descricao: z.ZodString;
                                             },
                                             z.core.$strip
                                          >
                                       >;
                                       porte: z.ZodNullable<z.ZodString>;
                                       natureza_juridica: z.ZodNullable<z.ZodString>;
                                       municipio: z.ZodNullable<z.ZodString>;
                                       uf: z.ZodNullable<z.ZodString>;
                                       data_inicio_atividade: z.ZodString;
                                       descricao_situacao_cadastral: z.ZodString;
                                       qsa: z.ZodArray<z.ZodUnknown>;
                                       regime_tributario: z.ZodNullable<
                                          z.ZodArray<z.ZodUnknown>
                                       >;
                                    },
                                    z.core.$strip
                                 >
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
               organization: import("better-auth/client").Organization;
               invitation: import("better-auth/client").Invitation;
               inviter: import("better-auth/client").Member & {
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
         version: string;
         endpoints: {
            enableTwoFactor: import("better-call").StrictEndpoint<
               "/two-factor/enable",
               {
                  method: "POST";
                  body:
                     | z.ZodObject<
                          {
                             password: z.ZodOptional<z.ZodString>;
                             issuer: z.ZodOptional<z.ZodString>;
                          },
                          z.core.$strip
                       >
                     | z.ZodObject<
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
                  body:
                     | z.ZodObject<
                          {
                             password: z.ZodOptional<z.ZodString>;
                          },
                          z.core.$strip
                       >
                     | z.ZodObject<
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
                     | (Record<string, any> & {
                          id: string;
                          createdAt: Date;
                          updatedAt: Date;
                          email: string;
                          emailVerified: boolean;
                          name: string;
                          image?: string | null | undefined;
                       })
                     | import("better-auth/plugins").UserWithTwoFactor;
               }
            >;
            generateBackupCodes: import("better-call").StrictEndpoint<
               "/two-factor/generate-backup-codes",
               {
                  method: "POST";
                  body:
                     | z.ZodObject<
                          {
                             password: z.ZodOptional<z.ZodString>;
                          },
                          z.core.$strip
                       >
                     | z.ZodObject<
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
                  body:
                     | z.ZodObject<
                          {
                             password: z.ZodOptional<z.ZodString>;
                          },
                          z.core.$strip
                       >
                     | z.ZodObject<
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
                       twoFactorMethods: string[];
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
                  verified: {
                     type: "boolean";
                     required: false;
                     defaultValue: true;
                     input: false;
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
         version: string;
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
                  inputContext: {
                     body?: undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     use?: any[];
                  },
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
                       context: {
                          method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
                          path: string;
                          body: any;
                          query: Record<string, any> | undefined;
                          params: Record<string, any> | undefined;
                          request: Request | undefined;
                          headers: Headers | undefined;
                          setHeader: (key: string, value: string) => void;
                          setStatus: (
                             status:
                                | 100
                                | 101
                                | 102
                                | 103
                                | 200
                                | 201
                                | 202
                                | 203
                                | 204
                                | 205
                                | 206
                                | 207
                                | 208
                                | 226
                                | 300
                                | 301
                                | 302
                                | 303
                                | 304
                                | 305
                                | 306
                                | 307
                                | 308
                                | 400
                                | 401
                                | 402
                                | 403
                                | 404
                                | 405
                                | 406
                                | 407
                                | 408
                                | 409
                                | 410
                                | 411
                                | 412
                                | 413
                                | 414
                                | 415
                                | 416
                                | 417
                                | 418
                                | 421
                                | 422
                                | 423
                                | 424
                                | 425
                                | 426
                                | 428
                                | 429
                                | 431
                                | 451
                                | 500
                                | 501
                                | 502
                                | 503
                                | 504
                                | 505
                                | 506
                                | 507
                                | 508
                                | 510
                                | 511,
                          ) => void;
                          getHeader: (key: string) => string | null;
                          getCookie: (
                             key: string,
                             prefix?: "host" | "secure",
                          ) => string | null;
                          getSignedCookie: (
                             key: string,
                             secret: string,
                             prefix?: "host" | "secure",
                          ) => Promise<string | false | null>;
                          setCookie: (
                             key: string,
                             value: string,
                             options?: {
                                domain?: string;
                                expires?: Date;
                                httpOnly?: boolean;
                                maxAge?: number;
                                path?: string;
                                secure?: boolean;
                                sameSite?:
                                   | "Strict"
                                   | "Lax"
                                   | "None"
                                   | "strict"
                                   | "lax"
                                   | "none";
                                partitioned?: boolean;
                                prefix?: "host" | "secure";
                             },
                          ) => string;
                          setSignedCookie: (
                             key: string,
                             value: string,
                             secret: string,
                             options?: {
                                domain?: string;
                                expires?: Date;
                                httpOnly?: boolean;
                                maxAge?: number;
                                path?: string;
                                secure?: boolean;
                                sameSite?:
                                   | "Strict"
                                   | "Lax"
                                   | "None"
                                   | "strict"
                                   | "lax"
                                   | "none";
                                partitioned?: boolean;
                                prefix?: "host" | "secure";
                             },
                          ) => Promise<string>;
                          json: <R extends Record<string, any> | null>(
                             json: R,
                             routerResponse?:
                                | {
                                     status?: number;
                                     headers?: Record<string, string>;
                                     response?: Response;
                                     body?: Record<string, string>;
                                  }
                                | Response,
                          ) => Promise<R>;
                          context: {
                             [x: string]: any;
                          };
                          redirect: (url: string) => {
                             status:
                                | (
                                     | "ACCEPTED"
                                     | "BAD_GATEWAY"
                                     | "BAD_REQUEST"
                                     | "CONFLICT"
                                     | "CREATED"
                                     | "EXPECTATION_FAILED"
                                     | "FAILED_DEPENDENCY"
                                     | "FORBIDDEN"
                                     | "FOUND"
                                     | "GATEWAY_TIMEOUT"
                                     | "GONE"
                                     | "HTTP_VERSION_NOT_SUPPORTED"
                                     | "I'M_A_TEAPOT"
                                     | "INSUFFICIENT_STORAGE"
                                     | "INTERNAL_SERVER_ERROR"
                                     | "LENGTH_REQUIRED"
                                     | "LOCKED"
                                     | "LOOP_DETECTED"
                                     | "METHOD_NOT_ALLOWED"
                                     | "MISDIRECTED_REQUEST"
                                     | "MOVED_PERMANENTLY"
                                     | "MULTIPLE_CHOICES"
                                     | "NETWORK_AUTHENTICATION_REQUIRED"
                                     | "NOT_ACCEPTABLE"
                                     | "NOT_EXTENDED"
                                     | "NOT_FOUND"
                                     | "NOT_IMPLEMENTED"
                                     | "NOT_MODIFIED"
                                     | "NO_CONTENT"
                                     | "OK"
                                     | "PAYLOAD_TOO_LARGE"
                                     | "PAYMENT_REQUIRED"
                                     | "PRECONDITION_FAILED"
                                     | "PRECONDITION_REQUIRED"
                                     | "PROXY_AUTHENTICATION_REQUIRED"
                                     | "RANGE_NOT_SATISFIABLE"
                                     | "REQUEST_HEADER_FIELDS_TOO_LARGE"
                                     | "REQUEST_TIMEOUT"
                                     | "SEE_OTHER"
                                     | "SERVICE_UNAVAILABLE"
                                     | "TEMPORARY_REDIRECT"
                                     | "TOO_EARLY"
                                     | "TOO_MANY_REQUESTS"
                                     | "UNAUTHORIZED"
                                     | "UNAVAILABLE_FOR_LEGAL_REASONS"
                                     | "UNPROCESSABLE_ENTITY"
                                     | "UNSUPPORTED_MEDIA_TYPE"
                                     | "UPGRADE_REQUIRED"
                                     | "URI_TOO_LONG"
                                     | "VARIANT_ALSO_NEGOTIATES"
                                  )
                                | (
                                     | 100
                                     | 101
                                     | 102
                                     | 103
                                     | 200
                                     | 201
                                     | 202
                                     | 203
                                     | 204
                                     | 205
                                     | 206
                                     | 207
                                     | 208
                                     | 226
                                     | 300
                                     | 301
                                     | 302
                                     | 303
                                     | 304
                                     | 305
                                     | 306
                                     | 307
                                     | 308
                                     | 400
                                     | 401
                                     | 402
                                     | 403
                                     | 404
                                     | 405
                                     | 406
                                     | 407
                                     | 408
                                     | 409
                                     | 410
                                     | 411
                                     | 412
                                     | 413
                                     | 414
                                     | 415
                                     | 416
                                     | 417
                                     | 418
                                     | 421
                                     | 422
                                     | 423
                                     | 424
                                     | 425
                                     | 426
                                     | 428
                                     | 429
                                     | 431
                                     | 451
                                     | 500
                                     | 501
                                     | 502
                                     | 503
                                     | 504
                                     | 505
                                     | 506
                                     | 507
                                     | 508
                                     | 510
                                     | 511
                                  );
                             body:
                                | ({
                                     message?: string;
                                     code?: string;
                                     cause?: unknown;
                                  } & Record<string, any>)
                                | undefined;
                             headers: HeadersInit;
                             statusCode: number;
                             name: string;
                             message: string;
                             stack?: string;
                             cause?: unknown;
                          };
                          error: (
                             status:
                                | (
                                     | "ACCEPTED"
                                     | "BAD_GATEWAY"
                                     | "BAD_REQUEST"
                                     | "CONFLICT"
                                     | "CREATED"
                                     | "EXPECTATION_FAILED"
                                     | "FAILED_DEPENDENCY"
                                     | "FORBIDDEN"
                                     | "FOUND"
                                     | "GATEWAY_TIMEOUT"
                                     | "GONE"
                                     | "HTTP_VERSION_NOT_SUPPORTED"
                                     | "I'M_A_TEAPOT"
                                     | "INSUFFICIENT_STORAGE"
                                     | "INTERNAL_SERVER_ERROR"
                                     | "LENGTH_REQUIRED"
                                     | "LOCKED"
                                     | "LOOP_DETECTED"
                                     | "METHOD_NOT_ALLOWED"
                                     | "MISDIRECTED_REQUEST"
                                     | "MOVED_PERMANENTLY"
                                     | "MULTIPLE_CHOICES"
                                     | "NETWORK_AUTHENTICATION_REQUIRED"
                                     | "NOT_ACCEPTABLE"
                                     | "NOT_EXTENDED"
                                     | "NOT_FOUND"
                                     | "NOT_IMPLEMENTED"
                                     | "NOT_MODIFIED"
                                     | "NO_CONTENT"
                                     | "OK"
                                     | "PAYLOAD_TOO_LARGE"
                                     | "PAYMENT_REQUIRED"
                                     | "PRECONDITION_FAILED"
                                     | "PRECONDITION_REQUIRED"
                                     | "PROXY_AUTHENTICATION_REQUIRED"
                                     | "RANGE_NOT_SATISFIABLE"
                                     | "REQUEST_HEADER_FIELDS_TOO_LARGE"
                                     | "REQUEST_TIMEOUT"
                                     | "SEE_OTHER"
                                     | "SERVICE_UNAVAILABLE"
                                     | "TEMPORARY_REDIRECT"
                                     | "TOO_EARLY"
                                     | "TOO_MANY_REQUESTS"
                                     | "UNAUTHORIZED"
                                     | "UNAVAILABLE_FOR_LEGAL_REASONS"
                                     | "UNPROCESSABLE_ENTITY"
                                     | "UNSUPPORTED_MEDIA_TYPE"
                                     | "UPGRADE_REQUIRED"
                                     | "URI_TOO_LONG"
                                     | "VARIANT_ALSO_NEGOTIATES"
                                  )
                                | (
                                     | 100
                                     | 101
                                     | 102
                                     | 103
                                     | 200
                                     | 201
                                     | 202
                                     | 203
                                     | 204
                                     | 205
                                     | 206
                                     | 207
                                     | 208
                                     | 226
                                     | 300
                                     | 301
                                     | 302
                                     | 303
                                     | 304
                                     | 305
                                     | 306
                                     | 307
                                     | 308
                                     | 400
                                     | 401
                                     | 402
                                     | 403
                                     | 404
                                     | 405
                                     | 406
                                     | 407
                                     | 408
                                     | 409
                                     | 410
                                     | 411
                                     | 412
                                     | 413
                                     | 414
                                     | 415
                                     | 416
                                     | 417
                                     | 418
                                     | 421
                                     | 422
                                     | 423
                                     | 424
                                     | 425
                                     | 426
                                     | 428
                                     | 429
                                     | 431
                                     | 451
                                     | 500
                                     | 501
                                     | 502
                                     | 503
                                     | 504
                                     | 505
                                     | 506
                                     | 507
                                     | 508
                                     | 510
                                     | 511
                                  ),
                             body?: {
                                message?: string;
                                code?: string;
                             } & Record<string, any>,
                             headers?: HeadersInit,
                          ) => {
                             status:
                                | (
                                     | "ACCEPTED"
                                     | "BAD_GATEWAY"
                                     | "BAD_REQUEST"
                                     | "CONFLICT"
                                     | "CREATED"
                                     | "EXPECTATION_FAILED"
                                     | "FAILED_DEPENDENCY"
                                     | "FORBIDDEN"
                                     | "FOUND"
                                     | "GATEWAY_TIMEOUT"
                                     | "GONE"
                                     | "HTTP_VERSION_NOT_SUPPORTED"
                                     | "I'M_A_TEAPOT"
                                     | "INSUFFICIENT_STORAGE"
                                     | "INTERNAL_SERVER_ERROR"
                                     | "LENGTH_REQUIRED"
                                     | "LOCKED"
                                     | "LOOP_DETECTED"
                                     | "METHOD_NOT_ALLOWED"
                                     | "MISDIRECTED_REQUEST"
                                     | "MOVED_PERMANENTLY"
                                     | "MULTIPLE_CHOICES"
                                     | "NETWORK_AUTHENTICATION_REQUIRED"
                                     | "NOT_ACCEPTABLE"
                                     | "NOT_EXTENDED"
                                     | "NOT_FOUND"
                                     | "NOT_IMPLEMENTED"
                                     | "NOT_MODIFIED"
                                     | "NO_CONTENT"
                                     | "OK"
                                     | "PAYLOAD_TOO_LARGE"
                                     | "PAYMENT_REQUIRED"
                                     | "PRECONDITION_FAILED"
                                     | "PRECONDITION_REQUIRED"
                                     | "PROXY_AUTHENTICATION_REQUIRED"
                                     | "RANGE_NOT_SATISFIABLE"
                                     | "REQUEST_HEADER_FIELDS_TOO_LARGE"
                                     | "REQUEST_TIMEOUT"
                                     | "SEE_OTHER"
                                     | "SERVICE_UNAVAILABLE"
                                     | "TEMPORARY_REDIRECT"
                                     | "TOO_EARLY"
                                     | "TOO_MANY_REQUESTS"
                                     | "UNAUTHORIZED"
                                     | "UNAVAILABLE_FOR_LEGAL_REASONS"
                                     | "UNPROCESSABLE_ENTITY"
                                     | "UNSUPPORTED_MEDIA_TYPE"
                                     | "UPGRADE_REQUIRED"
                                     | "URI_TOO_LONG"
                                     | "VARIANT_ALSO_NEGOTIATES"
                                  )
                                | (
                                     | 100
                                     | 101
                                     | 102
                                     | 103
                                     | 200
                                     | 201
                                     | 202
                                     | 203
                                     | 204
                                     | 205
                                     | 206
                                     | 207
                                     | 208
                                     | 226
                                     | 300
                                     | 301
                                     | 302
                                     | 303
                                     | 304
                                     | 305
                                     | 306
                                     | 307
                                     | 308
                                     | 400
                                     | 401
                                     | 402
                                     | 403
                                     | 404
                                     | 405
                                     | 406
                                     | 407
                                     | 408
                                     | 409
                                     | 410
                                     | 411
                                     | 412
                                     | 413
                                     | 414
                                     | 415
                                     | 416
                                     | 417
                                     | 418
                                     | 421
                                     | 422
                                     | 423
                                     | 424
                                     | 425
                                     | 426
                                     | 428
                                     | 429
                                     | 431
                                     | 451
                                     | 500
                                     | 501
                                     | 502
                                     | 503
                                     | 504
                                     | 505
                                     | 506
                                     | 507
                                     | 508
                                     | 510
                                     | 511
                                  );
                             body:
                                | ({
                                     message?: string;
                                     code?: string;
                                     cause?: unknown;
                                  } & Record<string, any>)
                                | undefined;
                             headers: HeadersInit;
                             statusCode: number;
                             name: string;
                             message: string;
                             stack?: string;
                             cause?: unknown;
                          };
                       } & {
                          method: string;
                          path: string;
                          body: any;
                          query: Record<string, any> | undefined;
                          params: string;
                          request: Request | undefined;
                          headers: Headers | undefined;
                          setHeader: (key: string, value: string) => void;
                          getHeader: (key: string) => string | null;
                          json: <R extends Record<string, any> | null>(
                             json: R,
                             routerResponse?:
                                | {
                                     status?: number;
                                     headers?: Record<string, string>;
                                     response?: Response;
                                  }
                                | Response,
                          ) => Promise<R>;
                          context: {
                             getPlugin: <
                                ID extends
                                   | import("better-auth").BetterAuthPluginRegistryIdentifier
                                   | import("better-auth").LiteralString,
                                PluginOptions extends never,
                             >(
                                pluginId: ID,
                             ) =>
                                | (ID extends keyof import("better-auth").BetterAuthPluginRegistry<
                                     unknown,
                                     unknown
                                  >
                                     ? import("better-auth").BetterAuthPluginRegistry<
                                          import("better-auth").BetterAuthOptions,
                                          PluginOptions
                                       >[ID] extends {
                                          creator: infer C;
                                       }
                                        ? C extends (...args: any[]) => infer R
                                           ? R
                                           : never
                                        : never
                                     : import("better-auth").BetterAuthPlugin)
                                | null;
                             hasPlugin: <
                                ID extends
                                   | import("better-auth").BetterAuthPluginRegistryIdentifier
                                   | import("better-auth").LiteralString,
                             >(
                                pluginId: ID,
                             ) => ID extends never ? true : boolean;
                             appName: string;
                             baseURL: string;
                             version: string;
                             returned?: unknown | undefined;
                             responseHeaders?: Headers | undefined;
                             options: import("better-auth").BetterAuthOptions;
                             trustedOrigins: string[];
                             trustedProviders: string[];
                             isTrustedOrigin: (
                                url: string,
                                settings?: {
                                   allowRelativePaths: boolean;
                                },
                             ) => boolean;
                             oauthConfig: {
                                skipStateCookieCheck?: boolean | undefined;
                                storeStateStrategy: "database" | "cookie";
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
                             socialProviders: import("better-auth").OAuthProvider[];
                             authCookies: import("better-auth").BetterAuthCookies;
                             logger: ReturnType<
                                (
                                   options?:
                                      | import("better-auth").Logger
                                      | undefined,
                                ) => import("better-auth").InternalLogger
                             >;
                             rateLimit: {
                                enabled: boolean;
                                window: number;
                                max: number;
                                storage:
                                   | "memory"
                                   | "database"
                                   | "secondary-storage";
                             } & Omit<
                                import("better-auth").BetterAuthRateLimitOptions,
                                "enabled" | "window" | "max" | "storage"
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
                                   | Partial<{
                                        domain?: string;
                                        expires?: Date;
                                        httpOnly?: boolean;
                                        maxAge?: number;
                                        path?: string;
                                        secure?: boolean;
                                        sameSite?:
                                           | "Strict"
                                           | "Lax"
                                           | "None"
                                           | "strict"
                                           | "lax"
                                           | "none";
                                        partitioned?: boolean;
                                        prefix?: "host" | "secure";
                                     }>
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
                                promise: Promise<unknown> | void,
                             ) => unknown;
                          };
                       };
                    }
               >;
            }[];
         };
         endpoints: {
            createApiKey: {
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     asResponse: true;
                  },
               ): Promise<Response>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: true;
                  },
               ): Promise<{
                  headers: Headers;
                  status: number;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: false;
                  },
               ): Promise<{
                  headers: Headers;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: false;
                  },
               ): Promise<{
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
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                  },
               ): Promise<{
                  headers: Headers;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response: {
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
                  };
               }>;
               (
                  context?:
                     | ({
                          body: {
                             configId?: string | undefined;
                             name?: string | undefined;
                             expiresIn?: number | null | undefined;
                             prefix?: string | undefined;
                             remaining?: number | null | undefined;
                             metadata?: any;
                             refillAmount?: number | undefined;
                             refillInterval?: number | undefined;
                             rateLimitTimeWindow?: number | undefined;
                             rateLimitMax?: number | undefined;
                             rateLimitEnabled?: boolean | undefined;
                             permissions?: Record<string, string[]> | undefined;
                             userId?: unknown;
                             organizationId?: unknown;
                          };
                       } & {
                          method?: "POST" | undefined;
                       } & {
                          query?: Record<string, any> | undefined;
                       } & {
                          params?: Record<string, any>;
                       } & {
                          request?: Request;
                       } & {
                          headers?: HeadersInit;
                       } & {
                          asResponse?: boolean;
                          returnHeaders?: boolean;
                          returnStatus?: boolean;
                          use?: any[];
                          path?: string;
                          context?: Record<string, any>;
                       })
                     | undefined,
               ): Promise<{
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
               }>;
               options: {
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
               };
               path: "/api-key/create";
            };
            verifyApiKey: {
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        key: string;
                        permissions?: Record<string, string[]> | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     asResponse: true;
                  },
               ): Promise<Response>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        key: string;
                        permissions?: Record<string, string[]> | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: true;
                  },
               ): Promise<{
                  headers: Headers;
                  status: number;
                  response:
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
                       };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        key: string;
                        permissions?: Record<string, string[]> | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: false;
                  },
               ): Promise<{
                  headers: Headers;
                  response:
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
                       };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        key: string;
                        permissions?: Record<string, string[]> | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response:
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
                       };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        key: string;
                        permissions?: Record<string, string[]> | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: false;
                  },
               ): Promise<
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
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        key: string;
                        permissions?: Record<string, string[]> | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                  },
               ): Promise<{
                  headers: Headers;
                  response:
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
                       };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        key: string;
                        permissions?: Record<string, string[]> | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response:
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
                       };
               }>;
               (
                  context?:
                     | ({
                          body: {
                             configId?: string | undefined;
                             key: string;
                             permissions?: Record<string, string[]> | undefined;
                          };
                       } & {
                          method?: "POST" | undefined;
                       } & {
                          query?: Record<string, any> | undefined;
                       } & {
                          params?: Record<string, any>;
                       } & {
                          request?: Request;
                       } & {
                          headers?: HeadersInit;
                       } & {
                          asResponse?: boolean;
                          returnHeaders?: boolean;
                          returnStatus?: boolean;
                          use?: any[];
                          path?: string;
                          context?: Record<string, any>;
                       })
                     | undefined,
               ): Promise<
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
               options: {
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
               };
               path: string;
            };
            getApiKey: {
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query: {
                        configId?: string | undefined;
                        id: string;
                     };
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     asResponse: true;
                  },
               ): Promise<Response>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query: {
                        configId?: string | undefined;
                        id: string;
                     };
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: true;
                  },
               ): Promise<{
                  headers: Headers;
                  status: number;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query: {
                        configId?: string | undefined;
                        id: string;
                     };
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: false;
                  },
               ): Promise<{
                  headers: Headers;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query: {
                        configId?: string | undefined;
                        id: string;
                     };
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query: {
                        configId?: string | undefined;
                        id: string;
                     };
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: false;
                  },
               ): Promise<{
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
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query: {
                        configId?: string | undefined;
                        id: string;
                     };
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                  },
               ): Promise<{
                  headers: Headers;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query: {
                        configId?: string | undefined;
                        id: string;
                     };
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response: {
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
                  };
               }>;
               (
                  context?:
                     | ({
                          body?: undefined;
                       } & {
                          method?: "GET" | undefined;
                       } & {
                          query: {
                             configId?: string | undefined;
                             id: string;
                          };
                       } & {
                          params?: Record<string, any>;
                       } & {
                          request?: Request;
                       } & {
                          headers?: HeadersInit;
                       } & {
                          asResponse?: boolean;
                          returnHeaders?: boolean;
                          returnStatus?: boolean;
                          use?: any[];
                          path?: string;
                          context?: Record<string, any>;
                       })
                     | undefined,
               ): Promise<{
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
               }>;
               options: {
                  method: "GET";
                  query: z.ZodObject<
                     {
                        configId: z.ZodOptional<z.ZodString>;
                        id: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: {
                        body?: undefined;
                     } & {
                        query?: Record<string, any> | undefined;
                     } & {
                        request?: Request;
                     } & {
                        headers?: HeadersInit;
                     } & {
                        asResponse?: boolean;
                        returnHeaders?: boolean;
                        use?: any[];
                     },
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
               };
               path: "/api-key/get";
            };
            updateApiKey: {
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?:
                           | Record<string, string[]>
                           | null
                           | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     asResponse: true;
                  },
               ): Promise<Response>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?:
                           | Record<string, string[]>
                           | null
                           | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: true;
                  },
               ): Promise<{
                  headers: Headers;
                  status: number;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?:
                           | Record<string, string[]>
                           | null
                           | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: false;
                  },
               ): Promise<{
                  headers: Headers;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?:
                           | Record<string, string[]>
                           | null
                           | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?:
                           | Record<string, string[]>
                           | null
                           | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: false;
                  },
               ): Promise<{
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
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?:
                           | Record<string, string[]>
                           | null
                           | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                  },
               ): Promise<{
                  headers: Headers;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?:
                           | Record<string, string[]>
                           | null
                           | undefined;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response: {
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
                  };
               }>;
               (
                  context?:
                     | ({
                          body: {
                             configId?: string | undefined;
                             keyId: string;
                             userId?: unknown;
                             name?: string | undefined;
                             enabled?: boolean | undefined;
                             remaining?: number | undefined;
                             refillAmount?: number | undefined;
                             refillInterval?: number | undefined;
                             metadata?: any;
                             expiresIn?: number | null | undefined;
                             rateLimitEnabled?: boolean | undefined;
                             rateLimitTimeWindow?: number | undefined;
                             rateLimitMax?: number | undefined;
                             permissions?:
                                | Record<string, string[]>
                                | null
                                | undefined;
                          };
                       } & {
                          method?: "POST" | undefined;
                       } & {
                          query?: Record<string, any> | undefined;
                       } & {
                          params?: Record<string, any>;
                       } & {
                          request?: Request;
                       } & {
                          headers?: HeadersInit;
                       } & {
                          asResponse?: boolean;
                          returnHeaders?: boolean;
                          returnStatus?: boolean;
                          use?: any[];
                          path?: string;
                          context?: Record<string, any>;
                       })
                     | undefined,
               ): Promise<{
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
               }>;
               options: {
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
               };
               path: "/api-key/update";
            };
            deleteApiKey: {
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     asResponse: true;
                  },
               ): Promise<Response>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: true;
                  },
               ): Promise<{
                  headers: Headers;
                  status: number;
                  response: {
                     success: boolean;
                  };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: false;
                  },
               ): Promise<{
                  headers: Headers;
                  response: {
                     success: boolean;
                  };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response: {
                     success: boolean;
                  };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: false;
                  },
               ): Promise<{
                  success: boolean;
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                  },
               ): Promise<{
                  headers: Headers;
                  response: {
                     success: boolean;
                  };
               }>;
               (
                  context: {
                     body: {
                        configId?: string | undefined;
                        keyId: string;
                     };
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response: {
                     success: boolean;
                  };
               }>;
               (
                  context?:
                     | ({
                          body: {
                             configId?: string | undefined;
                             keyId: string;
                          };
                       } & {
                          method?: "POST" | undefined;
                       } & {
                          query?: Record<string, any> | undefined;
                       } & {
                          params?: Record<string, any>;
                       } & {
                          request?: Request;
                       } & {
                          headers?: HeadersInit;
                       } & {
                          asResponse?: boolean;
                          returnHeaders?: boolean;
                          returnStatus?: boolean;
                          use?: any[];
                          path?: string;
                          context?: Record<string, any>;
                       })
                     | undefined,
               ): Promise<{
                  success: boolean;
               }>;
               options: {
                  method: "POST";
                  body: z.ZodObject<
                     {
                        configId: z.ZodOptional<z.ZodString>;
                        keyId: z.ZodString;
                     },
                     z.core.$strip
                  >;
                  use: ((
                     inputContext: {
                        body?: undefined;
                     } & {
                        query?: Record<string, any> | undefined;
                     } & {
                        request?: Request;
                     } & {
                        headers?: HeadersInit;
                     } & {
                        asResponse?: boolean;
                        returnHeaders?: boolean;
                        use?: any[];
                     },
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
               };
               path: "/api-key/delete";
            };
            listApiKeys: {
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query?:
                        | {
                             configId?: string | undefined;
                             organizationId?: string | undefined;
                             limit?: unknown;
                             offset?: unknown;
                             sortBy?: string | undefined;
                             sortDirection?: "asc" | "desc" | undefined;
                          }
                        | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     asResponse: true;
                  },
               ): Promise<Response>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query?:
                        | {
                             configId?: string | undefined;
                             organizationId?: string | undefined;
                             limit?: unknown;
                             offset?: unknown;
                             sortBy?: string | undefined;
                             sortDirection?: "asc" | "desc" | undefined;
                          }
                        | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: true;
                  },
               ): Promise<{
                  headers: Headers;
                  status: number;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query?:
                        | {
                             configId?: string | undefined;
                             organizationId?: string | undefined;
                             limit?: unknown;
                             offset?: unknown;
                             sortBy?: string | undefined;
                             sortDirection?: "asc" | "desc" | undefined;
                          }
                        | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: false;
                  },
               ): Promise<{
                  headers: Headers;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query?:
                        | {
                             configId?: string | undefined;
                             organizationId?: string | undefined;
                             limit?: unknown;
                             offset?: unknown;
                             sortBy?: string | undefined;
                             sortDirection?: "asc" | "desc" | undefined;
                          }
                        | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query?:
                        | {
                             configId?: string | undefined;
                             organizationId?: string | undefined;
                             limit?: unknown;
                             offset?: unknown;
                             sortBy?: string | undefined;
                             sortDirection?: "asc" | "desc" | undefined;
                          }
                        | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: false;
                  },
               ): Promise<{
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
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query?:
                        | {
                             configId?: string | undefined;
                             organizationId?: string | undefined;
                             limit?: unknown;
                             offset?: unknown;
                             sortBy?: string | undefined;
                             sortDirection?: "asc" | "desc" | undefined;
                          }
                        | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                  },
               ): Promise<{
                  headers: Headers;
                  response: {
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
                  };
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "GET" | undefined;
                  } & {
                     query?:
                        | {
                             configId?: string | undefined;
                             organizationId?: string | undefined;
                             limit?: unknown;
                             offset?: unknown;
                             sortBy?: string | undefined;
                             sortDirection?: "asc" | "desc" | undefined;
                          }
                        | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response: {
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
                  };
               }>;
               (
                  context?:
                     | ({
                          body?: undefined;
                       } & {
                          method?: "GET" | undefined;
                       } & {
                          query?:
                             | {
                                  configId?: string | undefined;
                                  organizationId?: string | undefined;
                                  limit?: unknown;
                                  offset?: unknown;
                                  sortBy?: string | undefined;
                                  sortDirection?: "asc" | "desc" | undefined;
                               }
                             | undefined;
                       } & {
                          params?: Record<string, any>;
                       } & {
                          request?: Request;
                       } & {
                          headers?: HeadersInit;
                       } & {
                          asResponse?: boolean;
                          returnHeaders?: boolean;
                          returnStatus?: boolean;
                          use?: any[];
                          path?: string;
                          context?: Record<string, any>;
                       })
                     | undefined,
               ): Promise<{
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
               }>;
               options: {
                  method: "GET";
                  use: ((
                     inputContext: {
                        body?: undefined;
                     } & {
                        query?: Record<string, any> | undefined;
                     } & {
                        request?: Request;
                     } & {
                        headers?: HeadersInit;
                     } & {
                        asResponse?: boolean;
                        returnHeaders?: boolean;
                        use?: any[];
                     },
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
               };
               path: "/api-key/list";
            };
            deleteAllExpiredApiKeys: {
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     asResponse: true;
                  },
               ): Promise<Response>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: true;
                  },
               ): Promise<{
                  headers: Headers;
                  status: number;
                  response: {
                     success: boolean;
                     error: unknown;
                  };
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                     returnStatus: false;
                  },
               ): Promise<{
                  headers: Headers;
                  response: {
                     success: boolean;
                     error: unknown;
                  };
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response: {
                     success: boolean;
                     error: unknown;
                  };
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: false;
                     returnStatus: false;
                  },
               ): Promise<{
                  success: boolean;
                  error: unknown;
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnHeaders: true;
                  },
               ): Promise<{
                  headers: Headers;
                  response: {
                     success: boolean;
                     error: unknown;
                  };
               }>;
               (
                  context: {
                     body?: undefined;
                  } & {
                     method?: "POST" | undefined;
                  } & {
                     query?: Record<string, any> | undefined;
                  } & {
                     params?: Record<string, any>;
                  } & {
                     request?: Request;
                  } & {
                     headers?: HeadersInit;
                  } & {
                     asResponse?: boolean;
                     returnHeaders?: boolean;
                     returnStatus?: boolean;
                     use?: any[];
                     path?: string;
                     context?: Record<string, any>;
                  } & {
                     returnStatus: true;
                  },
               ): Promise<{
                  status: number;
                  response: {
                     success: boolean;
                     error: unknown;
                  };
               }>;
               (
                  context?:
                     | ({
                          body?: undefined;
                       } & {
                          method?: "POST" | undefined;
                       } & {
                          query?: Record<string, any> | undefined;
                       } & {
                          params?: Record<string, any>;
                       } & {
                          request?: Request;
                       } & {
                          headers?: HeadersInit;
                       } & {
                          asResponse?: boolean;
                          returnHeaders?: boolean;
                          returnStatus?: boolean;
                          use?: any[];
                          path?: string;
                          context?: Record<string, any>;
                       })
                     | undefined,
               ): Promise<{
                  success: boolean;
                  error: unknown;
               }>;
               options: {
                  method: "POST";
               };
               path: string;
            };
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
      },
      import("better-auth").BetterAuthPlugin,
      {
         id: "tanstack-start-cookies";
         version: string;
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
