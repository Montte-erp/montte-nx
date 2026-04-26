import { fromPromise } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import { categories } from "@core/database/schemas/categories";
import { WebAppError } from "@core/logging/errors";

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

export function seedEmpresarialCategories(
   db: DatabaseInstance,
   teamId: string,
) {
   return fromPromise(
      db.transaction(async (tx) => {
         for (const root of EMPRESARIAL_CATEGORIES) {
            const [parent] = await tx
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
            if (!parent) {
               throw WebAppError.internal("Falha ao criar categoria padrão.");
            }
            if (root.children?.length) {
               await tx.insert(categories).values(
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
      }),
      (e) =>
         e instanceof WebAppError
            ? e
            : WebAppError.internal("Falha ao semear categorias padrão.", {
                 cause: e,
              }),
   );
}
