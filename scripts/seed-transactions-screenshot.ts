import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { createDb } from "@core/database/client";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { creditCards } from "@core/database/schemas/credit-cards";
import {
   reports,
   type ReportConfig,
   type ReportType,
} from "@core/database/schemas/reports";
import { parties } from "@core/database/schemas/relationships";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";
import dayjs from "dayjs";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { config } from "dotenv";

const WEB_DIR = path.join(process.cwd(), "apps", "web");
const SEED_DESCRIPTION = "Amostra Montte para screenshot";

const BANK_ACCOUNT_SEEDS = [
   {
      name: "Itaú Empresas",
      type: "checking",
      color: "#1d4ed8",
      bankCode: "341",
      bankName: "Itaú",
      branch: "0001",
      accountNumber: "12345-6",
      initialBalance: "18500.00",
   },
   {
      name: "Nubank PJ",
      type: "payment",
      color: "#7c3aed",
      bankCode: "260",
      bankName: "Nubank",
      branch: "0001",
      accountNumber: "99887-1",
      initialBalance: "8200.00",
   },
   {
      name: "Banco do Brasil",
      type: "checking",
      color: "#ca8a04",
      bankCode: "001",
      bankName: "Banco do Brasil",
      branch: "2044",
      accountNumber: "44210-2",
      initialBalance: "34100.00",
   },
   {
      name: "Aplicações",
      type: "investment",
      color: "#475569",
      bankCode: "033",
      bankName: "Santander",
      branch: "1111",
      accountNumber: "70001-4",
      initialBalance: "50000.00",
   },
   {
      name: "Caixa",
      type: "cash",
      color: "#0f766e",
      initialBalance: "1200.00",
   },
] satisfies (typeof bankAccounts.$inferInsert)[];

const CATEGORY_SEEDS = [
   {
      name: "Prestação de Serviços",
      type: "income",
      color: "#16a34a",
      icon: "briefcase",
   },
   {
      name: "Vendas de Produtos",
      type: "income",
      color: "#059669",
      icon: "package",
   },
   {
      name: "Receita Recorrente",
      type: "income",
      color: "#0d9488",
      icon: "repeat",
   },
   {
      name: "Assinaturas e Ferramentas",
      type: "expense",
      color: "#6366f1",
      icon: "smartphone",
   },
   {
      name: "Marketing",
      type: "expense",
      color: "#f97316",
      icon: "megaphone",
   },
   {
      name: "Impostos",
      type: "expense",
      color: "#dc2626",
      icon: "receipt",
   },
   {
      name: "Pessoal",
      type: "expense",
      color: "#db2777",
      icon: "users",
   },
   {
      name: "Operação",
      type: "expense",
      color: "#64748b",
      icon: "wrench",
   },
   {
      name: "Transferências",
      type: "transfer",
      color: "#0891b2",
      icon: "arrow-left-right",
   },
] satisfies (typeof categories.$inferInsert)[];

const TAG_SEEDS = [
   { name: "Operacional", color: "#2563eb" },
   { name: "Comercial", color: "#f97316" },
   { name: "Administrativo", color: "#64748b" },
   { name: "Diretoria", color: "#9333ea" },
   { name: "Produto", color: "#0d9488" },
] satisfies (typeof tags.$inferInsert)[];

const CREDIT_CARD_SEEDS = [
   {
      name: "Nubank Black",
      color: "#7c3aed",
      creditLimit: "35000.00",
      last4: "1122",
      closingDay: 25,
      dueDay: 5,
      brand: "mastercard",
      account: "Nubank PJ",
   },
   {
      name: "Itaú Corporate",
      color: "#ea580c",
      creditLimit: "50000.00",
      last4: "7788",
      closingDay: 20,
      dueDay: 10,
      brand: "visa",
      account: "Itaú Empresas",
   },
] satisfies (Omit<typeof creditCards.$inferInsert, "bankAccountId"> & {
   account: string;
})[];

const PARTY_SEEDS = [
   {
      role: "customer",
      kind: "company",
      name: "Clínica Aurora",
      documentNumber: "11222333000181",
      email: "financeiro@clinicaaurora.com.br",
   },
   {
      role: "customer",
      kind: "company",
      name: "Oficina Prado",
      documentNumber: "22333444000172",
      email: "contas@oficinaprado.com.br",
   },
   {
      role: "customer",
      kind: "company",
      name: "Mercado Jardim",
      documentNumber: "33444555000163",
      email: "adm@mercadojardim.com.br",
   },
   {
      role: "customer",
      kind: "company",
      name: "Studio Bento",
      documentNumber: "44555666000154",
      email: "financeiro@studiobento.com.br",
   },
   {
      role: "supplier",
      kind: "company",
      name: "AWS Brasil",
      documentNumber: "55666777000145",
      email: "billing@aws.amazon.com",
   },
   {
      role: "supplier",
      kind: "company",
      name: "Meta Ads",
      documentNumber: "66777888000136",
      email: "financeiro@meta.com",
   },
   {
      role: "supplier",
      kind: "company",
      name: "Contabilidade Norte",
      documentNumber: "77888999000127",
      email: "fiscal@contabilnorte.com.br",
   },
   {
      role: "supplier",
      kind: "company",
      name: "Espaço Vila Coworking",
      documentNumber: "88999000000118",
      email: "cobranca@espacovila.com.br",
   },
] satisfies (typeof parties.$inferInsert)[];

type TransactionSeed = {
   name: string;
   type: "income" | "expense" | "transfer";
   amount: string;
   dateOffset: number;
   status: "pending" | "paid" | "cancelled";
   paymentMethod:
      | "pix"
      | "credit_card"
      | "debit_card"
      | "boleto"
      | "cash"
      | "transfer"
      | "automatic_debit";
   account: string;
   destinationAccount?: string;
   category?: string;
   suggestedCategory?: string;
   tag?: string;
   party?: string;
   creditCard?: string;
   ignored?: boolean;
   dueOffset?: number;
   attachment?: boolean;
   installmentGroupId?: string;
   installmentNumber?: number;
   installmentCount?: number;
   recurrenceId?: string;
   recurrenceOccurrenceNumber?: number;
};

type ReportSeed = {
   name: string;
   type: ReportType;
   config: ReportConfig;
};

const customers = [
   "Clínica Aurora",
   "Oficina Prado",
   "Mercado Jardim",
   "Studio Bento",
];
const suppliers = [
   "AWS Brasil",
   "Meta Ads",
   "Contabilidade Norte",
   "Espaço Vila Coworking",
];
const incomeCategories = [
   "Prestação de Serviços",
   "Vendas de Produtos",
   "Receita Recorrente",
];
const expenseCategories = [
   "Assinaturas e Ferramentas",
   "Marketing",
   "Impostos",
   "Pessoal",
   "Operação",
];
const accounts = ["Itaú Empresas", "Nubank PJ", "Banco do Brasil", "Caixa"];
const tagNames = [
   "Operacional",
   "Comercial",
   "Administrativo",
   "Diretoria",
   "Produto",
];
const paymentMethods = [
   "pix",
   "boleto",
   "transfer",
   "credit_card",
   "debit_card",
   "automatic_debit",
   "cash",
] satisfies TransactionSeed["paymentMethod"][];

function money(value: number) {
   return value.toFixed(2);
}

function buildTransactionSeeds(): TransactionSeed[] {
   const seeds: TransactionSeed[] = [];

   for (let index = 0; index < 24; index++) {
      const customer = customers[index % customers.length];
      seeds.push({
         name: `${customer} - Receita ${String(index + 1).padStart(2, "0")}`,
         type: "income",
         amount: money(2200 + index * 315),
         dateOffset: index % 6 === 0 ? 3 + index : -index,
         dueOffset: index % 6 === 0 ? 3 + index : -index,
         status: index % 6 === 0 ? "pending" : "paid",
         paymentMethod: paymentMethods[index % paymentMethods.length],
         account: accounts[index % accounts.length],
         category: incomeCategories[index % incomeCategories.length],
         suggestedCategory:
            index % 9 === 0
               ? incomeCategories[(index + 1) % incomeCategories.length]
               : undefined,
         tag: tagNames[index % tagNames.length],
         party: customer,
         attachment: index % 5 === 0,
      });
   }

   for (let index = 0; index < 30; index++) {
      const supplier = suppliers[index % suppliers.length];
      const paymentMethod = paymentMethods[(index + 2) % paymentMethods.length];
      seeds.push({
         name: `${supplier} - Despesa ${String(index + 1).padStart(2, "0")}`,
         type: "expense",
         amount: money(180 + index * 143.7),
         dateOffset: index % 7 === 0 ? 2 + index : -index - 1,
         dueOffset: index % 7 === 0 ? 2 + index : -index - 1,
         status: index % 7 === 0 ? "pending" : "paid",
         paymentMethod,
         account: accounts[(index + 1) % accounts.length],
         category: expenseCategories[index % expenseCategories.length],
         suggestedCategory:
            index % 8 === 0
               ? expenseCategories[(index + 1) % expenseCategories.length]
               : undefined,
         tag: tagNames[(index + 1) % tagNames.length],
         party: supplier,
         creditCard:
            paymentMethod === "credit_card"
               ? CREDIT_CARD_SEEDS[index % CREDIT_CARD_SEEDS.length]?.name
               : undefined,
         attachment: index % 6 === 0,
      });
   }

   const installmentGroupId = randomUUID();
   for (let installment = 1; installment <= 6; installment++) {
      seeds.push({
         name: `Seguro empresarial ${installment}/6`,
         type: "expense",
         amount: "740.00",
         dateOffset: installment * 30 - 120,
         dueOffset: installment * 30 - 120,
         status: installment <= 3 ? "paid" : "pending",
         paymentMethod: "boleto",
         account: "Itaú Empresas",
         category: "Operação",
         tag: "Administrativo",
         party: "Contabilidade Norte",
         installmentGroupId,
         installmentNumber: installment,
         installmentCount: 6,
      });
   }

   const recurrenceId = randomUUID();
   for (let occurrence = 1; occurrence <= 6; occurrence++) {
      seeds.push({
         name: `Mensalidade coworking ${occurrence}/6`,
         type: "expense",
         amount: "1320.00",
         dateOffset: occurrence * 30 - 150,
         dueOffset: occurrence * 30 - 150,
         status: occurrence <= 4 ? "paid" : "pending",
         paymentMethod: "automatic_debit",
         account: "Banco do Brasil",
         category: "Operação",
         tag: "Administrativo",
         party: "Espaço Vila Coworking",
         recurrenceId,
         recurrenceOccurrenceNumber: occurrence,
      });
   }

   const transferPairs = [
      ["Itaú Empresas", "Aplicações", "Reserva de caixa"],
      ["Nubank PJ", "Itaú Empresas", "Conciliação entre contas"],
      ["Banco do Brasil", "Caixa", "Suprimento de caixa"],
      ["Aplicações", "Banco do Brasil", "Resgate aplicação"],
   ];

   for (const [account, destinationAccount, name] of transferPairs) {
      seeds.push({
         name,
         type: "transfer",
         amount: account === "Aplicações" ? "8500.00" : "3000.00",
         dateOffset: -seeds.length % 18,
         status: "paid",
         paymentMethod: "transfer",
         account,
         destinationAccount,
         category: "Transferências",
         tag: "Diretoria",
      });
   }

   seeds.push(
      {
         name: "Cliente em atraso - Oficina Prado",
         type: "income",
         amount: "2500.00",
         dateOffset: -18,
         dueOffset: -18,
         status: "pending",
         paymentMethod: "boleto",
         account: "Itaú Empresas",
         category: "Prestação de Serviços",
         tag: "Comercial",
         party: "Oficina Prado",
      },
      {
         name: "Nota fiscal cancelada - Studio Bento",
         type: "income",
         amount: "1800.00",
         dateOffset: -9,
         status: "cancelled",
         paymentMethod: "pix",
         account: "Nubank PJ",
         category: "Prestação de Serviços",
         tag: "Comercial",
         party: "Studio Bento",
      },
      {
         name: "Despesa ignorada - Ajuste interno",
         type: "expense",
         amount: "99.90",
         dateOffset: -4,
         status: "paid",
         paymentMethod: "cash",
         account: "Caixa",
         category: "Operação",
         tag: "Administrativo",
         ignored: true,
      },
      {
         name: "Receita ignorada - Duplicidade importada",
         type: "income",
         amount: "980.00",
         dateOffset: -6,
         status: "paid",
         paymentMethod: "pix",
         account: "Itaú Empresas",
         category: "Receita Recorrente",
         tag: "Produto",
         party: "Clínica Aurora",
         ignored: true,
      },
   );

   return seeds;
}

function buildReportSeeds(): ReportSeed[] {
   const currentMonthStart = dayjs().startOf("month").format("YYYY-MM-DD");
   const currentMonthEnd = dayjs().endOf("month").format("YYYY-MM-DD");
   const previousMonthStart = dayjs()
      .subtract(1, "month")
      .startOf("month")
      .format("YYYY-MM-DD");
   const previousMonthEnd = dayjs()
      .subtract(1, "month")
      .endOf("month")
      .format("YYYY-MM-DD");
   const quarterStart = dayjs()
      .subtract(2, "month")
      .startOf("month")
      .format("YYYY-MM-DD");
   const quarterEnd = dayjs().endOf("month").format("YYYY-MM-DD");

   return [
      {
         name: "DRE mensal - demonstração",
         type: "dre",
         config: {
            dateFrom: currentMonthStart,
            dateTo: currentMonthEnd,
            status: "all",
            dreOnly: false,
            agingType: "all",
            agingStatus: "open",
            categoryDepth: "group",
            minAmount: 0,
         },
      },
      {
         name: "Fluxo de caixa trimestral - demonstração",
         type: "cash-flow",
         config: {
            dateFrom: quarterStart,
            dateTo: quarterEnd,
            status: "all",
            dreOnly: true,
            agingType: "all",
            agingStatus: "open",
            categoryDepth: "group",
            minAmount: 0,
         },
      },
      {
         name: "Centro de Custo - despesas abertas",
         type: "cost-centers",
         config: {
            dateFrom: quarterStart,
            dateTo: quarterEnd,
            status: "pending",
            dreOnly: true,
            agingType: "expense",
            agingStatus: "open",
            categoryDepth: "group",
            minAmount: 0,
         },
      },
      {
         name: "A receber e pagar - vencidos",
         type: "aging",
         config: {
            dateFrom: quarterStart,
            dateTo: quarterEnd,
            status: "pending",
            dreOnly: true,
            agingType: "all",
            agingStatus: "overdue",
            categoryDepth: "group",
            minAmount: 0,
         },
      },
      {
         name: "Despesas por categoria - mês anterior",
         type: "categories",
         config: {
            dateFrom: previousMonthStart,
            dateTo: previousMonthEnd,
            status: "all",
            dreOnly: true,
            agingType: "all",
            agingStatus: "open",
            categoryDepth: "group",
            minAmount: 100,
         },
      },
      {
         name: "DRE executivo - últimos 90 dias",
         type: "dre",
         config: {
            dateFrom: dayjs().subtract(90, "day").format("YYYY-MM-DD"),
            dateTo: dayjs().format("YYYY-MM-DD"),
            status: "paid",
            dreOnly: false,
            agingType: "all",
            agingStatus: "settled",
            categoryDepth: "subcategory",
            minAmount: 0,
         },
      },
   ];
}

function getEnvFilePath(env: string) {
   const possibleFiles = [
      `.env.${env}.local`,
      `.env.${env}`,
      ".env.local",
      ".env",
   ];

   for (const file of possibleFiles) {
      const filePath = path.join(WEB_DIR, file);
      if (fs.existsSync(filePath)) return filePath;
   }

   throw new Error(`No environment file found for ${env} in apps/web`);
}

function loadEnv(env: string) {
   const envFile = getEnvFilePath(env);
   config({ path: envFile });
   console.log(`Env: ${envFile}`);
}

type Db = ReturnType<typeof createDb>;

async function resolveTeamId(db: Db) {
   if (process.env.TEAM_ID) return process.env.TEAM_ID;

   const latestTeam = await db.query.team.findFirst({
      orderBy: (fields) => desc(fields.createdAt),
      columns: { id: true, name: true, slug: true },
   });

   if (!latestTeam) {
      throw new Error(
         "Nenhuma equipe encontrada. Crie uma equipe antes do seed.",
      );
   }

   console.log(`Equipe: ${latestTeam.name} (${latestTeam.slug})`);
   return latestTeam.id;
}

async function ensureBankAccount(
   db: Db,
   teamId: string,
   seed: (typeof BANK_ACCOUNT_SEEDS)[number],
) {
   const existing = await db.query.bankAccounts.findFirst({
      where: (fields) =>
         and(eq(fields.teamId, teamId), eq(fields.name, seed.name)),
      columns: { id: true, name: true },
   });

   if (existing) return existing;

   const [created] = await db
      .insert(bankAccounts)
      .values({
         ...seed,
         teamId,
         initialBalanceDate: dayjs().subtract(60, "day").format("YYYY-MM-DD"),
      })
      .returning({ id: bankAccounts.id, name: bankAccounts.name });

   if (!created) throw new Error(`Falha ao criar conta ${seed.name}.`);
   return created;
}

async function ensureCategory(
   db: Db,
   teamId: string,
   seed: (typeof CATEGORY_SEEDS)[number],
) {
   const existing = await db.query.categories.findFirst({
      where: (fields) =>
         and(
            eq(fields.teamId, teamId),
            eq(fields.name, seed.name),
            eq(fields.type, seed.type),
            isNull(fields.parentId),
         ),
      columns: { id: true, name: true },
   });

   if (existing) return existing;

   const [created] = await db
      .insert(categories)
      .values({
         ...seed,
         teamId,
         description: "Categoria criada para demonstração financeira.",
      })
      .returning({ id: categories.id, name: categories.name });

   if (!created) throw new Error(`Falha ao criar categoria ${seed.name}.`);
   return created;
}

async function ensureTag(
   db: Db,
   teamId: string,
   seed: (typeof TAG_SEEDS)[number],
) {
   const existing = await db.query.tags.findFirst({
      where: (fields) =>
         and(eq(fields.teamId, teamId), eq(fields.name, seed.name)),
      columns: { id: true, name: true },
   });

   if (existing) return existing;

   const [created] = await db
      .insert(tags)
      .values({
         ...seed,
         teamId,
         description: "Centro de Custo criado para demonstração.",
      })
      .returning({ id: tags.id, name: tags.name });

   if (!created)
      throw new Error(`Falha ao criar Centro de Custo ${seed.name}.`);
   return created;
}

async function ensureParty(
   db: Db,
   teamId: string,
   seed: (typeof PARTY_SEEDS)[number],
) {
   const existing = await db.query.parties.findFirst({
      where: (fields) =>
         and(
            eq(fields.teamId, teamId),
            eq(fields.role, seed.role),
            eq(fields.documentNumber, seed.documentNumber ?? ""),
         ),
      columns: { id: true, name: true },
   });

   if (existing) return existing;

   const [created] = await db
      .insert(parties)
      .values({ ...seed, teamId })
      .returning({ id: parties.id, name: parties.name });

   if (!created) throw new Error(`Falha ao criar relacionamento ${seed.name}.`);
   return created;
}

async function ensureCreditCard(
   db: Db,
   teamId: string,
   seed: (typeof CREDIT_CARD_SEEDS)[number],
   accountsByName: Map<string, string>,
) {
   const existing = await db.query.creditCards.findFirst({
      where: (fields) =>
         and(eq(fields.teamId, teamId), eq(fields.name, seed.name)),
      columns: { id: true, name: true },
   });

   if (existing) return existing;

   const bankAccountId = accountsByName.get(seed.account);
   if (!bankAccountId) throw new Error(`Conta ${seed.account} não encontrada.`);

   const [created] = await db
      .insert(creditCards)
      .values({
         teamId,
         name: seed.name,
         color: seed.color,
         creditLimit: seed.creditLimit,
         last4: seed.last4,
         closingDay: seed.closingDay,
         dueDay: seed.dueDay,
         brand: seed.brand,
         bankAccountId,
      })
      .returning({ id: creditCards.id, name: creditCards.name });

   if (!created) throw new Error(`Falha ao criar cartão ${seed.name}.`);
   return created;
}

function attachment(seed: TransactionSeed) {
   if (!seed.attachment) return null;

   return [
      {
         url: `https://example.com/comprovantes/${encodeURIComponent(seed.name)}.pdf`,
         filename: `${seed.name}.pdf`,
         size: 148000,
         mimeType: "application/pdf",
      },
   ];
}

async function main() {
   const env = process.env.APP_ENV ?? "local";
   loadEnv(env);

   const databaseUrl = process.env.DATABASE_URL;
   if (!databaseUrl) throw new Error("DATABASE_URL não definido.");

   const db = createDb({ databaseUrl, max: 4 });
   const teamId = await resolveTeamId(db);

   const accountRows = [];
   for (const seed of BANK_ACCOUNT_SEEDS) {
      accountRows.push(await ensureBankAccount(db, teamId, seed));
   }

   const accountsByName = new Map(accountRows.map((row) => [row.name, row.id]));

   const categoryRows = [];
   for (const seed of CATEGORY_SEEDS) {
      categoryRows.push(await ensureCategory(db, teamId, seed));
   }

   const tagRows = [];
   for (const seed of TAG_SEEDS) {
      tagRows.push(await ensureTag(db, teamId, seed));
   }

   const partyRows = [];
   for (const seed of PARTY_SEEDS) {
      partyRows.push(await ensureParty(db, teamId, seed));
   }

   const creditCardRows = [];
   for (const seed of CREDIT_CARD_SEEDS) {
      creditCardRows.push(
         await ensureCreditCard(db, teamId, seed, accountsByName),
      );
   }

   const categoriesByName = new Map(
      categoryRows.map((row) => [row.name, row.id]),
   );
   const tagsByName = new Map(tagRows.map((row) => [row.name, row.id]));
   const partiesByName = new Map(partyRows.map((row) => [row.name, row.id]));
   const creditCardsByName = new Map(
      creditCardRows.map((row) => [row.name, row.id]),
   );
   const transactionSeeds = buildTransactionSeeds();
   const reportSeeds = buildReportSeeds();

   await db.transaction(async (tx) => {
      await tx
         .delete(transactions)
         .where(
            and(
               eq(transactions.teamId, teamId),
               eq(transactions.description, SEED_DESCRIPTION),
            ),
         );

      await tx.insert(transactions).values(
         transactionSeeds.map((seed) => {
            const date = dayjs()
               .add(seed.dateOffset, "day")
               .format("YYYY-MM-DD");
            const dueDate = dayjs()
               .add(seed.dueOffset ?? seed.dateOffset, "day")
               .format("YYYY-MM-DD");
            const isPaid = seed.status === "paid";

            return {
               teamId,
               name: seed.name,
               type: seed.type,
               amount: seed.amount,
               description: SEED_DESCRIPTION,
               date,
               dueDate: isPaid ? null : dueDate,
               status: seed.status,
               ignored: seed.ignored ?? false,
               paidAt: isPaid ? dayjs(date).hour(10).toDate() : null,
               paymentMethod: seed.paymentMethod,
               bankAccountId: accountsByName.get(seed.account),
               destinationBankAccountId: seed.destinationAccount
                  ? accountsByName.get(seed.destinationAccount)
                  : null,
               categoryId: seed.category
                  ? categoriesByName.get(seed.category)
                  : null,
               suggestedCategoryId: seed.suggestedCategory
                  ? categoriesByName.get(seed.suggestedCategory)
                  : null,
               tagId: seed.tag ? tagsByName.get(seed.tag) : null,
               relationshipId: seed.party
                  ? partiesByName.get(seed.party)
                  : null,
               creditCardId: seed.creditCard
                  ? creditCardsByName.get(seed.creditCard)
                  : null,
               attachments: attachment(seed),
               installmentGroupId: seed.installmentGroupId,
               installmentNumber: seed.installmentNumber,
               installmentCount: seed.installmentCount,
               recurrenceId: seed.recurrenceId,
               recurrenceOccurrenceNumber: seed.recurrenceOccurrenceNumber,
            };
         }),
      );

      await tx.delete(reports).where(
         and(
            eq(reports.teamId, teamId),
            inArray(
               reports.name,
               reportSeeds.map((seed) => seed.name),
            ),
         ),
      );

      await tx.insert(reports).values(
         reportSeeds.map((seed) => ({
            teamId,
            name: seed.name,
            type: seed.type,
            source: "manual",
            config: seed.config,
         })),
      );
   });

   console.log(
      `Seed concluído: ${transactionSeeds.length} lançamentos, ${reportSeeds.length} relatórios, ${accountRows.length} contas, ${creditCardRows.length} cartões, ${categoryRows.length} categorias, ${tagRows.length} Centros de Custo e ${partyRows.length} relacionamentos.`,
   );
   process.exit(0);
}

main().catch((error: unknown) => {
   console.error(error);
   process.exit(1);
});
