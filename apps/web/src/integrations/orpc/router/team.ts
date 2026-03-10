import { ORPCError } from "@orpc/server";
import type { DatabaseInstance } from "@core/database/client";
import { team, teamMember } from "@core/database/schemas/auth";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const teamIdSchema = z.object({
   teamId: z.uuid(),
});

const domainPatternRegex =
   /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

const updateAllowedDomainsSchema = z.object({
   teamId: z.uuid(),
   allowedDomains: z
      .array(
         z
            .string()
            .min(1)
            .max(253)
            .regex(domainPatternRegex, "Invalid domain pattern"),
      )
      .max(50),
});

// =============================================================================
// Helpers
// =============================================================================

/**
 * Verify that a team belongs to the current organization and return it.
 */
async function verifyTeamOwnership(
   db: DatabaseInstance,
   teamId: string,
   organizationId: string,
) {
   const [result] = await db
      .select({
         id: team.id,
         name: team.name,
         description: team.description,
         allowedDomains: team.allowedDomains,
         createdAt: team.createdAt,
         updatedAt: team.updatedAt,
      })
      .from(team)
      .where(and(eq(team.id, teamId), eq(team.organizationId, organizationId)))
      .limit(1);

   if (!result) {
      throw new ORPCError("NOT_FOUND", {
         message: "Team not found",
      });
   }

   return result;
}

// =============================================================================
// Procedures
// =============================================================================

/**
 * Get a team by ID, verifying it belongs to the user's active organization.
 */
export const get = protectedProcedure
   .input(teamIdSchema)
   .handler(async ({ context, input }) => {
      const { db, organizationId } = context;

      return verifyTeamOwnership(db, input.teamId, organizationId);
   });

/**
 * Update the allowed domains for a team.
 * Validates domain patterns and verifies team ownership.
 */
export const updateAllowedDomains = protectedProcedure
   .input(updateAllowedDomainsSchema)
   .handler(async ({ context, input }) => {
      const { db, organizationId } = context;

      // Verify team belongs to this organization
      await verifyTeamOwnership(db, input.teamId, organizationId);

      const [updated] = await db
         .update(team)
         .set({ allowedDomains: input.allowedDomains })
         .where(eq(team.id, input.teamId))
         .returning({ allowedDomains: team.allowedDomains });

      if (!updated) {
         throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to update allowed domains",
         });
      }

      return { allowedDomains: updated.allowedDomains };
   });

/**
 * Get all members of a team (read-only).
 * Uses Better Auth for member data enrichment.
 */
export const getMembers = protectedProcedure
   .input(teamIdSchema)
   .handler(async ({ context, input }) => {
      const { auth, db, headers, organizationId } = context;

      // Verify team belongs to this organization
      await verifyTeamOwnership(db, input.teamId, organizationId);

      // Get organization members via Better Auth
      const orgMembers = await auth.api.listMembers({
         headers,
         query: { organizationId },
      });

      // Get team member IDs
      const teamMemberRecords = await db.query.teamMember.findMany({
         where: { teamId: input.teamId },
      });

      const teamMemberIds = new Set(teamMemberRecords.map((tm) => tm.userId));

      // Filter org members to only include team members
      const teamMembers = orgMembers.members
         .filter((m) => teamMemberIds.has(m.userId))
         .map((m) => ({
            id: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            image: m.user.image,
            createdAt: new Date(m.createdAt),
         }));

      return teamMembers;
   });

/**
 * Add a member to a team.
 * Requires the user to be an organization member first.
 */
export const addMember = protectedProcedure
   .input(
      z.object({
         teamId: z.uuid(),
         userId: z.uuid(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, organizationId } = context;

      // Verify team belongs to this organization
      await verifyTeamOwnership(db, input.teamId, organizationId);

      // Check if user is a member of the organization
      const orgMember = await db.query.member.findFirst({
         where: { organizationId, userId: input.userId },
      });

      if (!orgMember) {
         throw new ORPCError("BAD_REQUEST", {
            message: "User must be an organization member first",
         });
      }

      // Check if already a team member
      const existingTeamMember = await db.query.teamMember.findFirst({
         where: { teamId: input.teamId, userId: input.userId },
      });

      if (existingTeamMember) {
         throw new ORPCError("BAD_REQUEST", {
            message: "User is already a team member",
         });
      }

      // Add user to team
      const [newTeamMember] = await db
         .insert(teamMember)
         .values({
            teamId: input.teamId,
            userId: input.userId,
            createdAt: new Date(),
         })
         .returning();

      return newTeamMember;
   });

/**
 * Remove a member from a team.
 */
export const removeMember = protectedProcedure
   .input(
      z.object({
         teamId: z.uuid(),
         userId: z.uuid(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, organizationId } = context;

      // Verify team belongs to this organization
      await verifyTeamOwnership(db, input.teamId, organizationId);

      // Remove from team
      await db
         .delete(teamMember)
         .where(
            and(
               eq(teamMember.teamId, input.teamId),
               eq(teamMember.userId, input.userId),
            ),
         );

      return { success: true };
   });
