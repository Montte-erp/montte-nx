import { getOrganizationMembers } from "@core/database/repositories/auth-repository";
import { member, organization } from "@core/database/schemas/auth";
import { generatePresignedPutUrl } from "@core/files/client";
import { WebAppError } from "@core/logging/errors";
import { eq } from "drizzle-orm";
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
      const { auth, headers, session, db, stripeClient, userId } = context;

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

         const subscriptions = await auth.api.listActiveSubscriptions({
            headers,
            query: { referenceId: org.id },
         });

         const activeSubscription =
            subscriptions.find(
               (subscription) =>
                  subscription.status === "active" ||
                  subscription.status === "trialing",
            ) ?? null;

         const teams = await auth.api.listOrganizationTeams({
            headers,
            query: { organizationId: org.id },
         });
         const projectCount = teams.length;

         let projectLimit = 1;
         try {
            if (stripeClient) {
               const userRecord = await db.query.user.findFirst({
                  where: { id: userId },
               });
               if (userRecord?.stripeCustomerId) {
                  const paymentMethods = await stripeClient.paymentMethods.list(
                     {
                        customer: userRecord.stripeCustomerId,
                        type: "card",
                        limit: 1,
                     },
                  );
                  if (paymentMethods.data.length > 0) {
                     projectLimit = 6;
                  }
               }
            }
         } catch {
            projectLimit = 1;
         }

         return {
            ...org,
            activeSubscription,
            projectLimit,
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
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      image: m.user.image,
      createdAt: m.createdAt,
   }));
});

export const getMemberTeams = protectedProcedure
   .input(z.object({ userId: z.uuid() }))
   .handler(async ({ context, input }) => {
      const { db, organizationId } = context;

      const teams = await db.query.team.findMany({
         where: { organizationId },
      });

      const teamMemberships = await db.query.teamMember.findMany({
         where: { userId: input.userId },
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

      const addon = await db.query.organizationAddons.findFirst({
         where: {
            organizationId,
            addonId: input.addonId,
            OR: [
               { expiresAt: { isNull: true } },
               { expiresAt: { gt: new Date() } },
            ],
         },
      });

      return { hasAddon: !!addon };
   });

export const getAddons = protectedProcedure.handler(async ({ context }) => {
   const { db, organizationId } = context;

   const addons = await db.query.organizationAddons.findMany({
      where: {
         organizationId,
         OR: [
            { expiresAt: { isNull: true } },
            { expiresAt: { gt: new Date() } },
         ],
      },
   });

   return addons.map((a) => ({
      id: a.id,
      addonId: a.addonId,
      activatedAt: a.activatedAt,
      expiresAt: a.expiresAt,
      autoRenew: a.autoRenew,
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
