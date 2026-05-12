import * as accountRouter from "@modules/account/router/profile";
import * as threadsRouter from "@modules/agents/router/threads";
import * as agentSettingsRouter from "@modules/account/router/agent-settings";
import * as apiKeysRouter from "@modules/account/router/api-keys";
import * as bankAccountsRouter from "@modules/finance/router/bank-accounts";
import * as categoriesRouter from "@modules/classification/router/categories";
import * as categoriesBulkRouter from "@modules/classification/router/categories-bulk";
import * as cnpjRouter from "@modules/account/router/cnpj";
import * as contactSettingsRouter from "@modules/account/router/contact-settings";
import * as contactsRouter from "@modules/billing/router/contacts";
import * as couponsRouter from "@modules/billing/router/coupons";
import * as creditCardsRouter from "@modules/finance/router/credit-cards";
import * as customerPortalRouter from "@modules/billing/router/customer-portal";
import * as financialSettingsRouter from "@modules/account/router/financial-settings";
import * as inboxRouter from "@modules/inbox/router/inbox";
import * as onboardingRouter from "@modules/account/router/onboarding";
import * as organizationRouter from "@modules/account/router/organization";
import * as benefitsRouter from "@modules/billing/router/benefits";
import * as metersRouter from "@modules/billing/router/meters";
import * as pricesRouter from "@modules/billing/router/prices";
import * as servicesRouter from "@modules/billing/router/services";
import * as subscriptionItemsRouter from "@modules/billing/router/subscription-items";
import * as subscriptionsRouter from "@modules/billing/router/subscriptions";
import * as usageRouter from "@modules/billing/router/usage";
import * as sessionRouter from "@modules/account/router/session";
import * as tagsRouter from "@modules/classification/router/tags";
import * as teamRouter from "@modules/account/router/team";
import * as transactionsCrud from "@modules/finance/router/transactions";
import * as transactionsBulk from "@modules/finance/router/transactions-bulk";
import * as transactionsList from "@modules/finance/router/transactions-list";
import * as transactionsStatus from "@modules/finance/router/transactions-status";
import * as transactionsSuggestions from "@modules/finance/router/transactions-suggestions";

const transactionsRouter = {
   ...transactionsCrud,
   ...transactionsBulk,
   ...transactionsList,
   ...transactionsStatus,
   ...transactionsSuggestions,
};

const servicesProcedures = {
   bulkCreate: servicesRouter.bulkCreate,
   bulkRemove: servicesRouter.bulkRemove,
   bulkSetActive: servicesRouter.bulkSetActive,
   create: servicesRouter.create,
   exportAll: servicesRouter.exportAll,
   getAll: servicesRouter.getAll,
   getAllStats: servicesRouter.getAllStats,
   getById: servicesRouter.getById,
   getSubscribers: servicesRouter.getSubscribers,
   remove: servicesRouter.remove,
   setup: servicesRouter.setup,
   update: servicesRouter.update,
};

export default {
   account: accountRouter,
   agentSettings: agentSettingsRouter,
   apiKeys: apiKeysRouter,
   bankAccounts: bankAccountsRouter,
   creditCards: creditCardsRouter,
   categories: categoriesRouter,
   categoriesBulk: categoriesBulkRouter,
   cnpj: cnpjRouter,
   contactSettings: contactSettingsRouter,
   contacts: contactsRouter,
   coupons: couponsRouter,
   customerPortal: customerPortalRouter,
   financialSettings: financialSettingsRouter,
   inbox: inboxRouter,
   onboarding: onboardingRouter,
   prices: pricesRouter,
   services: servicesProcedures,
   subscriptionItems: subscriptionItemsRouter,
   subscriptions: subscriptionsRouter,
   meters: metersRouter,
   benefits: benefitsRouter,
   usage: usageRouter,
   session: sessionRouter,
   tags: tagsRouter,
   team: teamRouter,
   transactions: transactionsRouter,
   organization: organizationRouter,
   threads: {
      create: threadsRouter.create,
      getById: threadsRouter.getById,
      list: threadsRouter.list,
      remove: threadsRouter.remove,
      removeBulk: threadsRouter.removeBulk,
      removeMessage: threadsRouter.removeMessage,
      saveAssistantMessage: threadsRouter.saveAssistantMessage,
      update: threadsRouter.update,
   },
};
