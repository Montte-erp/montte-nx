import { apiKey } from "@better-auth/api-key";
import { oauthProvider } from "@better-auth/oauth-provider";
import { stripe as stripePlugin } from "@better-auth/stripe";
import type { DatabaseInstance } from "@packages/database/client";
import { findMemberByUserId } from "@packages/database/repositories/auth-repository";
import { getDomain, isProduction } from "@packages/environment/helpers";
import type { ServerEnv } from "@packages/environment/server";
import { getLogger } from "@packages/logging/root";
import { getElysiaPosthogConfig } from "@packages/posthog/server";
import { createRedisConnection } from "@packages/redis/connection";
import { getStripeClient } from "@packages/stripe";
import {
   getResendClient,
   sendEmailOTP,
   sendMagicLinkEmail,
   sendOrganizationInvitation,
} from "@packages/transactional/client";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import {
   admin,
   emailOTP,
   jwt,
   lastLoginMethod,
   magicLink,
   organization,
   twoFactor,
} from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import type Stripe from "stripe";
import { z } from "zod";
import { createBetterAuthStorage } from "./cache";

const logger = getLogger().child({ module: "auth" });

export const ORGANIZATION_LIMIT = 3;

// Dev-only: stores magic link URLs in memory so the frontend can auto-redirect.
// Never populated in production (isProduction is true), so always empty there.
const devMagicLinkStore = new Map<string, string>();

export function getDevMagicLink(email: string): string | undefined {
   const url = devMagicLinkStore.get(email);
   devMagicLinkStore.delete(email);
   return url;
}

export interface SimplifiedAuthConfig {
   db: DatabaseInstance;
   env: ServerEnv;
}

export function createAuth(config: SimplifiedAuthConfig) {
   const { db, env } = config;

   const redis = createRedisConnection(env.REDIS_URL);
   const resendClient = getResendClient(env.RESEND_API_KEY ?? "");
   const stripeClient = getStripeClient(env.STRIPE_SECRET_KEY);

   const posthogClient = getElysiaPosthogConfig({
      POSTHOG_HOST: env.POSTHOG_HOST,
      POSTHOG_KEY: env.POSTHOG_KEY,
   });

   return betterAuth({
      baseURL: env.BETTER_AUTH_URL,
      secret: env.BETTER_AUTH_SECRET,
      trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS.split(","),

      account: {
         accountLinking: {
            enabled: true,
         },
      },

      socialProviders: {
         google: {
            clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID,
            clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
         },
      },

      advanced: {
         database: { generateId: "uuid" },
      },

      secondaryStorage: createBetterAuthStorage(redis),

      database: drizzleAdapter(db, {
         provider: "pg",
      }),

      databaseHooks: {
         session: {
            create: {
               before: async (session) => {
                  try {
                     const member = await findMemberByUserId(
                        db,
                        session.userId,
                     );

                     if (member?.organizationId) {
                        const existingTeam = await db.query.team.findFirst({
                           where: (team, { eq }) =>
                              eq(team.organizationId, member.organizationId),
                        });

                        return {
                           data: {
                              ...session,
                              activeOrganizationId: member.organizationId,
                              activeTeamId: existingTeam?.id,
                           },
                        };
                     }

                     // No organization — session created without org context.
                     // User will be redirected to onboarding by route guards.
                     return { data: session };
                  } catch (error) {
                     logger.error(
                        { err: error },
                        "Error in session create before hook",
                     );
                     return { data: session };
                  }
               },
            },
         },
         user: {
            create: {
               after: async (_user) => {
                  // Organization creation handled by onboarding flow.
                  // No auto-creation — user starts with zero orgs.
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
         additionalFields: {
            telemetryConsent: {
               defaultValue: false,
               input: true,
               required: true,
               type: "boolean",
            },
            contentCreationMode: {
               defaultValue: "plan",
               input: true,
               required: false,
               type: "string",
            },
         },
      },

      plugins: [
         admin(),

         magicLink({
            expiresIn: 60 * 15, // 15 minutes
            async sendMagicLink({ email, url }) {
               if (!isProduction) {
                  logger.info({ email, url }, "DEV magic link generated");
                  devMagicLinkStore.set(email, url);
                  return;
               }
               await sendMagicLinkEmail(resendClient, {
                  email,
                  magicLinkUrl: url,
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
                  logger.info({ email, type, otp }, "DEV OTP generated");
                  return;
               }
               await sendEmailOTP(resendClient, { email, otp, type });
            },
         }),

         lastLoginMethod(),

         organization({
            organizationLimit: ORGANIZATION_LIMIT,
            schema: {
               organization: {
                  additionalFields: {
                     context: {
                        defaultValue: "personal",
                        input: true,
                        required: false,
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
                     allowedDomains: {
                        type: "string[]",
                        input: true,
                        required: false,
                        validator: {
                           input: z.array(
                              z
                                 .string()
                                 .regex(
                                    /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/,
                                    "Invalid domain pattern. Examples: example.com, *.example.com, app.example.com, localhost",
                                 ),
                           ),
                        },
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
                     accountType: {
                        defaultValue: "personal",
                        input: true,
                        required: false,
                        type: "string",
                        validator: {
                           input: z
                              .enum(["personal", "business"])
                              .nullable()
                              .optional(),
                        },
                     },
                  },
               },
            },
            async sendInvitationEmail(data) {
               const inviteLink = `${getDomain()}/callback/organization/invitation/${data.id}`;
               if (!isProduction) {
                  logger.info(
                     { email: data.email, inviteLink },
                     "DEV organization invitation generated",
                  );
                  return;
               }
               await sendOrganizationInvitation(resendClient, {
                  email: data.email,
                  invitedByEmail: data.inviter.user.email,
                  invitedByUsername: data.inviter.user.name,
                  inviteLink,
                  teamName: data.organization.name,
               });
            },
            teams: {
               allowRemovingAllTeams: false,
               defaultTeam: {
                  enabled: false, // Don't auto-create team on org creation
               },
               enabled: true,
               maximumMembersPerTeam: 50,
               maximumTeams: 10,
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

         // Used by webhooks for signing secrets (stored via Better Auth's key table)
         apiKey({
            enableSessionForAPIKeys: true,
            enableMetadata: true,
            defaultPrefix: "cta_",
            apiKeyHeaders: ["sdk-api-key", "x-api-key"],
            rateLimit: {
               enabled: true,
               timeWindow: 1000 * 60, // 1 minute
               maxRequests: 100,
            },
         }),

         stripePlugin({
            createCustomerOnSignUp: true,
            stripeClient,
            stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
            subscription: {
               authorizeReference: async ({ user, referenceId }) => {
                  const membership = await db.query.member.findFirst({
                     where: (member, { eq, and }) =>
                        and(
                           eq(member.organizationId, referenceId),
                           eq(member.userId, user.id),
                        ),
                  });
                  if (!membership) return false;
                  return (
                     membership.role === "owner" || membership.role === "admin"
                  );
               },
               enabled: true,
               getCheckoutSessionParams: async () => ({
                  params: {
                     allow_promotion_codes: true,
                  },
               }),
               plans: [
                  // Platform addons
                  {
                     name: "boost",
                     priceId: env.STRIPE_BOOST_PRICE_ID,
                  },
                  {
                     name: "scale",
                     priceId: env.STRIPE_SCALE_PRICE_ID,
                  },
                  {
                     name: "enterprise",
                     priceId: env.STRIPE_ENTERPRISE_PRICE_ID,
                  },
               ],
            },
            onSubscriptionComplete: async ({
               subscription,
               stripeSubscription,
            }: {
               subscription: { id: string; plan: string; referenceId: string };
               stripeSubscription: Stripe.Subscription;
            }) => {
               try {
                  const invoice = await stripeClient.invoices.retrieve(
                     stripeSubscription.latest_invoice as string,
                  );
                  posthogClient.capture({
                     distinctId: subscription.referenceId,
                     event: "subscription_started",
                     groups: { organization: subscription.referenceId },
                     properties: {
                        $currency: invoice.currency.toUpperCase(),
                        $revenue: invoice.amount_paid / 100,
                        interval:
                           stripeSubscription.items.data[0]?.plan.interval,
                        organization_id: subscription.referenceId,
                        plan_name: subscription.plan,
                        subscription_id: subscription.id,
                     },
                  });
               } catch (error) {
                  logger.error(
                     { err: error },
                     "Failed to capture subscription_started event",
                  );
               }
            },
            onSubscriptionCancel: async ({
               subscription,
            }: {
               subscription: { id: string; plan: string; referenceId: string };
            }) => {
               try {
                  posthogClient.capture({
                     distinctId: subscription.referenceId,
                     event: "subscription_canceled",
                     groups: { organization: subscription.referenceId },
                     properties: {
                        organization_id: subscription.referenceId,
                        plan_name: subscription.plan,
                        subscription_id: subscription.id,
                     },
                  });
               } catch (error) {
                  logger.error(
                     { err: error },
                     "Failed to capture subscription_canceled event",
                  );
               }
            },
         }),

         // JWT + OAuth 2.1 Provider (enables MCP authentication)
         jwt(),

         oauthProvider({
            loginPage: "/sign-in",
            consentPage: "/oauth/consent",
            enableMcp: true,
            allowDynamicClientRegistration: true,
            allowUnauthenticatedClientRegistration: true,
            scopes: [
               "openid",
               "profile",
               "email",
               "offline_access",
               "content:read",
               "content:write",
               "content:publish",
               "writer:read",
            ],
            accessTokenExpiresIn: 3600, // 1 hour
            refreshTokenExpiresIn: 2592000, // 30 days
            postLogin: {
               page: "/oauth/select-organization",
               shouldRedirect: async () => false,
               consentReferenceId: ({ session }) => {
                  const orgId = session?.activeOrganizationId;
                  return typeof orgId === "string" ? orgId : undefined;
               },
            },
         }),

         // Must be last - enables proper cookie handling for TanStack Start
         tanstackStartCookies(),
      ],
   });
}

export type AuthInstance = ReturnType<typeof createAuth>;
