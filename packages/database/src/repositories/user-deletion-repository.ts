import { eq } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
   automationRule,
   bankAccount,
   bill,
   budget,
   category,
   costCenter,
   counterparty,
   dashboard,
   interestTemplate,
   member,
   notification,
   notificationPreference,
   organization,
   pushSubscription,
   tag,
   transaction,
   transferLog,
} from "../schema";

/**
 * Delete organization-scoped data for a specific organization.
 * This is a helper function used during user deletion.
 */
async function deleteOrganizationScopedData(
   tx: Parameters<Parameters<DatabaseInstance["transaction"]>[0]>[0],
   organizationId: string,
) {
   await Promise.all([
      tx
         .delete(transaction)
         .where(eq(transaction.organizationId, organizationId)),
      tx.delete(bill).where(eq(bill.organizationId, organizationId)),
      tx.delete(budget).where(eq(budget.organizationId, organizationId)),
      tx.delete(category).where(eq(category.organizationId, organizationId)),
      tx.delete(tag).where(eq(tag.organizationId, organizationId)),
      tx
         .delete(bankAccount)
         .where(eq(bankAccount.organizationId, organizationId)),
      tx
         .delete(costCenter)
         .where(eq(costCenter.organizationId, organizationId)),
      tx
         .delete(counterparty)
         .where(eq(counterparty.organizationId, organizationId)),
      tx
         .delete(automationRule)
         .where(eq(automationRule.organizationId, organizationId)),
      tx.delete(dashboard).where(eq(dashboard.organizationId, organizationId)),
      tx
         .delete(interestTemplate)
         .where(eq(interestTemplate.organizationId, organizationId)),
      tx
         .delete(transferLog)
         .where(eq(transferLog.organizationId, organizationId)),
   ]);
}

/**
 * Delete all user data from the database across all organizations they belong to.
 * This includes: transactions, bills, budgets, categories, tags,
 * bank accounts, cost centers, counterparties, notifications,
 * dashboards, organizations (if no remaining members), and memberships.
 *
 * User-specific auth data (sessions, accounts, etc) will cascade via onDelete: "cascade".
 */
export async function deleteAllUserData(db: DatabaseInstance, userId: string) {
   await db.transaction(async (tx) => {
      // First, get all organizations the user belongs to
      const userMemberships = await tx.query.member.findMany({
         where: (m, { eq: mEq }) => mEq(m.userId, userId),
      });

      const organizationIds = userMemberships.map((m) => m.organizationId);

      // Delete organization-scoped data for each organization
      for (const orgId of organizationIds) {
         await deleteOrganizationScopedData(tx, orgId);
      }

      // Delete user-scoped data (once for the user)
      await Promise.all([
         tx
            .delete(notificationPreference)
            .where(eq(notificationPreference.userId, userId)),
         tx.delete(notification).where(eq(notification.userId, userId)),
         tx.delete(pushSubscription).where(eq(pushSubscription.userId, userId)),
      ]);

      // Delete all memberships for this user
      await tx.delete(member).where(eq(member.userId, userId));

      // Check each organization and delete if no remaining members
      for (const orgId of organizationIds) {
         const remainingMembers = await tx.query.member.findMany({
            where: (m, { eq: mEq }) => mEq(m.organizationId, orgId),
         });

         if (remainingMembers.length === 0) {
            await tx.delete(organization).where(eq(organization.id, orgId));
         }
      }
   });
}
