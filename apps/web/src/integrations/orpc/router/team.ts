import dayjs from "dayjs";
import { cnpjDataSchema } from "@core/authentication/server";
import type { DatabaseInstance } from "@core/database/client";
import { WebAppError } from "@core/logging/errors";
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
         createdAt: team.createdAt,
         updatedAt: team.updatedAt,
         cnpjData: team.cnpjData,
      })
      .from(team)
      .where(and(eq(team.id, teamId), eq(team.organizationId, organizationId)))
      .limit(1);

   if (!result) {
      throw WebAppError.notFound("Team not found");
   }

   return {
      ...result,
      cnpjData: result.cnpjData ? cnpjDataSchema.parse(result.cnpjData) : null,
   };
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
         where: (fields, { eq }) => eq(fields.teamId, input.teamId),
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
         where: (fields, { and, eq }) =>
            and(
               eq(fields.organizationId, organizationId),
               eq(fields.userId, input.userId),
            ),
      });

      if (!orgMember) {
         throw WebAppError.badRequest(
            "User must be an organization member first",
         );
      }

      // Check if already a team member
      const existingTeamMember = await db.query.teamMember.findFirst({
         where: (fields, { and, eq }) =>
            and(
               eq(fields.teamId, input.teamId),
               eq(fields.userId, input.userId),
            ),
      });

      if (existingTeamMember) {
         throw WebAppError.badRequest("User is already a team member");
      }

      // Add user to team
      const [newTeamMember] = await db
         .insert(teamMember)
         .values({
            teamId: input.teamId,
            userId: input.userId,
            createdAt: dayjs().toDate(),
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
