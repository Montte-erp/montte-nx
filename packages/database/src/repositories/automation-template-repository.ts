import { AppError, propagateError } from "@packages/utils/errors";
import { and, count, eq, ilike, or, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
   automationTemplate,
   automationTemplateUsage,
   type NewAutomationTemplate,
   type NewAutomationTemplateUsage,
   type TemplateCategory,
} from "../schemas/automation-templates";

export type {
   AutomationTemplate,
   NewAutomationTemplate,
} from "../schemas/automation-templates";

// ============================================
// Template CRUD
// ============================================

export async function createAutomationTemplate(
   dbClient: DatabaseInstance,
   data: NewAutomationTemplate,
) {
   try {
      const result = await dbClient
         .insert(automationTemplate)
         .values(data)
         .returning();
      return result[0];
   } catch (err: unknown) {
      const error = err as Error & { code?: string };

      if (error.code === "23505") {
         throw AppError.conflict("Template with this name already exists", {
            cause: err,
         });
      }

      propagateError(err);
      throw AppError.database(`Failed to create template: ${error.message}`, {
         cause: err,
      });
   }
}

export async function findAutomationTemplateById(
   dbClient: DatabaseInstance,
   templateId: string,
) {
   try {
      const result = await dbClient.query.automationTemplate.findFirst({
         where: (template, { eq }) => eq(template.id, templateId),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find template by id: ${(err as Error).message}`,
      );
   }
}

/**
 * Get templates available for an organization.
 * Returns both system templates and organization-specific templates.
 */
export async function findAvailableTemplates(
   dbClient: DatabaseInstance,
   organizationId: string,
   options: {
      category?: TemplateCategory;
      search?: string;
   } = {},
) {
   const { category, search } = options;

   try {
      const conditions = [
         // System templates OR organization templates
         or(
            eq(automationTemplate.isSystemTemplate, true),
            eq(automationTemplate.organizationId, organizationId),
         ),
      ];

      if (category) {
         conditions.push(eq(automationTemplate.category, category));
      }

      if (search) {
         conditions.push(
            or(
               ilike(automationTemplate.name, `%${search}%`),
               ilike(automationTemplate.description, `%${search}%`),
            ),
         );
      }

      const result = await dbClient.query.automationTemplate.findMany({
         orderBy: (template, { desc, asc }) => [
            desc(template.isSystemTemplate), // System templates first
            desc(template.usageCount), // Then by popularity
            asc(template.name),
         ],
         where: and(...conditions),
      });

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find available templates: ${(err as Error).message}`,
      );
   }
}

/**
 * Get only system templates (for seeding/management)
 */
export async function findSystemTemplates(dbClient: DatabaseInstance) {
   try {
      const result = await dbClient.query.automationTemplate.findMany({
         orderBy: (template, { asc }) => asc(template.name),
         where: (template, { eq }) => eq(template.isSystemTemplate, true),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find system templates: ${(err as Error).message}`,
      );
   }
}

/**
 * Get organization-specific templates (created by users)
 */
export async function findOrganizationTemplates(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient.query.automationTemplate.findMany({
         orderBy: (template, { desc }) => desc(template.createdAt),
         where: (template, { and, eq }) =>
            and(
               eq(template.organizationId, organizationId),
               eq(template.isSystemTemplate, false),
            ),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find organization templates: ${(err as Error).message}`,
      );
   }
}

export async function updateAutomationTemplate(
   dbClient: DatabaseInstance,
   templateId: string,
   data: Partial<NewAutomationTemplate>,
) {
   try {
      const existingTemplate = await findAutomationTemplateById(
         dbClient,
         templateId,
      );
      if (!existingTemplate) {
         throw AppError.notFound("Template not found");
      }

      // Prevent updating system templates
      if (existingTemplate.isSystemTemplate) {
         throw AppError.forbidden("Cannot modify system templates");
      }

      const result = await dbClient
         .update(automationTemplate)
         .set(data)
         .where(eq(automationTemplate.id, templateId))
         .returning();

      if (!result.length) {
         throw AppError.database("Template not found");
      }

      return result[0];
   } catch (err: unknown) {
      const error = err as Error & { code?: string };

      if (error.code === "23505") {
         throw AppError.conflict("Template with this name already exists", {
            cause: err,
         });
      }

      if (err instanceof AppError) {
         throw err;
      }

      propagateError(err);
      throw AppError.database(`Failed to update template: ${error.message}`, {
         cause: err,
      });
   }
}

export async function deleteAutomationTemplate(
   dbClient: DatabaseInstance,
   templateId: string,
   organizationId: string,
) {
   try {
      const existingTemplate = await findAutomationTemplateById(
         dbClient,
         templateId,
      );

      if (!existingTemplate) {
         throw AppError.notFound("Template not found");
      }

      // Prevent deleting system templates
      if (existingTemplate.isSystemTemplate) {
         throw AppError.forbidden("Cannot delete system templates");
      }

      // Only allow deleting own organization's templates
      if (existingTemplate.organizationId !== organizationId) {
         throw AppError.forbidden(
            "Cannot delete template from another organization",
         );
      }

      const result = await dbClient
         .delete(automationTemplate)
         .where(eq(automationTemplate.id, templateId))
         .returning();

      if (!result.length) {
         throw AppError.notFound("Template not found");
      }

      return result[0];
   } catch (err) {
      if (err instanceof AppError) {
         throw err;
      }
      propagateError(err);
      throw AppError.database(
         `Failed to delete template: ${(err as Error).message}`,
      );
   }
}

// ============================================
// Usage Tracking
// ============================================

export async function recordTemplateUsage(
   dbClient: DatabaseInstance,
   data: NewAutomationTemplateUsage,
) {
   try {
      // Record the usage
      const result = await dbClient
         .insert(automationTemplateUsage)
         .values(data)
         .returning();

      // Increment the usage count
      await dbClient
         .update(automationTemplate)
         .set({
            usageCount: sql`${automationTemplate.usageCount} + 1`,
            lastUsedAt: new Date(),
         })
         .where(eq(automationTemplate.id, data.templateId));

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to record template usage: ${(err as Error).message}`,
      );
   }
}

export async function getTemplateUsageCount(
   dbClient: DatabaseInstance,
   templateId: string,
) {
   try {
      const result = await dbClient
         .select({ count: count() })
         .from(automationTemplateUsage)
         .where(eq(automationTemplateUsage.templateId, templateId));

      return result[0]?.count || 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get template usage count: ${(err as Error).message}`,
      );
   }
}

// ============================================
// System Template Seeding
// ============================================

/**
 * Upsert a system template (for seeding)
 * If a system template with the same name exists, update it.
 * Otherwise, create a new one.
 */
export async function upsertSystemTemplate(
   dbClient: DatabaseInstance,
   data: Omit<NewAutomationTemplate, "isSystemTemplate" | "organizationId">,
) {
   try {
      // Check if system template with this name exists
      const existing = await dbClient.query.automationTemplate.findFirst({
         where: (template, { and, eq }) =>
            and(
               eq(template.name, data.name),
               eq(template.isSystemTemplate, true),
            ),
      });

      if (existing) {
         // Update existing system template
         const result = await dbClient
            .update(automationTemplate)
            .set({
               ...data,
               isSystemTemplate: true,
               organizationId: null,
            })
            .where(eq(automationTemplate.id, existing.id))
            .returning();
         return result[0];
      }

      // Create new system template
      const result = await dbClient
         .insert(automationTemplate)
         .values({
            ...data,
            isSystemTemplate: true,
            organizationId: null,
         })
         .returning();

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to upsert system template: ${(err as Error).message}`,
      );
   }
}
