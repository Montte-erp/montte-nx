import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { z } from "zod";
import type { DatabaseInstance } from "@core/database/client";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";

const throwableCauseSchema = z.object({
   name: z.string().optional(),
   message: z.string().optional(),
});

const classificationSeedErrors = defineErrorCatalog("classification.seed", {
   EMPTY_CATEGORY_INSERT: {
      status: 500,
      message: "Falha ao criar categoria padrão.",
      tags: ["classification", "seed"],
   },
   SEED_FAILED: {
      status: 500,
      message: "Falha ao semear classificação padrão.",
      tags: ["classification", "seed"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "classification.seed": typeof classificationSeedErrors;
   }
}

type ClassificationSeedCatalogError =
   | ReturnType<typeof classificationSeedErrors.EMPTY_CATEGORY_INSERT>
   | ReturnType<typeof classificationSeedErrors.SEED_FAILED>;

export class ClassificationSeedError extends TaggedError(
   "ClassificationSeedError",
)<{
   error: ClassificationSeedCatalogError;
   message: string;
}>() {}

const emptyCategoryInsertError = () =>
   new ClassificationSeedError({
      error: classificationSeedErrors.EMPTY_CATEGORY_INSERT(),
      message: "Falha ao criar categoria padrão.",
   });

const serializeUnknownCause = (cause: unknown) => {
   const parsed = throwableCauseSchema.safeParse(cause);
   if (parsed.success) {
      return {
         name: parsed.data.name ?? "UnknownError",
         message: parsed.data.message ?? "Falha sem mensagem.",
      };
   }
   return { type: typeof cause };
};

const seedFailedError = (cause: unknown) =>
   new ClassificationSeedError({
      error: classificationSeedErrors.SEED_FAILED({
         internal: { cause: serializeUnknownCause(cause) },
      }),
      message: "Falha ao semear classificação padrão.",
   });

const serializeSeedFailure = (error: ClassificationSeedError) =>
   Result.serialize(Result.err<void, ClassificationSeedError>(error));

const deserializeSeedFailure = (cause: unknown) => {
   const result = Result.deserialize<void, ClassificationSeedError>(cause);
   if (Result.isError(result) && ClassificationSeedError.is(result.error)) {
      return Result.ok(result.error);
   }
   return Result.err(seedFailedError(cause));
};

type CategoryType = "income" | "expense";

type TagSeed = {
   name: string;
   color: string;
   description: string;
   dreType: "receita" | "despesa";
   dreOrder: number;
};

type LeafSeed = {
   name: string;
   description?: string;
};

type ParentSeed = {
   name: string;
   type: CategoryType;
   icon: string;
   color: string;
   description: string;
   dreGroupId: string | null;
   participatesDre: boolean;
   children: LeafSeed[];
};

const TAGS: TagSeed[] = [
   {
      name: "Receita Operacional",
      color: "#16a34a",
      description: "Compõe (=) Receita Operacional Líquida.",
      dreType: "receita",
      dreOrder: 1,
   },
   {
      name: "Dedução de Receita",
      color: "#dc2626",
      description: "Compõe (=) Receita Operacional Líquida.",
      dreType: "despesa",
      dreOrder: 2,
   },
   {
      name: "Custo do Serviço e Produto",
      color: "#dc2626",
      description: "Compõe (=) Resultado Bruto.",
      dreType: "despesa",
      dreOrder: 3,
   },
   {
      name: "Despesa Administrativa",
      color: "#f97316",
      description: "Compõe (-) Despesas Operacionais.",
      dreType: "despesa",
      dreOrder: 4,
   },
   {
      name: "Despesa Comercial",
      color: "#f97316",
      description: "Compõe (-) Despesas Operacionais.",
      dreType: "despesa",
      dreOrder: 5,
   },
   {
      name: "Despesa com Taxas e Tributos",
      color: "#f97316",
      description: "Compõe (-) Despesas Operacionais.",
      dreType: "despesa",
      dreOrder: 6,
   },
   {
      name: "Despesa Não Operacional",
      color: "#facc15",
      description: "Compõe (+/-) Resultado Não Operacional.",
      dreType: "despesa",
      dreOrder: 7,
   },
   {
      name: "Investimento",
      color: "#3b82f6",
      description: "Compõe (+/-) Resultado Não Operacional.",
      dreType: "despesa",
      dreOrder: 8,
   },
   {
      name: "Imposto sobre o Lucro",
      color: "#dc2626",
      description: "Compõe (=) Resultado Antes das Retiradas.",
      dreType: "despesa",
      dreOrder: 9,
   },
   {
      name: "Retirada de Lucro",
      color: "#a855f7",
      description: "Compõe (=) Resultado Líquido.",
      dreType: "despesa",
      dreOrder: 10,
   },
];

const CATEGORIES: ParentSeed[] = [
   {
      name: "Receitas de Vendas",
      type: "income",
      icon: "trending-up",
      color: "#16a34a",
      description: "Receitas operacionais de venda de produtos e serviços.",
      dreGroupId: "Receita Operacional",
      participatesDre: true,
      children: [
         {
            name: "Vendas de Produtos",
            description: "Receita de venda de mercadorias.",
         },
         {
            name: "Prestação de Serviços",
            description: "Receita de prestação de serviços.",
         },
         {
            name: "Receita Cartão / Maquininha",
            description: "Vendas processadas por cartão / adquirente.",
         },
         {
            name: "Receita PIX",
            description: "Recebimentos via PIX.",
         },
         {
            name: "Receita em Dinheiro",
            description: "Vendas em espécie.",
         },
      ],
   },
   {
      name: "Deduções de Receita",
      type: "expense",
      icon: "trending-down",
      color: "#dc2626",
      description:
         "Tributos sobre vendas, devoluções e descontos concedidos sobre faturamento.",
      dreGroupId: "Dedução de Receita",
      participatesDre: true,
      children: [
         {
            name: "Devoluções de Vendas",
         },
         {
            name: "Descontos Concedidos",
         },
         {
            name: "ICMS sobre Vendas",
         },
         {
            name: "ISS sobre Faturamento",
         },
         {
            name: "Simples Nacional - DAS",
         },
         {
            name: "PIS/COFINS sobre Vendas",
         },
      ],
   },
   {
      name: "Receitas Financeiras",
      type: "income",
      icon: "piggy-bank",
      color: "#0ea5e9",
      description:
         "Rendimentos financeiros e outras receitas não operacionais.",
      dreGroupId: null,
      participatesDre: false,
      children: [
         {
            name: "Rendimentos de Aplicações",
         },
         {
            name: "Juros Recebidos",
         },
         {
            name: "Aluguéis Ativos",
         },
         {
            name: "Ganhos em Venda de Ativo",
         },
      ],
   },
   {
      name: "Custo dos Produtos / Serviços",
      type: "expense",
      icon: "package",
      color: "#dc2626",
      description: "Custos diretos de produção e prestação de serviços.",
      dreGroupId: "Custo do Serviço e Produto",
      participatesDre: true,
      children: [
         {
            name: "Compra de Mercadorias",
         },
         {
            name: "Matéria-Prima",
         },
         {
            name: "Materiais Aplicados em Serviços",
         },
         {
            name: "Frete sobre Compras",
         },
         {
            name: "Fornecedores",
         },
      ],
   },
   {
      name: "Salários e Encargos",
      type: "expense",
      icon: "users",
      color: "#f97316",
      description: "Folha de pagamento, encargos e horas extras.",
      dreGroupId: "Despesa Administrativa",
      participatesDre: true,
      children: [
         {
            name: "Salários",
         },
         {
            name: "Pró-labore",
         },
         { name: "Horistas" },
         { name: "Estagiários" },
         { name: "13º Salário" },
         { name: "Férias" },
         { name: "INSS" },
         { name: "FGTS" },
         {
            name: "IRRF sobre Salários",
         },
         {
            name: "Horas Extras",
         },
         {
            name: "Adiantamento Salarial",
         },
      ],
   },
   {
      name: "Rescisões e Admissões",
      type: "expense",
      icon: "user-minus",
      color: "#f97316",
      description: "Custos com desligamento e contratação.",
      dreGroupId: "Despesa Administrativa",
      participatesDre: true,
      children: [
         {
            name: "Verbas Rescisórias",
         },
         {
            name: "Indenizações Trabalhistas",
         },
         {
            name: "Exames Admissionais e Demissionais",
         },
      ],
   },
   {
      name: "Benefícios",
      type: "expense",
      icon: "heart",
      color: "#f97316",
      description: "Benefícios oferecidos a colaboradores.",
      dreGroupId: "Despesa Administrativa",
      participatesDre: true,
      children: [
         {
            name: "Vale-Alimentação",
         },
         {
            name: "Vale-Transporte",
         },
         {
            name: "Plano de Saúde",
         },
         {
            name: "Plano Odontológico",
         },
         { name: "Seguro de Vida" },
         {
            name: "Cursos e Treinamentos",
         },
         {
            name: "Confraternizações",
         },
         { name: "Uniformes" },
      ],
   },
   {
      name: "PLR e Bônus",
      type: "expense",
      icon: "award",
      color: "#f97316",
      description: "Participação nos lucros e bonificações.",
      dreGroupId: "Despesa Administrativa",
      participatesDre: true,
      children: [
         {
            name: "PLR",
         },
         {
            name: "Bônus / Gratificações",
         },
      ],
   },
   {
      name: "Despesas com Imóvel",
      type: "expense",
      icon: "building",
      color: "#f97316",
      description: "Custos do imóvel onde a empresa opera.",
      dreGroupId: "Despesa Administrativa",
      participatesDre: true,
      children: [
         { name: "Aluguel" },
         { name: "Condomínio" },
         { name: "IPTU" },
         {
            name: "Energia Elétrica",
         },
         {
            name: "Água e Esgoto",
         },
         {
            name: "Manutenção Predial",
         },
         { name: "Seguro de Imóveis" },
         {
            name: "Alvará de Funcionamento",
         },
      ],
   },
   {
      name: "Despesas com Veículos",
      type: "expense",
      icon: "car",
      color: "#f97316",
      description: "Frota e veículos da empresa.",
      dreGroupId: "Despesa Administrativa",
      participatesDre: true,
      children: [
         {
            name: "Combustível",
         },
         {
            name: "Manutenção de Veículos",
         },
         {
            name: "IPVA / Licenciamento",
         },
         {
            name: "Pedágios e Estacionamento",
         },
         {
            name: "Multas de Trânsito",
         },
         { name: "Seguro de Veículos" },
      ],
   },
   {
      name: "Suprimentos de Escritório",
      type: "expense",
      icon: "paperclip",
      color: "#f97316",
      description: "Materiais de consumo do escritório.",
      dreGroupId: "Despesa Administrativa",
      participatesDre: true,
      children: [
         {
            name: "Material de Escritório",
         },
         {
            name: "Material de Informática",
         },
         {
            name: "Suprimentos de Limpeza",
         },
         {
            name: "Copa e Cozinha",
         },
      ],
   },
   {
      name: "Comunicações e TI",
      type: "expense",
      icon: "wifi",
      color: "#f97316",
      description: "Telefonia, internet e softwares.",
      dreGroupId: "Despesa Administrativa",
      participatesDre: true,
      children: [
         { name: "Telefone" },
         {
            name: "Internet",
         },
         {
            name: "Software / Licenças (SaaS)",
         },
         {
            name: "Manutenção de Computadores",
         },
         {
            name: "Correios",
         },
      ],
   },
   {
      name: "Serviços Contratados",
      type: "expense",
      icon: "briefcase",
      color: "#f97316",
      description: "Honorários e prestadores externos.",
      dreGroupId: "Despesa Administrativa",
      participatesDre: true,
      children: [
         {
            name: "Honorários Contábeis",
         },
         {
            name: "Honorários Advocatícios",
         },
         {
            name: "Consultoria",
         },
         {
            name: "Cartório",
         },
      ],
   },
   {
      name: "Despesas Comerciais",
      type: "expense",
      icon: "megaphone",
      color: "#f97316",
      description: "Marketing, vendas e despesas comerciais.",
      dreGroupId: "Despesa Comercial",
      participatesDre: true,
      children: [
         {
            name: "Comissões de Vendedores",
         },
         {
            name: "Marketing e Publicidade",
         },
         {
            name: "Brindes para Clientes",
         },
         {
            name: "Viagens e Representações",
         },
         {
            name: "Frete sobre Vendas",
         },
         {
            name: "Taxa de Maquininha / Adquirência",
         },
      ],
   },
   {
      name: "Taxas e Tributos",
      type: "expense",
      icon: "receipt",
      color: "#f97316",
      description: "Taxas bancárias e tributos diversos.",
      dreGroupId: "Despesa com Taxas e Tributos",
      participatesDre: true,
      children: [
         {
            name: "Tarifas Bancárias",
         },
         {
            name: "Tarifas de Boletos",
         },
         { name: "IOF" },
         {
            name: "Taxas Municipais Diversas",
         },
         {
            name: "Multas por Infração à Legislação",
         },
      ],
   },
   {
      name: "Despesas Financeiras",
      type: "expense",
      icon: "landmark",
      color: "#facc15",
      description: "Juros, empréstimos e antecipações.",
      dreGroupId: "Despesa Não Operacional",
      participatesDre: true,
      children: [
         { name: "Juros Pagos" },
         {
            name: "Empréstimos (Juros)",
         },
         {
            name: "Factoring / Antecipação",
         },
         {
            name: "Outras Despesas Bancárias",
         },
      ],
   },
   {
      name: "Outras Despesas Não Operacionais",
      type: "expense",
      icon: "alert-circle",
      color: "#facc15",
      description: "Doações, despesas pessoais e itens não recorrentes.",
      dreGroupId: "Despesa Não Operacional",
      participatesDre: true,
      children: [
         { name: "Doações" },
         {
            name: "Despesas Pessoais dos Sócios",
         },
         {
            name: "Despesas a Identificar",
         },
      ],
   },
   {
      name: "Investimentos",
      type: "expense",
      icon: "trending-up",
      color: "#3b82f6",
      description: "Aquisição de bens imobilizados e leasing.",
      dreGroupId: "Investimento",
      participatesDre: true,
      children: [
         {
            name: "Compra de Equipamentos",
         },
         {
            name: "Compra de Móveis e Utensílios",
         },
         {
            name: "Compra de Veículos",
         },
         {
            name: "Software / Licença de Uso",
         },
         {
            name: "Construções e Benfeitorias",
         },
         { name: "Leasing" },
      ],
   },
   {
      name: "Impostos sobre o Lucro",
      type: "expense",
      icon: "scale",
      color: "#dc2626",
      description: "IRPJ e CSLL.",
      dreGroupId: "Imposto sobre o Lucro",
      participatesDre: true,
      children: [{ name: "IRPJ" }, { name: "CSLL" }, { name: "MEI" }],
   },
   {
      name: "Retirada de Lucro",
      type: "expense",
      icon: "wallet",
      color: "#a855f7",
      description: "Distribuição de lucros aos sócios.",
      dreGroupId: "Retirada de Lucro",
      participatesDre: true,
      children: [
         {
            name: "Distribuição de Lucros aos Sócios",
         },
         {
            name: "Antecipação de Lucros",
         },
      ],
   },
];

export function seedClassificationDefaults(
   db: DatabaseInstance,
   teamId: string,
) {
   return Result.tryPromise({
      try: () =>
         db.transaction(async (tx) => {
            await tx.insert(tags).values(
               TAGS.map((t) => ({
                  teamId,
                  name: t.name,
                  color: t.color,
                  description: t.description,
                  dreType: t.dreType,
                  dreOrder: t.dreOrder,
                  isDefault: true,
               })),
            );

            for (const root of CATEGORIES) {
               const [parent] = await tx
                  .insert(categories)
                  .values({
                     teamId,
                     name: root.name,
                     type: root.type,
                     icon: root.icon,
                     color: root.color,
                     description: root.description,
                     level: 1,
                     isDefault: true,
                     participatesDre: root.participatesDre,
                     dreGroupId: root.dreGroupId,
                  })
                  .returning();
               if (!parent) {
                  throw serializeSeedFailure(emptyCategoryInsertError());
               }
               if (root.children.length > 0) {
                  await tx.insert(categories).values(
                     root.children.map((child) => ({
                        teamId,
                        name: child.name,
                        type: root.type,
                        description: child.description ?? null,
                        parentId: parent.id,
                        level: 2,
                        isDefault: true,
                        participatesDre: root.participatesDre,
                        dreGroupId: root.dreGroupId,
                     })),
                  );
               }
            }
         }),
      catch: (cause) =>
         Result.unwrapOr(deserializeSeedFailure(cause), seedFailedError(cause)),
   });
}
