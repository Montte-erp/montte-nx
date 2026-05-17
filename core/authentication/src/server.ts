import { createHash } from "node:crypto";
import dayjs from "dayjs";
import { apiKey } from "@better-auth/api-key";
import { i18n } from "@better-auth/i18n";
import * as schema from "@core/database/schema";
import { getDomain, isProduction } from "@core/environment/helpers";
import { log } from "@core/logging";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import {
   emailOTP,
   lastLoginMethod,
   magicLink,
   organization,
   twoFactor,
} from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { ptBRTranslations } from "@core/authentication/translations/pt-br";
import { z } from "zod";
import type { DatabaseInstance } from "@core/database/client";
import type { NotificationsClient } from "@core/notifications/client";
import type { PostHog } from "@core/posthog/server";
import type { Redis } from "@core/redis/connection";

export const cnpjDataSchema = z.object({
   cnpj: z.string(),
   razao_social: z.string(),
   nome_fantasia: z.string().nullable(),
   cnae_fiscal: z.number(),
   cnae_fiscal_descricao: z.string().nullable(),
   cnaes_secundarios: z.array(
      z.object({ codigo: z.number(), descricao: z.string() }),
   ),
   porte: z.string().nullable(),
   natureza_juridica: z.string().nullable(),
   municipio: z.string().nullable(),
   uf: z.string().nullable(),
   data_inicio_atividade: z.string(),
   descricao_situacao_cadastral: z.string(),
   qsa: z.array(z.unknown()),
   regime_tributario: z.array(z.unknown()).nullable(),
});

export type CnpjData = z.infer<typeof cnpjDataSchema>;

export const ORGANIZATION_LIMIT = 3;

const devMagicLinkStore = new Map<string, string>();

function emailDomain(email: string): string {
   return email.split("@").at(1) ?? "unknown";
}

function secretHash(value: string): string {
   return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function getDevMagicLink(email: string): string | undefined {
   const url = devMagicLinkStore.get(email);
   devMagicLinkStore.delete(email);
   return url;
}

export interface CreateAuthDeps {
   db: DatabaseInstance;
   redis: Redis;
   posthog: PostHog;
   notificationsClient: NotificationsClient;
   env: {
      BETTER_AUTH_URL?: string;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_TRUSTED_ORIGINS: string;
   };
}

export function createAuth(deps: CreateAuthDeps) {
   const { db, redis, notificationsClient, env } = deps;

   const auth = betterAuth({
      baseURL: env.BETTER_AUTH_URL,
      secret: env.BETTER_AUTH_SECRET,
      trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS.split(","),

      account: {
         accountLinking: {
            enabled: true,
         },
      },

      advanced: {
         database: { generateId: "uuid" },
         cookiePrefix: "montte",
      },

      secondaryStorage: {
         get: (key) => redis.get(`better-auth:${key}`),
         set: async (key, value, ttl) => {
            const prefixed = `better-auth:${key}`;
            if (ttl !== undefined && ttl > 0) {
               await redis.set(prefixed, value, "EX", ttl);
            } else {
               await redis.set(prefixed, value);
            }
         },
         delete: (key) => redis.del(`better-auth:${key}`).then(() => undefined),
      },

      database: drizzleAdapter(db, {
         provider: "pg",
         transaction: true,
         schema,
      }),

      databaseHooks: {
         session: {
            create: {
               before: async (session) => {
                  try {
                     const member = await db.query.member.findFirst({
                        where: (f, { eq }) => eq(f.userId, session.userId),
                     });

                     if (member?.organizationId) {
                        const existingTeam = await db.query.team.findFirst({
                           where: (fields, { eq }) =>
                              eq(fields.organizationId, member.organizationId),
                        });

                        return {
                           data: {
                              ...session,
                              activeOrganizationId: member.organizationId,
                              activeTeamId: existingTeam?.id,
                           },
                        };
                     }

                     return { data: session };
                  } catch (error) {
                     log.error({
                        module: "auth",
                        message: "Error in session create before hook",
                        err: error,
                     });
                     return { data: session };
                  }
               },
            },
         },
      },

      emailAndPassword: {
         enabled: true,
         requireEmailVerification: isProduction,
      },

      emailVerification: {
         autoSignInAfterVerification: true,
         sendOnSignUp: isProduction,
      },

      experimental: {
         joins: true,
      },

      session: {
         storeSessionInDatabase: true,
         cookieCache: {
            enabled: true,
            maxAge: 5 * 60,
         },
      },

      user: {
         changeEmail: {
            enabled: true,
         },
         deleteUser: {
            enabled: true,
         },
      },

      plugins: [
         i18n({
            defaultLocale: "pt-BR",
            detection: [],
            translations: { "pt-BR": ptBRTranslations },
         }),

         magicLink({
            expiresIn: 60 * 15,
            async sendMagicLink({ email, url }) {
               if (!isProduction) {
                  log.info({
                     module: "auth",
                     message: "DEV magic link generated",
                     emailDomain: emailDomain(email),
                     flow: "magic-link",
                     tokenHash: secretHash(url),
                  });
                  devMagicLinkStore.set(email, url);
                  return;
               }
               await notificationsClient.magicLink.send({
                  to: email,
                  input: { magicLinkUrl: url },
               });
            },
         }),

         emailOTP({
            expiresIn: 60 * 10,
            otpLength: 6,
            sendVerificationOnSignUp: isProduction,
            changeEmail: {
               enabled: true,
            },
            async sendVerificationOTP({ email, otp, type }) {
               if (!isProduction) {
                  log.info({
                     module: "auth",
                     message: "DEV OTP generated",
                     emailDomain: emailDomain(email),
                     flow: type,
                     type,
                     tokenHash: secretHash(otp),
                  });
                  return;
               }
               await notificationsClient.emailOtp.send({
                  to: email,
                  input: { otp, type },
               });
            },
         }),

         lastLoginMethod(),

         organization({
            organizationLimit: ORGANIZATION_LIMIT,
            schema: {
               organization: {
                  additionalFields: {
                     description: {
                        defaultValue: "",
                        input: true,
                        required: false,
                        type: "string",
                     },
                     onboardingCompleted: {
                        defaultValue: false,
                        input: true,
                        required: false,
                        type: "boolean",
                     },
                  },
               },
               team: {
                  additionalFields: {
                     slug: {
                        input: true,
                        required: true,
                        type: "string",
                     },
                     description: {
                        defaultValue: "",
                        input: true,
                        required: false,
                        type: "string",
                     },
                     onboardingCompleted: {
                        defaultValue: false,
                        input: true,
                        required: false,
                        type: "boolean",
                     },
                     onboardingProducts: {
                        defaultValue: null,
                        input: true,
                        required: false,
                        type: "json",
                        validator: {
                           input: z
                              .array(z.enum(["content", "forms", "analytics"]))
                              .nullable(),
                        },
                     },
                     onboardingTasks: {
                        defaultValue: null,
                        input: true,
                        required: false,
                        type: "json",
                        validator: {
                           input: z.record(z.string(), z.boolean()).nullable(),
                        },
                     },
                     cnpj: {
                        defaultValue: null,
                        input: true,
                        required: false,
                        type: "string",
                        validator: {
                           input: z
                              .string()
                              .regex(/^\d{14}$/, "CNPJ deve conter 14 dígitos")
                              .nullable()
                              .optional(),
                        },
                     },
                     cnpjData: {
                        defaultValue: null,
                        input: true,
                        required: false,
                        type: "json",
                        validator: {
                           input: cnpjDataSchema.nullable().optional(),
                        },
                     },
                  },
               },
            },
            async sendInvitationEmail(data) {
               const inviteLink = `${getDomain()}/callback/organization/invitation/${data.id}`;
               if (!isProduction) {
                  log.info({
                     module: "auth",
                     message: "DEV organization invitation generated",
                     emailDomain: emailDomain(data.email),
                     flow: "organization-invitation",
                     tokenHash: secretHash(inviteLink),
                  });
                  return;
               }
               await notificationsClient.organizationInvitation.send({
                  to: data.email,
                  input: {
                     invitedByEmail: data.inviter.user.email,
                     invitedByUsername: data.inviter.user.name,
                     inviteLink,
                     teamName: data.organization.name,
                  },
               });
            },
            teams: {
               allowRemovingAllTeams: false,
               defaultTeam: {
                  enabled: false,
               },
               enabled: true,
               maximumMembersPerTeam: 50,
               maximumTeams: 10,
            },
            organizationHooks: {
               afterCreateTeam: async ({ team, user }) => {
                  if (!user) return;
                  await db
                     .insert(schema.teamMember)
                     .values({
                        teamId: team.id,
                        userId: user.id,
                        createdAt: dayjs().toDate(),
                     })
                     .onConflictDoNothing();
               },
            },
         }),

         twoFactor({
            issuer: "Montte",
            skipVerificationOnEnable: false,
            totpOptions: {
               digits: 6,
               period: 30,
            },
            backupCodeOptions: {
               amount: 10,
               length: 10,
            },
         }),

         apiKey({
            enableSessionForAPIKeys: true,
            enableMetadata: true,
            defaultPrefix: "mntt_",
            apiKeyHeaders: ["sdk-api-key", "x-api-key"],
         }),

         tanstackStartCookies(),
      ],
   });

   return auth;
}

export type AuthInstance = ReturnType<typeof createAuth>;
