import { relations } from "drizzle-orm";

import {
   account,
   invitation,
   member,
   organization,
   session,
   team,
   teamMember,
   twoFactor,
   user,
} from "@core/database/schemas/auth";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { bills, recurrenceSettings } from "@core/database/schemas/bills";
import { budgetGoals } from "@core/database/schemas/budget-goals";
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import { creditCards } from "@core/database/schemas/credit-cards";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";
import { dashboards } from "@core/database/schemas/dashboards";
import { events } from "@core/database/schemas/events";
import {
   financialGoalMovements,
   financialGoals,
} from "@core/database/schemas/financial-goals";
import { insights } from "@core/database/schemas/insights";
import {
   inventoryMovements,
   inventoryProducts,
} from "@core/database/schemas/inventory";
import {
   resources,
   services,
   serviceVariants,
} from "@core/database/schemas/services";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { tags } from "@core/database/schemas/tags";
import {
   transactionItems,
   transactions,
   transactionTags,
} from "@core/database/schemas/transactions";
import {
   webhookDeliveries,
   webhookEndpoints,
} from "@core/database/schemas/webhooks";

export const userRelations = relations(user, ({ many }) => ({
   sessions: many(session),
   accounts: many(account),
   teamMembers: many(teamMember),
   members: many(member),
   invitations: many(invitation),
   twoFactors: many(twoFactor),
}));

export const sessionRelations = relations(session, ({ one }) => ({
   user: one(user, {
      fields: [session.userId],
      references: [user.id],
   }),
}));

export const accountRelations = relations(account, ({ one }) => ({
   user: one(user, {
      fields: [account.userId],
      references: [user.id],
   }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
   teams: many(team),
   members: many(member),
   invitations: many(invitation),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
   organization: one(organization, {
      fields: [team.organizationId],
      references: [organization.id],
   }),
   teamMembers: many(teamMember),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
   team: one(team, {
      fields: [teamMember.teamId],
      references: [team.id],
   }),
   user: one(user, {
      fields: [teamMember.userId],
      references: [user.id],
   }),
}));

export const memberRelations = relations(member, ({ one }) => ({
   organization: one(organization, {
      fields: [member.organizationId],
      references: [organization.id],
   }),
   user: one(user, {
      fields: [member.userId],
      references: [user.id],
   }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
   organization: one(organization, {
      fields: [invitation.organizationId],
      references: [organization.id],
   }),
   user: one(user, {
      fields: [invitation.inviterId],
      references: [user.id],
   }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
   user: one(user, {
      fields: [twoFactor.userId],
      references: [user.id],
   }),
}));

export const billsRelations = relations(bills, ({ one }) => ({
   bankAccount: one(bankAccounts, {
      fields: [bills.bankAccountId],
      references: [bankAccounts.id],
   }),
   category: one(categories, {
      fields: [bills.categoryId],
      references: [categories.id],
   }),
   transaction: one(transactions, {
      fields: [bills.transactionId],
      references: [transactions.id],
   }),
   recurrenceSetting: one(recurrenceSettings, {
      fields: [bills.recurrenceGroupId],
      references: [recurrenceSettings.id],
   }),
   contact: one(contacts, {
      fields: [bills.contactId],
      references: [contacts.id],
   }),
}));

export const recurrenceSettingsRelations = relations(
   recurrenceSettings,
   ({ many }) => ({
      bills: many(bills),
   }),
);

export const budgetGoalsRelations = relations(budgetGoals, ({ one }) => ({
   category: one(categories, {
      fields: [budgetGoals.categoryId],
      references: [categories.id],
   }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
   parent: one(categories, {
      fields: [categories.parentId],
      references: [categories.id],
      relationName: "categoryHierarchy",
   }),
   children: many(categories, {
      relationName: "categoryHierarchy",
   }),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
   transactions: many(transactions),
   contactSubscriptions: many(contactSubscriptions),
}));

export const dashboardsRelations = relations(dashboards, ({ one }) => ({
   organization: one(organization, {
      fields: [dashboards.organizationId],
      references: [organization.id],
   }),
   team: one(team, {
      fields: [dashboards.teamId],
      references: [team.id],
   }),
   createdByUser: one(user, {
      fields: [dashboards.createdBy],
      references: [user.id],
   }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
   organization: one(organization, {
      fields: [events.organizationId],
      references: [organization.id],
   }),
   user: one(user, {
      fields: [events.userId],
      references: [user.id],
   }),
   team: one(team, {
      fields: [events.teamId],
      references: [team.id],
   }),
}));

export const insightsRelations = relations(insights, ({ one }) => ({
   organization: one(organization, {
      fields: [insights.organizationId],
      references: [organization.id],
   }),
   team: one(team, {
      fields: [insights.teamId],
      references: [team.id],
   }),
   createdByUser: one(user, {
      fields: [insights.createdBy],
      references: [user.id],
   }),
}));

export const financialGoalsRelations = relations(
   financialGoals,
   ({ one, many }) => ({
      category: one(categories, {
         fields: [financialGoals.categoryId],
         references: [categories.id],
      }),
      movements: many(financialGoalMovements),
   }),
);

export const financialGoalMovementsRelations = relations(
   financialGoalMovements,
   ({ one }) => ({
      goal: one(financialGoals, {
         fields: [financialGoalMovements.goalId],
         references: [financialGoals.id],
      }),
      transaction: one(transactions, {
         fields: [financialGoalMovements.transactionId],
         references: [transactions.id],
      }),
   }),
);

export const inventoryProductsRelations = relations(
   inventoryProducts,
   ({ many }) => ({
      movements: many(inventoryMovements),
   }),
);

export const inventoryMovementsRelations = relations(
   inventoryMovements,
   ({ one }) => ({
      product: one(inventoryProducts, {
         fields: [inventoryMovements.productId],
         references: [inventoryProducts.id],
      }),
   }),
);

export const servicesRelations = relations(services, ({ one, many }) => ({
   category: one(categories, {
      fields: [services.categoryId],
      references: [categories.id],
   }),
   tag: one(tags, {
      fields: [services.tagId],
      references: [tags.id],
   }),
   variants: many(serviceVariants),
   resources: many(resources),
}));

export const serviceVariantsRelations = relations(
   serviceVariants,
   ({ one, many }) => ({
      service: one(services, {
         fields: [serviceVariants.serviceId],
         references: [services.id],
      }),
      subscriptions: many(contactSubscriptions),
   }),
);

export const contactSubscriptionsRelations = relations(
   contactSubscriptions,
   ({ one }) => ({
      contact: one(contacts, {
         fields: [contactSubscriptions.contactId],
         references: [contacts.id],
      }),
      variant: one(serviceVariants, {
         fields: [contactSubscriptions.variantId],
         references: [serviceVariants.id],
      }),
   }),
);

export const resourcesRelations = relations(resources, ({ one }) => ({
   service: one(services, {
      fields: [resources.serviceId],
      references: [services.id],
   }),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ many }) => ({
   bills: many(bills),
   transactions: many(transactions, {
      relationName: "sourceAccount",
   }),
   destinationTransactions: many(transactions, {
      relationName: "destinationAccount",
   }),
   creditCards: many(creditCards),
}));

export const creditCardsRelations = relations(creditCards, ({ one, many }) => ({
   bankAccount: one(bankAccounts, {
      fields: [creditCards.bankAccountId],
      references: [bankAccounts.id],
   }),
   statements: many(creditCardStatements),
}));

export const creditCardStatementsRelations = relations(
   creditCardStatements,
   ({ one }) => ({
      creditCard: one(creditCards, {
         fields: [creditCardStatements.creditCardId],
         references: [creditCards.id],
      }),
      bill: one(bills, {
         fields: [creditCardStatements.billId],
         references: [bills.id],
      }),
      paymentTransaction: one(transactions, {
         fields: [creditCardStatements.paymentTransactionId],
         references: [transactions.id],
      }),
   }),
);

export const transactionsRelations = relations(
   transactions,
   ({ one, many }) => ({
      bankAccount: one(bankAccounts, {
         fields: [transactions.bankAccountId],
         references: [bankAccounts.id],
         relationName: "sourceAccount",
      }),
      destinationBankAccount: one(bankAccounts, {
         fields: [transactions.destinationBankAccountId],
         references: [bankAccounts.id],
         relationName: "destinationAccount",
      }),
      creditCard: one(creditCards, {
         fields: [transactions.creditCardId],
         references: [creditCards.id],
      }),
      category: one(categories, {
         fields: [transactions.categoryId],
         references: [categories.id],
      }),
      contact: one(contacts, {
         fields: [transactions.contactId],
         references: [contacts.id],
      }),
      transactionTags: many(transactionTags),
      items: many(transactionItems),
   }),
);

export const transactionTagsRelations = relations(
   transactionTags,
   ({ one }) => ({
      transaction: one(transactions, {
         fields: [transactionTags.transactionId],
         references: [transactions.id],
      }),
      tag: one(tags, {
         fields: [transactionTags.tagId],
         references: [tags.id],
      }),
   }),
);

export const transactionItemsRelations = relations(
   transactionItems,
   ({ one }) => ({
      transaction: one(transactions, {
         fields: [transactionItems.transactionId],
         references: [transactions.id],
      }),
      service: one(services, {
         fields: [transactionItems.serviceId],
         references: [services.id],
      }),
   }),
);

export const webhookEndpointsRelations = relations(
   webhookEndpoints,
   ({ one, many }) => ({
      organization: one(organization, {
         fields: [webhookEndpoints.organizationId],
         references: [organization.id],
      }),
      team: one(team, {
         fields: [webhookEndpoints.teamId],
         references: [team.id],
      }),
      deliveries: many(webhookDeliveries),
   }),
);

export const webhookDeliveriesRelations = relations(
   webhookDeliveries,
   ({ one }) => ({
      webhookEndpoint: one(webhookEndpoints, {
         fields: [webhookDeliveries.webhookEndpointId],
         references: [webhookEndpoints.id],
      }),
      event: one(events, {
         fields: [webhookDeliveries.eventId],
         references: [events.id],
      }),
   }),
);
