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
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import { creditCards } from "@core/database/schemas/credit-cards";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";
import { meters } from "@core/database/schemas/meters";
import { tags } from "@core/database/schemas/tags";
import {
   transactionRecurrences,
   transactionItems,
   transactions,
} from "@core/database/schemas/transactions";
import { usageEvents } from "@core/database/schemas/usage-events";

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
}));

export const metersRelations = relations(meters, ({ many }) => ({
   usageEvents: many(usageEvents),
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
      recurrence: one(transactionRecurrences, {
         fields: [transactions.recurrenceId],
         references: [transactionRecurrences.id],
         relationName: "transaction_recurrence",
      }),
      items: many(transactionItems),
   }),
);

export const transactionRecurrencesRelations = relations(
   transactionRecurrences,
   ({ one, many }) => ({
      sourceTransaction: one(transactions, {
         fields: [transactionRecurrences.sourceTransactionId],
         references: [transactions.id],
         relationName: "source_transaction_recurrence",
      }),
      transactions: many(transactions),
   }),
);

export const transactionItemsRelations = relations(
   transactionItems,
   ({ one }) => ({
      transaction: one(transactions, {
         fields: [transactionItems.transactionId],
         references: [transactions.id],
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
