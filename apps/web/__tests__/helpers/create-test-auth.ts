import type { DatabaseInstance } from "@core/database/client";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization, testUtils } from "better-auth/plugins";
import { z } from "zod";

export function createTestAuth(db: DatabaseInstance) {
   return betterAuth({
      baseURL: "http://localhost:3000",
      secret: "test-secret-at-least-32-characters-long",

      advanced: {
         database: { generateId: "uuid" },
      },

      database: drizzleAdapter(db, {
         provider: "pg",
      }),

      emailAndPassword: {
         enabled: true,
         requireEmailVerification: false,
      },

      plugins: [
         organization({
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
                     },
                  },
               },
            },
            teams: {
               allowRemovingAllTeams: false,
               defaultTeam: { enabled: false },
               enabled: true,
               maximumMembersPerTeam: 50,
               maximumTeams: 10,
            },
         }),

         testUtils(),
      ],
   });
}

export type TestAuth = ReturnType<typeof createTestAuth>;
