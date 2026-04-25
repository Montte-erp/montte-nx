import { getOrganizationMembers } from "@core/database/repositories/auth-repository";
import {
   member,
   organization,
   subscription,
} from "@core/database/schemas/auth";
import { generatePresignedPutUrl } from "@core/files/client";
import { minioClient } from "@/integrations/singletons";
import { WebAppError } from "@core/logging/errors";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { authenticatedProcedure, protectedProcedure } from "../server";

export const getOrganizations = authenticatedProcedure.handler(
   async ({ context }) => {
      const { db, userId } = context;

      return db
         .select({
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            logo: organization.logo,
            role: member.role,
            onboardingCompleted: organization.onboardingCompleted,
         })
         .from(member)
         .innerJoin(organization, eq(member.organizationId, organization.id))
         .where(eq(member.userId, userId));
   },
);

export const getActiveOrganization = protectedProcedure.handler(
   async ({ context }) => {
      const { auth, headers, session } = context;

      try {
         const organizationId = session.session.activeOrganizationId;

         if (!organizationId) {
            return null;
         }

         const org = await auth.api.getFullOrganization({
            headers,
            query: { organizationId },
         });

         if (!org) {
            return null;
         }

         const teams = await auth.api.listOrganizationTeams({
            headers,
            query: { organizationId: org.id },
         });
         const projectCount = teams.length;

         return {
            ...org,
            activeSubscription: null,
            projectLimit: 1,
            projectCount,
         };
      } catch (error) {
         if (error && typeof error === "object" && "status" in error) {
            const apiError = error as { status: string; statusCode?: number };

            if (
               apiError.status === "UNAUTHORIZED" ||
               apiError.statusCode === 401
            ) {
               throw WebAppError.unauthorized(
                  "Authentication required to access organization data",
               );
            }

            if (
               apiError.status === "FORBIDDEN" ||
               apiError.statusCode === 403
            ) {
               throw WebAppError.forbidden(
                  "Insufficient permissions to access organization data",
               );
            }
         }

         if (error instanceof WebAppError) {
            throw error;
         }

         throw WebAppError.internal("Failed to retrieve organization data");
      }
   },
);

export const getOrganizationTeams = protectedProcedure.handler(
   async ({ context }) => {
      const { auth, headers, organizationId } = context;

      try {
         const teams = await auth.api.listOrganizationTeams({
            headers,
            query: { organizationId },
         });

         return teams.map((team) => ({
            ...team,
            slug: (team as Record<string, unknown>).slug as string,
         }));
      } catch (error) {
         if (error && typeof error === "object" && "status" in error) {
            const apiError = error as { status: string; statusCode?: number };

            if (
               apiError.status === "UNAUTHORIZED" ||
               apiError.statusCode === 401
            ) {
               throw WebAppError.unauthorized(
                  "Authentication required to access organization teams",
               );
            }

            if (
               apiError.status === "FORBIDDEN" ||
               apiError.statusCode === 403
            ) {
               throw WebAppError.forbidden(
                  "Insufficient permissions to access organization teams",
               );
            }
         }

         if (error instanceof WebAppError) {
            throw error;
         }

         throw WebAppError.internal("Failed to retrieve organization teams");
      }
   },
);

export const getMembers = protectedProcedure.handler(async ({ context }) => {
   const { db, organizationId } = context;

   const members = await getOrganizationMembers(db, organizationId);

   return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user!.name,
      email: m.user!.email,
      role: m.role,
      image: m.user!.image,
      createdAt: m.createdAt,
   }));
});

export const getMemberTeams = protectedProcedure
   .input(z.object({ userId: z.uuid() }))
   .handler(async ({ context, input }) => {
      const { db, organizationId } = context;

      const teams = await db.query.team.findMany({
         where: (fields, { eq }) => eq(fields.organizationId, organizationId),
      });

      const teamMemberships = await db.query.teamMember.findMany({
         where: (fields, { eq }) => eq(fields.userId, input.userId),
      });

      const memberTeamIds = new Set(teamMemberships.map((tm) => tm.teamId));

      return teams
         .filter((t) => memberTeamIds.has(t.id))
         .map((t) => ({
            id: t.id,
            name: t.name,
         }));
   });

export const hasAddon = protectedProcedure
   .input(z.object({ addonId: z.string() }))
   .handler(async ({ context, input }) => {
      const { db, organizationId } = context;
      const row = await db.query.subscription.findFirst({
         where: (fields, { and, eq }) =>
            and(
               eq(fields.referenceId, organizationId),
               eq(fields.plan, input.addonId),
               inArray(fields.status, ["active", "trialing"]),
            ),
      });
      return { hasAddon: !!row };
   });

export const getAddons = protectedProcedure.handler(async ({ context }) => {
   const { db, organizationId } = context;
   const rows = await db
      .select()
      .from(subscription)
      .where(
         and(
            eq(subscription.referenceId, organizationId),
            inArray(subscription.status, ["active", "trialing"]),
         ),
      );
   return rows.map((row) => ({
      id: row.id,
      addonId: row.plan,
      activatedAt: row.periodStart ?? new Date(0),
      expiresAt: row.periodEnd ?? null,
      autoRenew: !row.cancelAtPeriodEnd,
   }));
});

export const generateLogoUploadUrl = protectedProcedure
   .input(
      z.object({
         fileExtension: z.string(),
         contentType: z.string(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { organizationId } = context;

      try {
         const bucketName = "organization-logos";
         const fileName = `org-${organizationId}-${crypto.randomUUID()}.${input.fileExtension}`;

         const presignedUrl = await generatePresignedPutUrl(
            minioClient,
            fileName,
            bucketName,
            300,
         );

         return {
            presignedUrl,
            fileName,
            publicUrl: `/api/files/${bucketName}/${fileName}`,
         };
      } catch (error) {
         throw WebAppError.internal("Failed to generate upload URL", {
            cause: error,
         });
      }
   });

export const updateLogo = protectedProcedure
   .input(
      z.object({
         logoUrl: z.string(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, organizationId } = context;

      await db
         .update(organization)
         .set({ logo: input.logoUrl })
         .where(eq(organization.id, organizationId));

      return { success: true };
   });
