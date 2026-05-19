import { createRouterClient } from "@orpc/server";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import * as statementsRouter from "@modules/cards/router/statements";
import * as creditCardsRouter from "@modules/cards/router/credit-cards";
import * as bankAccountsRouter from "@modules/cashbook/router/bank-accounts";
import * as transactionsListRouter from "@modules/cashbook/router/transactions-list";
import * as categoriesRouter from "@modules/classification/router/categories";
import * as tagsRouter from "@modules/classification/router/tags";
import * as reportsRouter from "@modules/insights/router/reports";
import { buildCashbookReadTools } from "@modules/agents/tools/cashbook";
import { buildCardsReadTools } from "@modules/agents/tools/cards";
import { buildClassificationReadTools } from "@modules/agents/tools/classification";
import { buildReportReadTools } from "@modules/agents/tools/reports";

export interface AgentReadToolDeps {
   context: ORPCContextWithOrganization;
}

export function createAgentReadClient(context: ORPCContextWithOrganization) {
   return createRouterClient(
      {
         bankAccounts: {
            getAll: bankAccountsRouter.getAll,
            list: bankAccountsRouter.list,
         },
         categories: {
            getAll: categoriesRouter.getAll,
            getPaginated: categoriesRouter.getPaginated,
         },
         creditCards: {
            getAll: creditCardsRouter.getAll,
         },
         reports: {
            profitAndLoss: reportsRouter.profitAndLoss,
            cashFlow: reportsRouter.cashFlow,
            expensesByCostCenter: reportsRouter.expensesByCostCenter,
            expensesByCategory: reportsRouter.expensesByCategory,
            aging: reportsRouter.aging,
         },
         statements: {
            getAll: statementsRouter.getAll,
         },
         tags: {
            getAll: tagsRouter.getAll,
         },
         transactions: {
            getAll: transactionsListRouter.getAll,
            getSummary: transactionsListRouter.getSummary,
         },
      },
      { context },
   );
}

export type AgentReadClient = ReturnType<typeof createAgentReadClient>;

export function buildAgentReadTools(deps: AgentReadToolDeps) {
   const client = createAgentReadClient(deps.context);
   return [
      ...buildCashbookReadTools({ client }),
      ...buildClassificationReadTools({ client }),
      ...buildCardsReadTools({ client }),
      ...buildReportReadTools({ client }),
   ];
}
