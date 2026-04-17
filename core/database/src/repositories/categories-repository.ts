import dayjs from "dayjs";
import { AppError, validateInput } from "@core/logging/errors";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { fromPromise, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateCategoryInput,
   type UpdateCategoryInput,
   categories,
   createCategorySchema,
   updateCategorySchema,
} from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";

type Category = typeof categories.$inferSelect;

type CategorySeed = {
   name: string;
   type: "income" | "expense";
   icon?: string;
   color?: string;
   description?: string;
   keywords?: string[];
   children?: Array<{
      name: string;
      icon?: string;
      description?: string;
      keywords?: string[];
   }>;
};

const EMPRESARIAL_CATEGORIES: CategorySeed[] = [
   {
      name: "Vendas",
      type: "income",
      icon: "briefcase",
      color: "#22c55e",
      description:
         "Receitas provenientes da venda de produtos e serviços da empresa.",
      keywords: [
         "recebimento de cliente",
         "pagamento de cliente",
         "PIX recebido",
         "depósito de cliente",
         "nota fiscal",
         "NF",
         "fatura recebida",
         "venda",
         "receita de venda",
      ],
      children: [
         {
            name: "Produtos",
            icon: "package",
            description:
               "Receitas de vendas de mercadorias e produtos físicos ou digitais.",
            keywords: [
               "venda de produto",
               "venda de mercadoria",
               "NF produto",
               "nota fiscal produto",
               "Mercado Livre",
               "Shopee",
               "Shopify",
               "e-commerce",
               "loja virtual",
               "marketplace",
               "pedido",
               "frete recebido",
            ],
         },
         {
            name: "Serviços",
            icon: "briefcase",
            description: "Receitas de prestação de serviços aos clientes.",
            keywords: [
               "prestação de serviço",
               "NFS-e",
               "nota fiscal serviço",
               "honorários recebidos",
               "consultoria recebida",
               "contrato de serviço",
               "projeto",
               "recebimento de serviço",
            ],
         },
      ],
   },
   {
      name: "Outras Receitas",
      type: "income",
      icon: "wallet",
      color: "#14b8a6",
      description:
         "Receitas não operacionais ou diversas que não se enquadram em vendas.",
      keywords: [
         "rendimento de aplicação",
         "juros recebidos",
         "CDB",
         "LCI",
         "LCA",
         "poupança",
         "dividendos",
         "aluguel recebido",
         "receita financeira",
         "reembolso recebido",
         "devolução recebida",
         "comissão recebida",
         "bonificação recebida",
      ],
   },
   {
      name: "Custos",
      type: "expense",
      icon: "shopping-cart",
      color: "#ef4444",
      description:
         "Custos diretos relacionados à produção ou entrega dos produtos e serviços.",
      keywords: [
         "custo de produção",
         "compra para revenda",
         "insumo",
         "matéria-prima",
         "nota fiscal compra",
         "NF compra",
         "fornecedor",
      ],
      children: [
         {
            name: "CMV",
            icon: "package",
            description:
               "Custo das Mercadorias Vendidas — valor dos produtos vendidos.",
            keywords: [
               "compra de mercadoria",
               "reposição de estoque",
               "compra de produto",
               "nota fiscal de compra",
               "NF de compra",
               "fornecedor produto",
               "atacado",
               "distribuidora",
               "importação",
               "custo de mercadoria",
            ],
         },
         {
            name: "Serviços de Terceiros",
            icon: "briefcase",
            description:
               "Custos com contratação de terceiros para execução de serviços.",
            keywords: [
               "freelancer",
               "autônomo",
               "RPA",
               "recibo de pagamento autônomo",
               "subcontratado",
               "terceirização",
               "nota fiscal serviço pago",
               "contrato terceiro",
               "prestador de serviço",
            ],
         },
      ],
   },
   {
      name: "Despesas Operacionais",
      type: "expense",
      icon: "briefcase",
      color: "#f97316",
      description:
         "Despesas recorrentes necessárias para o funcionamento da operação.",
      keywords: [
         "despesa operacional",
         "custeio",
         "despesa fixa",
         "despesa variável",
      ],
      children: [
         {
            name: "Administrativo",
            icon: "briefcase",
            description:
               "Despesas com atividades administrativas e de gestão da empresa.",
            keywords: [
               "aluguel",
               "condomínio",
               "energia elétrica",
               "água",
               "luz",
               "IPTU",
               "limpeza",
               "manutenção",
               "material de escritório",
               "correios",
               "contador",
               "contabilidade",
               "jurídico",
               "advogado",
               "seguro",
               "telefone fixo",
               "despesa administrativa",
            ],
         },
         {
            name: "Comercial",
            icon: "shopping-cart",
            description:
               "Despesas com atividades comerciais, vendas e atendimento ao cliente.",
            keywords: [
               "comissão de vendas",
               "representante comercial",
               "frete de venda",
               "logística",
               "entrega",
               "Correios",
               "transportadora",
               "embalagem",
               "comissionamento",
            ],
         },
         {
            name: "Marketing",
            icon: "gift",
            description:
               "Despesas com marketing, publicidade e divulgação da empresa.",
            keywords: [
               "Google Ads",
               "Meta Ads",
               "Facebook Ads",
               "Instagram",
               "agência de marketing",
               "publicidade",
               "propaganda",
               "impulsionamento",
               "influenciador",
               "criação de conteúdo",
               "design gráfico",
               "panfleto",
               "brinde",
               "patrocínio",
            ],
         },
      ],
   },
   {
      name: "Pessoal",
      type: "expense",
      icon: "heart",
      color: "#ec4899",
      description:
         "Despesas com colaboradores, folha de pagamento e encargos trabalhistas.",
      keywords: [
         "salário",
         "folha de pagamento",
         "pro-labore",
         "pró-labore",
         "FGTS",
         "INSS patronal",
         "GPS",
         "férias",
         "13º salário",
         "décimo terceiro",
         "rescisão",
         "vale transporte",
         "vale refeição",
         "plano de saúde",
         "benefícios",
         "holerite",
         "funcionário",
         "colaborador",
         "encargos trabalhistas",
         "eSocial",
      ],
   },
   {
      name: "Impostos",
      type: "expense",
      icon: "wallet",
      color: "#f59e0b",
      description:
         "Tributos e impostos pagos ao governo federal, estadual e municipal.",
      keywords: [
         "DAS",
         "Simples Nacional",
         "DARF",
         "IRPJ",
         "CSLL",
         "PIS",
         "COFINS",
         "ISS",
         "ICMS",
         "IOF",
         "guia de imposto",
         "recolhimento de tributo",
         "pagamento INSS",
         "contribuição previdenciária",
         "nota de débito fiscal",
         "imposto federal",
         "imposto estadual",
         "imposto municipal",
      ],
   },
   {
      name: "Tarifas Bancárias",
      type: "expense",
      icon: "credit-card",
      color: "#78716c",
      description: "Tarifas e taxas cobradas por instituições financeiras.",
      keywords: [
         "tarifa bancária",
         "taxa de manutenção de conta",
         "anuidade de cartão",
         "taxa de TED",
         "taxa de DOC",
         "tarifa de transferência",
         "tarifa de boleto",
         "taxa de saque",
         "encargo bancário",
         "cobrança bancária",
         "pacote de serviços bancários",
         "IOF operação financeira",
         "taxa de câmbio",
         "multa bancária",
      ],
   },
   {
      name: "Tecnologia",
      type: "expense",
      icon: "smartphone",
      color: "#6366f1",
      description:
         "Despesas com software, hardware, internet e infraestrutura tecnológica.",
      keywords: [
         "assinatura de software",
         "SaaS",
         "licença de software",
         "AWS",
         "Google Cloud",
         "Azure",
         "hospedagem",
         "domínio",
         "internet",
         "provedor de internet",
         "celular corporativo",
         "computador",
         "notebook",
         "equipamento de TI",
         "suporte técnico",
         "Adobe",
         "Microsoft 365",
         "antivírus",
         "backup",
      ],
   },
   {
      name: "Transferências",
      type: "expense",
      icon: "zap",
      color: "#06b6d4",
      description: "Movimentações entre contas e transferências internas.",
      keywords: [
         "transferência entre contas",
         "TED própria",
         "PIX entre contas",
         "movimentação interna",
         "aporte de caixa",
         "retirada de caixa",
         "sangria",
         "suprimento de caixa",
      ],
   },
];

export function createCategory(
   db: DatabaseInstance,
   teamId: string,
   data: CreateCategoryInput,
) {
   return fromPromise(
      (async () => {
         const validated = validateInput(createCategorySchema, data);
         let level = 1;
         let type = validated.type;

         if (validated.parentId) {
            const parentId = validated.parentId;
            const parent = await db.query.categories.findFirst({
               where: (fields, { eq }) => eq(fields.id, parentId),
            });
            if (!parent)
               throw AppError.notFound("Categoria pai não encontrada.");
            if (parent.level >= 3) {
               throw AppError.validation("Limite de 3 níveis atingido.");
            }
            level = parent.level + 1;
            type = parent.type;
         }

         if (validated.keywords?.length) {
            const vResult = await validateKeywordsUniqueness(
               db,
               teamId,
               validated.keywords,
            );
            if (vResult.isErr()) throw vResult.error;
         }

         const [category] = await db
            .insert(categories)
            .values({
               ...validated,
               teamId,
               level,
               type,
            })
            .returning();
         if (!category) throw AppError.database("Failed to create category");
         return category;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to create category", { cause: e }),
   );
}

type SubcategoryInput = { name: string };
type CreateWithSubsInput = CreateCategoryInput & {
   subcategories?: SubcategoryInput[];
};

export function createCategoryWithSubcategories(
   db: DatabaseInstance,
   teamId: string,
   data: CreateWithSubsInput,
) {
   const { subcategories, ...catData } = data;
   return fromPromise(
      db.transaction(async (tx) => {
         const createdResult = await createCategory(tx, teamId, catData);
         if (createdResult.isErr()) throw createdResult.error;
         const category = createdResult.value;
         const subs: Category[] = [];
         if (subcategories && subcategories.length > 0) {
            for (const sub of subcategories) {
               const subResult = await createCategory(tx, teamId, {
                  name: sub.name,
                  type: catData.type,
                  parentId: category.id,
                  participatesDre: false,
               });
               if (subResult.isErr()) throw subResult.error;
               subs.push(subResult.value);
            }
         }
         return { category, subcategories: subs };
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database(
                 "Failed to create category with subcategories",
                 { cause: e },
              ),
   );
}

type ImportBatchItem = CreateCategoryInput & {
   subcategories?: Array<{ name: string; keywords?: string[] | null }>;
};

export function importCategoriesBatch(
   db: DatabaseInstance,
   teamId: string,
   items: ImportBatchItem[],
) {
   return fromPromise(
      db.transaction(async (tx) => {
         const all: Category[] = [];
         const parents: Category[] = [];
         for (const item of items) {
            const { subcategories, ...catData } = item;
            const catResult = await createCategory(tx, teamId, catData);
            if (catResult.isErr()) throw catResult.error;
            const created = catResult.value;
            parents.push(created);
            all.push(created);
            if (subcategories && subcategories.length > 0) {
               for (const sub of subcategories) {
                  const subResult = await createCategory(tx, teamId, {
                     name: sub.name,
                     type: catData.type,
                     parentId: created.id,
                     participatesDre: false,
                     keywords: sub.keywords ?? null,
                  });
                  if (subResult.isErr()) throw subResult.error;
                  all.push(subResult.value);
               }
            }
         }
         return { all, parents };
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to import categories batch", {
                 cause: e,
              }),
   );
}

export function seedEmpresarialCategories(
   db: DatabaseInstance,
   teamId: string,
) {
   return fromPromise(
      (async () => {
         for (const root of EMPRESARIAL_CATEGORIES) {
            const [parent] = await db
               .insert(categories)
               .values({
                  teamId,
                  name: root.name,
                  type: root.type,
                  icon: root.icon ?? null,
                  color: root.color ?? null,
                  description: root.description ?? null,
                  keywords: root.keywords ?? null,
                  level: 1,
                  isDefault: true,
               })
               .returning();
            if (!parent) throw AppError.database("Failed to seed category");

            if (root.children?.length) {
               await db.insert(categories).values(
                  root.children.map((child) => ({
                     teamId,
                     name: child.name,
                     type: root.type,
                     icon: child.icon ?? null,
                     description: child.description ?? null,
                     keywords: child.keywords ?? null,
                     parentId: parent.id,
                     level: 2,
                     isDefault: true,
                  })),
               );
            }
         }
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to seed empresarial categories", {
                 cause: e,
              }),
   );
}

export function listCategories(
   db: DatabaseInstance,
   teamId: string,
   opts?: {
      type?: "income" | "expense";
      includeArchived?: boolean;
   },
) {
   return fromPromise(
      (async () => {
         const conditions: SQL[] = [eq(categories.teamId, teamId)];

         if (opts?.type) {
            conditions.push(eq(categories.type, opts.type));
         }
         if (!opts?.includeArchived) {
            conditions.push(eq(categories.isArchived, false));
         }

         return await db.query.categories.findMany({
            where: and(...conditions),
            orderBy: (fields, { asc }) => [asc(fields.name)],
         });
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to list categories", { cause: e }),
   );
}

export function ensureCategoryOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getCategory(db, id).andThen((category) => {
      if (!category || category.teamId !== teamId)
         return err(AppError.notFound("Categoria não encontrada."));
      return ok(category);
   });
}

export function getCategory(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.categories.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to get category", { cause: e }),
   ).map((category) => category ?? null);
}

export function updateCategory(
   db: DatabaseInstance,
   id: string,
   data: UpdateCategoryInput,
) {
   return fromPromise(
      (async () => {
         const validated = validateInput(updateCategorySchema, data);
         const existing = await db.query.categories.findFirst({
            where: (fields, { eq }) => eq(fields.id, id),
         });
         if (!existing) throw AppError.notFound("Categoria não encontrada.");
         if (existing.isDefault) {
            throw AppError.conflict(
               "Categorias padrão não podem ser editadas.",
            );
         }

         if (validated.keywords?.length) {
            const vResult = await validateKeywordsUniqueness(
               db,
               existing.teamId,
               validated.keywords,
               id,
            );
            if (vResult.isErr()) throw vResult.error;
         }

         const [updated] = await db
            .update(categories)
            .set({ ...validated, updatedAt: dayjs().toDate() })
            .where(eq(categories.id, id))
            .returning();
         if (!updated) throw AppError.notFound("Categoria não encontrada.");
         return updated;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to update category", { cause: e }),
   );
}

export function archiveCategory(db: DatabaseInstance, id: string) {
   return fromPromise(
      (async () => {
         const existing = await db.query.categories.findFirst({
            where: (fields, { eq }) => eq(fields.id, id),
         });
         if (!existing) throw AppError.notFound("Categoria não encontrada.");
         if (existing.isDefault) {
            throw AppError.conflict(
               "Categorias padrão não podem ser arquivadas.",
            );
         }

         const descendantIds = await getDescendantIds(db, id);
         const allIds = [id, ...descendantIds];

         await db
            .update(categories)
            .set({ isArchived: true, updatedAt: dayjs().toDate() })
            .where(inArray(categories.id, allIds));

         return await db.query.categories.findFirst({
            where: (fields, { eq }) => eq(fields.id, id),
         });
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to archive category", { cause: e }),
   );
}

export function reactivateCategory(db: DatabaseInstance, id: string) {
   return fromPromise(
      (async () => {
         const [updated] = await db
            .update(categories)
            .set({ isArchived: false, updatedAt: dayjs().toDate() })
            .where(eq(categories.id, id))
            .returning();
         if (!updated) throw AppError.notFound("Categoria não encontrada.");
         return updated;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to reactivate category", { cause: e }),
   );
}

export function deleteCategory(db: DatabaseInstance, id: string) {
   return fromPromise(
      (async () => {
         const existing = await db.query.categories.findFirst({
            where: (fields, { eq }) => eq(fields.id, id),
         });
         if (!existing) throw AppError.notFound("Categoria não encontrada.");
         if (existing.isDefault) {
            throw AppError.conflict(
               "Categorias padrão não podem ser excluídas.",
            );
         }

         const hasTransactionsResult = await categoryTreeHasTransactions(
            db,
            id,
         );
         if (hasTransactionsResult.isErr()) throw hasTransactionsResult.error;
         if (hasTransactionsResult.value) {
            throw AppError.conflict(
               "Categoria com lançamentos não pode ser excluída. Use arquivamento.",
            );
         }

         await db.delete(categories).where(eq(categories.id, id));
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to delete category", { cause: e }),
   );
}

export function bulkArchiveCategories(
   db: DatabaseInstance,
   ids: string[],
   teamId: string,
) {
   return fromPromise(
      (async () => {
         const existing = await db.query.categories.findMany({
            where: (fields, { and, inArray, eq }) =>
               and(inArray(fields.id, ids), eq(fields.teamId, teamId)),
         });
         const defaultOne = existing.find((c) => c.isDefault);
         if (defaultOne) {
            throw AppError.conflict(
               "Categorias padrão não podem ser arquivadas.",
            );
         }
         const allDescendantIds = (
            await Promise.all(ids.map((id) => getDescendantIds(db, id)))
         ).flat();
         const allIds = [...new Set([...ids, ...allDescendantIds])];
         await db
            .update(categories)
            .set({ isArchived: true, updatedAt: dayjs().toDate() })
            .where(
               and(
                  inArray(categories.id, allIds),
                  eq(categories.teamId, teamId),
               ),
            );
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to bulk archive categories", {
                 cause: e,
              }),
   );
}

export function bulkDeleteCategories(
   db: DatabaseInstance,
   ids: string[],
   teamId: string,
) {
   return fromPromise(
      (async () => {
         const existing = await db.query.categories.findMany({
            where: (fields, { and, inArray, eq }) =>
               and(inArray(fields.id, ids), eq(fields.teamId, teamId)),
         });
         if (existing.length !== ids.length) {
            throw AppError.notFound(
               "Uma ou mais categorias não foram encontradas.",
            );
         }
         const defaultOne = existing.find((c) => c.isDefault);
         if (defaultOne) {
            throw AppError.conflict(
               "Categorias padrão não podem ser excluídas.",
            );
         }
         const allDescendantIds = (
            await Promise.all(ids.map((id) => getDescendantIds(db, id)))
         ).flat();
         const allIds = [...new Set([...ids, ...allDescendantIds])];
         const [row] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(transactions)
            .where(inArray(transactions.categoryId, allIds));
         if ((row?.count ?? 0) > 0) {
            throw AppError.conflict(
               "Categorias com lançamentos não podem ser excluídas. Use arquivamento.",
            );
         }
         await db.delete(categories).where(inArray(categories.id, ids));
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to bulk delete categories", {
                 cause: e,
              }),
   );
}

export function categoryTreeHasTransactions(
   db: DatabaseInstance,
   categoryId: string,
) {
   return fromPromise(
      (async () => {
         const descendantIds = await getDescendantIds(db, categoryId);
         const allIds = [categoryId, ...descendantIds];

         const [row] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(transactions)
            .where(inArray(transactions.categoryId, allIds));
         return (row?.count ?? 0) > 0;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to check category transactions", {
                 cause: e,
              }),
   );
}

async function getDescendantIds(
   db: DatabaseInstance,
   categoryId: string,
): Promise<string[]> {
   const level2 = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentId, categoryId));

   const level2Ids = level2.map((r) => r.id);
   if (level2Ids.length === 0) return [];

   const level3 = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.parentId, level2Ids));

   return [...level2Ids, ...level3.map((r) => r.id)];
}

export function listTeamMetadataByIds(db: DatabaseInstance, teamIds: string[]) {
   return fromPromise(
      (async () => {
         if (teamIds.length === 0) return [];
         return await db.query.team.findMany({
            where: (fields, { inArray }) => inArray(fields.id, teamIds),
            columns: { id: true, organizationId: true },
         });
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to list team metadata", { cause: e }),
   );
}

export function listTeamsWithPendingKeywords(db: DatabaseInstance) {
   return fromPromise(
      db.query.categories.findMany({
         columns: { teamId: true },
         where: (fields, { isNull, eq, and }) =>
            and(isNull(fields.keywords), eq(fields.isDefault, false)),
         limit: 500,
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to list teams with pending keywords", {
                 cause: e,
              }),
   );
}

export function listCategoriesWithNullKeywords(
   db: DatabaseInstance,
   teamId: string,
   limit = 50,
) {
   return fromPromise(
      db.query.categories.findMany({
         where: (fields, { and, eq, isNull }) =>
            and(
               eq(fields.teamId, teamId),
               isNull(fields.keywords),
               eq(fields.isDefault, false),
            ),
         limit,
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database(
                 "Failed to list categories with null keywords",
                 { cause: e },
              ),
   );
}

export function validateKeywordsUniqueness(
   db: DatabaseInstance,
   teamId: string,
   keywords: string[],
   excludeCategoryId?: string,
) {
   return fromPromise(
      (async () => {
         const conditions: SQL[] = [
            eq(categories.teamId, teamId),
            eq(categories.isArchived, false),
            sql`${categories.keywords} && ARRAY[${sql.join(
               keywords.map((k) => sql`${k}`),
               sql`,`,
            )}]::text[]`,
         ];

         if (excludeCategoryId) {
            conditions.push(sql`${categories.id} != ${excludeCategoryId}`);
         }

         const [row] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(categories)
            .where(and(...conditions));

         if ((row?.count ?? 0) > 0) {
            throw AppError.conflict(
               "Palavras-chave já utilizadas em outra categoria ativa.",
            );
         }
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to validate keywords uniqueness", {
                 cause: e,
              }),
   );
}

export function findCategoryByKeywords(
   db: DatabaseInstance,
   teamId: string,
   opts: {
      name: string;
      type: "income" | "expense";
   },
) {
   return fromPromise(
      (async () => {
         const rows = await db
            .select({
               id: categories.id,
               name: categories.name,
               level: categories.level,
            })
            .from(categories)
            .where(
               and(
                  eq(categories.teamId, teamId),
                  eq(categories.type, opts.type),
                  eq(categories.isArchived, false),
                  sql`EXISTS (
                     SELECT 1 FROM unnest(${categories.keywords}) k
                     WHERE ${opts.name} ILIKE '%' || k || '%'
                  )`,
               ),
            )
            .orderBy(desc(categories.level))
            .limit(1);

         return rows[0] ?? null;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to find category by keywords", {
                 cause: e,
              }),
   );
}
