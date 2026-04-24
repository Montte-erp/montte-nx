import dayjs from "dayjs";
import { getLogger } from "@core/logging/root";
import { AppError, propagateError } from "@core/logging/errors";
const logger = getLogger().child({ module: "db:auth" });
import { createSlug, generateRandomSuffix } from "@core/utils/text";
import { eq } from "drizzle-orm";
import {
   member,
   organization,
   team,
   teamMember,
   user,
} from "@core/database/schemas/auth";
export async function findMemberByUserId(dbClient, userId) {
   try {
      const result = await dbClient.query.member.findFirst({
         where: (fields, { eq }) => eq(fields.userId, userId),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(`Failed to find user by id: ${err.message}`);
   }
}
export async function findMemberByUserIdAndOrganizationId(
   dbClient,
   userId,
   organizationId,
) {
   try {
      const result = await dbClient.query.member.findFirst({
         where: (fields, { and, eq }) =>
            and(
               eq(fields.userId, userId),
               eq(fields.organizationId, organizationId),
            ),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(`Failed to find member: ${err.message}`);
   }
}
export async function findOrganizationById(dbClient, organizationId) {
   try {
      const result = await dbClient.query.organization.findFirst({
         where: (fields, { eq }) => eq(fields.id, organizationId),
      });
      if (!result) throw AppError.database("Organization not found");
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find organization by id: ${err.message}`,
      );
   }
}
export async function isOrganizationOwner(dbClient, userId, organizationId) {
   try {
      const result = await dbClient.query.member.findFirst({
         where: (fields, { and, eq }) =>
            and(
               eq(fields.userId, userId),
               eq(fields.organizationId, organizationId),
               eq(fields.role, "owner"),
            ),
      });
      return !!result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to check organization ownership: ${err.message}`,
      );
   }
}
export async function getOrganizationMembers(dbClient, organizationId) {
   try {
      const result = await dbClient
         .select({
            id: member.id,
            organizationId: member.organizationId,
            userId: member.userId,
            role: member.role,
            createdAt: member.createdAt,
            user: {
               id: user.id,
               name: user.name,
               email: user.email,
               image: user.image,
            },
         })
         .from(member)
         .innerJoin(user, eq(member.userId, user.id))
         .where(eq(member.organizationId, organizationId));
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get organization members: ${err.message}`,
      );
   }
}
export async function createDefaultOrganization(dbClient, userId, userName) {
   try {
      const suffix = generateRandomSuffix();
      const safeUserName = (userName ?? "Workspace").trim();
      const safeSuffix = String(suffix).trim();
      const orgName = `${safeUserName}${safeSuffix}`;
      const orgSlug = createSlug(orgName);
      const now = dayjs().toDate();
      const [createdOrganization] = await dbClient
         .insert(organization)
         .values({
            createdAt: now,
            description: orgName,
            name: orgName,
            onboardingCompleted: false,
            slug: orgSlug,
         })
         .returning();
      if (!createdOrganization) {
         throw AppError.database("Failed to create organization");
      }
      await dbClient.insert(member).values({
         createdAt: now,
         organizationId: createdOrganization.id,
         role: "owner",
         userId,
      });
      // Create a default project for the organization
      const [defaultTeam] = await dbClient
         .insert(team)
         .values({
            name: "Default",
            slug: "default",
            organizationId: createdOrganization.id,
            createdAt: now,
         })
         .returning();
      if (defaultTeam) {
         await dbClient.insert(teamMember).values({
            teamId: defaultTeam.id,
            userId,
            createdAt: now,
         });
      }
      logger.info(
         {
            organizationId: createdOrganization.id,
            organizationName: orgName,
            organizationSlug: orgSlug,
            userId,
         },
         "Created organization",
      );
      return createdOrganization;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to create default organization: ${err.message}`,
      );
   }
}
export async function updateOrganization(dbClient, organizationId, data) {
   try {
      const result = await dbClient
         .update(organization)
         .set(data)
         .where(eq(organization.id, organizationId))
         .returning();
      if (!result.length) {
         throw AppError.database("Organization not found");
      }
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(`Failed to update organization: ${err.message}`);
   }
}
export async function getOrganizationMembership(
   dbClient,
   userId,
   organizationSlug,
) {
   try {
      const org = await dbClient.query.organization.findFirst({
         where: (fields, { eq }) => eq(fields.slug, organizationSlug),
      });
      if (!org) {
         return { membership: null, organization: null };
      }
      const membership = await dbClient.query.member.findFirst({
         where: (fields, { and, eq }) =>
            and(eq(fields.organizationId, org.id), eq(fields.userId, userId)),
      });
      return { membership, organization: org };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get organization membership: ${err.message}`,
      );
   }
}
export async function ensureDefaultProject(dbClient, organizationId, userId) {
   try {
      const existingTeam = await dbClient.query.team.findFirst({
         where: (fields, { eq }) => eq(fields.organizationId, organizationId),
      });
      if (existingTeam) return existingTeam;
      const now = dayjs().toDate();
      const [created] = await dbClient
         .insert(team)
         .values({
            name: "Default",
            slug: "default",
            organizationId,
            createdAt: now,
         })
         .returning();
      if (!created) {
         throw AppError.database("Failed to create default team");
      }
      await dbClient.insert(teamMember).values({
         teamId: created.id,
         userId,
         createdAt: now,
      });
      logger.info(
         {
            teamId: created.id,
            teamName: created.name,
            organizationId,
         },
         "Created default team",
      );
      return created;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to ensure default project: ${err.message}`,
      );
   }
}
