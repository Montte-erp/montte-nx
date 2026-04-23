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
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import { coupons, couponRedemptions } from "@core/database/schemas/coupons";
import { creditCards } from "@core/database/schemas/credit-cards";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";
import { dashboards } from "@core/database/schemas/dashboards";
import { events } from "@core/database/schemas/events";
import { insights } from "@core/database/schemas/insights";
import {
   inventoryMovements,
   inventoryProducts,
} from "@core/database/schemas/inventory";
import { meters } from "@core/database/schemas/meters";
import {
   resources,
   services,
   servicePrices,
} from "@core/database/schemas/services";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { tags } from "@core/database/schemas/tags";
import {
   transactionItems,
   transactions,
} from "@core/database/schemas/transactions";
import { usageEvents } from "@core/database/schemas/usage-events";
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

export const metersRelations = relations(meters, ({ many }) => ({
   prices: many(servicePrices),
   usageEvents: many(usageEvents),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
   category: one(categories, {
      fields: [services.categoryId],
      references: [categories.id],
   }),
   tag: one(tags, {
      fields: [services.tagId],
      references: [tags.id],
   }),
   prices: many(servicePrices),
   resources: many(resources),
   serviceBenefits: many(serviceBenefits),
}));

export const servicePricesRelations = relations(
   servicePrices,
   ({ one, many }) => ({
      service: one(services, {
         fields: [servicePrices.serviceId],
         references: [services.id],
      }),
      meter: one(meters, {
         fields: [servicePrices.meterId],
         references: [meters.id],
      }),
      subscriptionItems: many(subscriptionItems),
   }),
);

export const contactSubscriptionsRelations = relations(
   contactSubscriptions,
   ({ one, many }) => ({
      contact: one(contacts, {
         fields: [contactSubscriptions.contactId],
         references: [contacts.id],
      }),
      coupon: one(coupons, {
         fields: [contactSubscriptions.couponId],
         references: [coupons.id],
      }),
      items: many(subscriptionItems),
      redemptions: many(couponRedemptions),
   }),
);

export const subscriptionItemsRelations = relations(
   subscriptionItems,
   ({ one }) => ({
      subscription: one(contactSubscriptions, {
         fields: [subscriptionItems.subscriptionId],
         references: [contactSubscriptions.id],
      }),
      price: one(servicePrices, {
         fields: [subscriptionItems.priceId],
         references: [servicePrices.id],
      }),
   }),
);

export const couponsRelations = relations(coupons, ({ many }) => ({
   redemptions: many(couponRedemptions),
   subscriptions: many(contactSubscriptions),
}));

export const couponRedemptionsRelations = relations(
   couponRedemptions,
   ({ one }) => ({
      coupon: one(coupons, {
         fields: [couponRedemptions.couponId],
         references: [coupons.id],
      }),
      subscription: one(contactSubscriptions, {
         fields: [couponRedemptions.subscriptionId],
         references: [contactSubscriptions.id],
      }),
      contact: one(contacts, {
         fields: [couponRedemptions.contactId],
         references: [contacts.id],
      }),
   }),
);

export const benefitsRelations = relations(benefits, ({ many }) => ({
   serviceBenefits: many(serviceBenefits),
}));

export const serviceBenefitsRelations = relations(
   serviceBenefits,
   ({ one }) => ({
      service: one(services, {
         fields: [serviceBenefits.serviceId],
         references: [services.id],
      }),
      benefit: one(benefits, {
         fields: [serviceBenefits.benefitId],
         references: [benefits.id],
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
      tag: one(tags, {
         fields: [transactions.tagId],
         references: [tags.id],
      }),
      items: many(transactionItems),
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

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
   team: one(team, {
      fields: [usageEvents.teamId],
      references: [team.id],
   }),
   contact: one(contacts, {
      fields: [usageEvents.contactId],
      references: [contacts.id],
   }),
   meter: one(meters, {
      fields: [usageEvents.meterId],
      references: [meters.id],
   }),
}));

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
