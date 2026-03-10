import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
   // -------------------------------------------------------------------------
   // Auth
   // -------------------------------------------------------------------------
   user: {
      sessions: r.many.session(),
      accounts: r.many.account(),
      teamMembers: r.many.teamMember(),
      members: r.many.member(),
      invitations: r.many.invitation(),
      twoFactors: r.many.twoFactor(),
      oauthClients: r.many.oauthClient(),
      oauthRefreshTokens: r.many.oauthRefreshToken(),
      oauthAccessTokens: r.many.oauthAccessToken(),
      oauthConsents: r.many.oauthConsent(),
   },

   session: {
      user: r.one.user({
         from: r.session.userId,
         to: r.user.id,
      }),
      oauthRefreshTokens: r.many.oauthRefreshToken(),
      oauthAccessTokens: r.many.oauthAccessToken(),
   },

   account: {
      user: r.one.user({
         from: r.account.userId,
         to: r.user.id,
      }),
   },

   organization: {
      teams: r.many.team(),
      members: r.many.member(),
      invitations: r.many.invitation(),
   },

   team: {
      organization: r.one.organization({
         from: r.team.organizationId,
         to: r.organization.id,
      }),
      teamMembers: r.many.teamMember(),
   },

   teamMember: {
      team: r.one.team({
         from: r.teamMember.teamId,
         to: r.team.id,
      }),
      user: r.one.user({
         from: r.teamMember.userId,
         to: r.user.id,
      }),
   },

   member: {
      organization: r.one.organization({
         from: r.member.organizationId,
         to: r.organization.id,
      }),
      user: r.one.user({
         from: r.member.userId,
         to: r.user.id,
      }),
   },

   invitation: {
      organization: r.one.organization({
         from: r.invitation.organizationId,
         to: r.organization.id,
      }),
      user: r.one.user({
         from: r.invitation.inviterId,
         to: r.user.id,
      }),
   },

   twoFactor: {
      user: r.one.user({
         from: r.twoFactor.userId,
         to: r.user.id,
      }),
   },

   oauthClient: {
      user: r.one.user({
         from: r.oauthClient.userId,
         to: r.user.id,
      }),
      oauthRefreshTokens: r.many.oauthRefreshToken(),
      oauthAccessTokens: r.many.oauthAccessToken(),
      oauthConsents: r.many.oauthConsent(),
   },

   oauthRefreshToken: {
      oauthClient: r.one.oauthClient({
         from: r.oauthRefreshToken.clientId,
         to: r.oauthClient.clientId,
      }),
      session: r.one.session({
         from: r.oauthRefreshToken.sessionId,
         to: r.session.id,
      }),
      user: r.one.user({
         from: r.oauthRefreshToken.userId,
         to: r.user.id,
      }),
      oauthAccessTokens: r.many.oauthAccessToken(),
   },

   oauthAccessToken: {
      oauthClient: r.one.oauthClient({
         from: r.oauthAccessToken.clientId,
         to: r.oauthClient.clientId,
      }),
      session: r.one.session({
         from: r.oauthAccessToken.sessionId,
         to: r.session.id,
      }),
      user: r.one.user({
         from: r.oauthAccessToken.userId,
         to: r.user.id,
      }),
      oauthRefreshToken: r.one.oauthRefreshToken({
         from: r.oauthAccessToken.refreshId,
         to: r.oauthRefreshToken.id,
      }),
   },

   oauthConsent: {
      oauthClient: r.one.oauthClient({
         from: r.oauthConsent.clientId,
         to: r.oauthClient.clientId,
      }),
      user: r.one.user({
         from: r.oauthConsent.userId,
         to: r.user.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Actions
   // -------------------------------------------------------------------------
   actions: {
      organization: r.one.organization({
         from: r.actions.organizationId,
         to: r.organization.id,
      }),
      createdByUser: r.one.user({
         from: r.actions.createdBy,
         to: r.user.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Activity Logs
   // -------------------------------------------------------------------------
   activityLogs: {
      organization: r.one.organization({
         from: r.activityLogs.organizationId,
         to: r.organization.id,
      }),
      team: r.one.team({
         from: r.activityLogs.teamId,
         to: r.team.id,
      }),
      user: r.one.user({
         from: r.activityLogs.userId,
         to: r.user.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Addons
   // -------------------------------------------------------------------------
   organizationAddons: {
      organization: r.one.organization({
         from: r.organizationAddons.organizationId,
         to: r.organization.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Annotations
   // -------------------------------------------------------------------------
   annotations: {
      organization: r.one.organization({
         from: r.annotations.organizationId,
         to: r.organization.id,
      }),
      createdByUser: r.one.user({
         from: r.annotations.createdBy,
         to: r.user.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Assets
   // -------------------------------------------------------------------------
   assets: {
      organization: r.one.organization({
         from: r.assets.organizationId,
         to: r.organization.id,
      }),
      team: r.one.team({
         from: r.assets.teamId,
         to: r.team.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Bills
   // -------------------------------------------------------------------------
   bills: {
      bankAccount: r.one.bankAccounts({
         from: r.bills.bankAccountId,
         to: r.bankAccounts.id,
      }),
      category: r.one.categories({
         from: r.bills.categoryId,
         to: r.categories.id,
      }),
      transaction: r.one.transactions({
         from: r.bills.transactionId,
         to: r.transactions.id,
      }),
      recurrenceSetting: r.one.recurrenceSettings({
         from: r.bills.recurrenceGroupId,
         to: r.recurrenceSettings.id,
      }),
   },

   recurrenceSettings: {
      bills: r.many.bills(),
   },

   // -------------------------------------------------------------------------
   // Budget Goals
   // -------------------------------------------------------------------------
   budgetGoals: {
      category: r.one.categories({
         from: r.budgetGoals.categoryId,
         to: r.categories.id,
      }),
      subcategory: r.one.subcategories({
         from: r.budgetGoals.subcategoryId,
         to: r.subcategories.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Categories & Subcategories
   // -------------------------------------------------------------------------
   categories: {
      subcategories: r.many.subcategories(),
   },

   subcategories: {
      category: r.one.categories({
         from: r.subcategories.categoryId,
         to: r.categories.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Contacts
   // -------------------------------------------------------------------------
   contacts: {
      transactions: r.many.transactions(),
   },

   // -------------------------------------------------------------------------
   // Dashboards
   // -------------------------------------------------------------------------
   dashboards: {
      organization: r.one.organization({
         from: r.dashboards.organizationId,
         to: r.organization.id,
      }),
      team: r.one.team({
         from: r.dashboards.teamId,
         to: r.team.id,
      }),
      createdByUser: r.one.user({
         from: r.dashboards.createdBy,
         to: r.user.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Data Sources
   // -------------------------------------------------------------------------
   dataSources: {
      organization: r.one.organization({
         from: r.dataSources.organizationId,
         to: r.organization.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Discussions
   // -------------------------------------------------------------------------
   discussions: {
      replies: r.many.discussionReplies(),
   },

   discussionReplies: {
      discussion: r.one.discussions({
         from: r.discussionReplies.discussionId,
         to: r.discussions.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Events
   // -------------------------------------------------------------------------
   events: {
      organization: r.one.organization({
         from: r.events.organizationId,
         to: r.organization.id,
      }),
      user: r.one.user({
         from: r.events.userId,
         to: r.user.id,
      }),
      team: r.one.team({
         from: r.events.teamId,
         to: r.team.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Export Log
   // -------------------------------------------------------------------------
   exportLog: {
      member: r.one.member({
         from: r.exportLog.memberId,
         to: r.member.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Insights
   // -------------------------------------------------------------------------
   insights: {
      organization: r.one.organization({
         from: r.insights.organizationId,
         to: r.organization.id,
      }),
      team: r.one.team({
         from: r.insights.teamId,
         to: r.team.id,
      }),
      createdByUser: r.one.user({
         from: r.insights.createdBy,
         to: r.user.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Inventory
   // -------------------------------------------------------------------------
   inventoryProducts: {
      movements: r.many.inventoryMovements(),
   },

   inventoryMovements: {
      product: r.one.inventoryProducts({
         from: r.inventoryMovements.productId,
         to: r.inventoryProducts.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Personal API Key
   // -------------------------------------------------------------------------
   personalApiKey: {
      user: r.one.user({
         from: r.personalApiKey.userId,
         to: r.user.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Product Settings
   // -------------------------------------------------------------------------
   productSettings: {
      team: r.one.team({
         from: r.productSettings.teamId,
         to: r.team.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Property Definitions
   // -------------------------------------------------------------------------
   propertyDefinitions: {
      organization: r.one.organization({
         from: r.propertyDefinitions.organizationId,
         to: r.organization.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Resource Permissions
   // -------------------------------------------------------------------------
   resourcePermission: {
      organization: r.one.organization({
         from: r.resourcePermission.organizationId,
         to: r.organization.id,
      }),
      grantedByUser: r.one.user({
         from: r.resourcePermission.grantedBy,
         to: r.user.id,
         alias: "grantedByUser",
      }),
      granteeUser: r.one.user({
         from: r.resourcePermission.granteeId,
         to: r.user.id,
         alias: "granteeUser",
      }),
      granteeTeam: r.one.team({
         from: r.resourcePermission.granteeId,
         to: r.team.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Roles
   // -------------------------------------------------------------------------
   customRoles: {
      organization: r.one.organization({
         from: r.customRoles.organizationId,
         to: r.organization.id,
      }),
      memberRoles: r.many.memberRoles(),
   },

   memberRoles: {
      member: r.one.member({
         from: r.memberRoles.memberId,
         to: r.member.id,
      }),
      role: r.one.customRoles({
         from: r.memberRoles.roleId,
         to: r.customRoles.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Services
   // -------------------------------------------------------------------------
   services: {
      category: r.one.categories({
         from: r.services.categoryId,
         to: r.categories.id,
      }),
      tag: r.one.tags({
         from: r.services.tagId,
         to: r.tags.id,
      }),
      variants: r.many.serviceVariants(),
      resources: r.many.resources(),
   },

   serviceVariants: {
      service: r.one.services({
         from: r.serviceVariants.serviceId,
         to: r.services.id,
      }),
      subscriptions: r.many.contactSubscriptions(),
   },

   contactSubscriptions: {
      contact: r.one.contacts({
         from: r.contactSubscriptions.contactId,
         to: r.contacts.id,
      }),
      variant: r.one.serviceVariants({
         from: r.contactSubscriptions.variantId,
         to: r.serviceVariants.id,
      }),
      resource: r.one.resources({
         from: r.contactSubscriptions.resourceId,
         to: r.resources.id,
      }),
   },

   resources: {
      service: r.one.services({
         from: r.resources.serviceId,
         to: r.services.id,
      }),
      subscriptions: r.many.contactSubscriptions(),
   },

   // -------------------------------------------------------------------------
   // SSO
   // -------------------------------------------------------------------------
   verifiedDomains: {
      organization: r.one.organization({
         from: r.verifiedDomains.organizationId,
         to: r.organization.id,
      }),
   },

   ssoConfigurations: {
      organization: r.one.organization({
         from: r.ssoConfigurations.organizationId,
         to: r.organization.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Transactions
   // -------------------------------------------------------------------------
   transactions: {
      bankAccount: r.one.bankAccounts({
         from: r.transactions.bankAccountId,
         to: r.bankAccounts.id,
         alias: "sourceAccount",
      }),
      destinationBankAccount: r.one.bankAccounts({
         from: r.transactions.destinationBankAccountId,
         to: r.bankAccounts.id,
         alias: "destinationAccount",
      }),
      creditCard: r.one.creditCards({
         from: r.transactions.creditCardId,
         to: r.creditCards.id,
      }),
      category: r.one.categories({
         from: r.transactions.categoryId,
         to: r.categories.id,
      }),
      subcategory: r.one.subcategories({
         from: r.transactions.subcategoryId,
         to: r.subcategories.id,
      }),
      transactionTags: r.many.transactionTags(),
      items: r.many.transactionItems(),
      contact: r.one.contacts({
         from: r.transactions.contactId,
         to: r.contacts.id,
      }),
   },

   transactionTags: {
      transaction: r.one.transactions({
         from: r.transactionTags.transactionId,
         to: r.transactions.id,
      }),
      tag: r.one.tags({
         from: r.transactionTags.tagId,
         to: r.tags.id,
      }),
   },

   transactionItems: {
      transaction: r.one.transactions({
         from: r.transactionItems.transactionId,
         to: r.transactions.id,
      }),
      service: r.one.services({
         from: r.transactionItems.serviceId,
         to: r.services.id,
      }),
   },

   // -------------------------------------------------------------------------
   // Webhooks
   // -------------------------------------------------------------------------
   webhookEndpoints: {
      organization: r.one.organization({
         from: r.webhookEndpoints.organizationId,
         to: r.organization.id,
      }),
      team: r.one.team({
         from: r.webhookEndpoints.teamId,
         to: r.team.id,
      }),
      deliveries: r.many.webhookDeliveries(),
   },

   webhookDeliveries: {
      webhookEndpoint: r.one.webhookEndpoints({
         from: r.webhookDeliveries.webhookEndpointId,
         to: r.webhookEndpoints.id,
      }),
      event: r.one.events({
         from: r.webhookDeliveries.eventId,
         to: r.events.id,
      }),
   },
}));
