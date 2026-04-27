import { fromPromise } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";
import { WebAppError } from "@core/logging/errors";

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
   keywords: string[];
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
            keywords: [
               "venda de produto",
               "nf produto",
               "nota fiscal produto",
               "marketplace",
               "mercado livre",
               "shopee",
               "shopify",
               "loja virtual",
            ],
         },
         {
            name: "Prestação de Serviços",
            description: "Receita de prestação de serviços.",
            keywords: [
               "prestação de serviço",
               "nfs-e",
               "nota fiscal serviço",
               "honorários recebidos",
               "consultoria",
               "contrato de serviço",
            ],
         },
         {
            name: "Receita Cartão / Maquininha",
            description: "Vendas processadas por cartão / adquirente.",
            keywords: [
               "stone",
               "cielo",
               "rede",
               "getnet",
               "pagseguro",
               "infinitepay",
               "maquininha",
               "adquirente",
               "venda no cartão",
            ],
         },
         {
            name: "Receita PIX",
            description: "Recebimentos via PIX.",
            keywords: [
               "pix recebido",
               "pix de cliente",
               "transferência pix",
               "pix in",
            ],
         },
         {
            name: "Receita em Dinheiro",
            description: "Vendas em espécie.",
            keywords: ["depósito em dinheiro", "venda em dinheiro", "espécie"],
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
            keywords: [
               "devolução de venda",
               "estorno de venda",
               "cancelamento de venda",
            ],
         },
         {
            name: "Descontos Concedidos",
            keywords: ["desconto concedido", "abatimento", "rebate"],
         },
         {
            name: "ICMS sobre Vendas",
            keywords: ["icms", "icms st", "icms sobre vendas"],
         },
         {
            name: "ISS sobre Faturamento",
            keywords: ["iss", "iss sobre faturamento", "iss sobre serviço"],
         },
         {
            name: "Simples Nacional - DAS",
            keywords: ["das", "simples nacional", "guia simples"],
         },
         {
            name: "PIS/COFINS sobre Vendas",
            keywords: ["pis", "cofins", "pis cofins", "pis/cofins"],
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
            keywords: [
               "rendimento de aplicação",
               "cdb",
               "lci",
               "lca",
               "tesouro",
               "fundo de investimento",
            ],
         },
         {
            name: "Juros Recebidos",
            keywords: ["juros recebidos", "juros sobre atraso"],
         },
         {
            name: "Aluguéis Ativos",
            keywords: ["aluguel recebido", "locação recebida"],
         },
         {
            name: "Ganhos em Venda de Ativo",
            keywords: ["venda de ativo", "ganho em ativo"],
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
            keywords: [
               "compra de mercadoria",
               "reposição de estoque",
               "atacado",
               "distribuidora",
               "importação",
            ],
         },
         {
            name: "Matéria-Prima",
            keywords: ["matéria-prima", "insumo", "compra de insumo"],
         },
         {
            name: "Materiais Aplicados em Serviços",
            keywords: ["material aplicado", "consumível", "peças aplicadas"],
         },
         {
            name: "Frete sobre Compras",
            keywords: ["frete de entrada", "frete sobre compra"],
         },
         {
            name: "Fornecedores",
            keywords: ["fornecedor", "pagamento fornecedor"],
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
            keywords: ["salário", "folha de pagamento", "holerite"],
         },
         {
            name: "Pró-labore",
            keywords: ["pro-labore", "pró-labore", "retirada sócio"],
         },
         { name: "Horistas", keywords: ["horista", "pagamento por hora"] },
         { name: "Estagiários", keywords: ["estagiário", "estágio"] },
         { name: "13º Salário", keywords: ["13o salário", "décimo terceiro"] },
         { name: "Férias", keywords: ["férias"] },
         { name: "INSS", keywords: ["inss", "guia gps", "inss patronal"] },
         { name: "FGTS", keywords: ["fgts", "guia fgts"] },
         {
            name: "IRRF sobre Salários",
            keywords: ["irrf folha", "darf 0561", "irrf sobre salário"],
         },
         {
            name: "Horas Extras",
            keywords: ["hora extra", "adicional noturno"],
         },
         {
            name: "Adiantamento Salarial",
            keywords: ["adiantamento salarial", "vale"],
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
            keywords: ["verba rescisória", "rescisão", "trct"],
         },
         {
            name: "Indenizações Trabalhistas",
            keywords: ["indenização trabalhista", "ação trabalhista"],
         },
         {
            name: "Exames Admissionais e Demissionais",
            keywords: ["exame admissional", "exame demissional", "asas"],
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
            keywords: ["vale alimentação", "vr", "alelo va", "sodexo va"],
         },
         {
            name: "Vale-Transporte",
            keywords: ["vale transporte", "vt", "alelo vt"],
         },
         {
            name: "Plano de Saúde",
            keywords: ["plano de saúde", "convênio médico", "unimed", "amil"],
         },
         {
            name: "Plano Odontológico",
            keywords: ["plano odontológico", "odontoprev"],
         },
         { name: "Seguro de Vida", keywords: ["seguro de vida"] },
         {
            name: "Cursos e Treinamentos",
            keywords: ["curso", "treinamento", "capacitação"],
         },
         {
            name: "Confraternizações",
            keywords: ["confraternização", "happy hour", "festa empresa"],
         },
         { name: "Uniformes", keywords: ["uniforme", "epi"] },
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
            keywords: ["plr", "participação nos lucros"],
         },
         {
            name: "Bônus / Gratificações",
            keywords: ["bônus", "gratificação", "premiação"],
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
         { name: "Aluguel", keywords: ["aluguel", "locação imóvel"] },
         { name: "Condomínio", keywords: ["condomínio", "taxa condominial"] },
         { name: "IPTU", keywords: ["iptu"] },
         {
            name: "Energia Elétrica",
            keywords: ["energia elétrica", "luz", "enel", "cemig", "cpfl"],
         },
         {
            name: "Água e Esgoto",
            keywords: ["água", "saneamento", "sabesp", "saae"],
         },
         {
            name: "Manutenção Predial",
            keywords: ["manutenção predial", "reforma", "pintura"],
         },
         { name: "Seguro de Imóveis", keywords: ["seguro imóvel"] },
         {
            name: "Alvará de Funcionamento",
            keywords: ["alvará", "alvará de funcionamento"],
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
            keywords: ["combustível", "gasolina", "diesel", "etanol", "posto"],
         },
         {
            name: "Manutenção de Veículos",
            keywords: ["manutenção veículo", "oficina", "mecânica"],
         },
         {
            name: "IPVA / Licenciamento",
            keywords: ["ipva", "licenciamento", "dpvat"],
         },
         {
            name: "Pedágios e Estacionamento",
            keywords: ["pedágio", "estacionamento", "zona azul"],
         },
         {
            name: "Multas de Trânsito",
            keywords: ["multa de trânsito", "detran"],
         },
         { name: "Seguro de Veículos", keywords: ["seguro veículo"] },
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
            keywords: ["material de escritório", "papelaria"],
         },
         {
            name: "Material de Informática",
            keywords: ["material de informática", "cabos", "periféricos"],
         },
         {
            name: "Suprimentos de Limpeza",
            keywords: ["limpeza", "produtos de limpeza"],
         },
         {
            name: "Copa e Cozinha",
            keywords: ["copa", "café", "água mineral", "lanche"],
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
         { name: "Telefone", keywords: ["telefone", "vivo", "claro", "tim"] },
         {
            name: "Internet",
            keywords: ["internet", "provedor", "banda larga"],
         },
         {
            name: "Software / Licenças (SaaS)",
            keywords: [
               "saas",
               "assinatura software",
               "licença",
               "google workspace",
               "microsoft 365",
               "aws",
               "vercel",
            ],
         },
         {
            name: "Manutenção de Computadores",
            keywords: ["manutenção computador", "suporte técnico"],
         },
         {
            name: "Correios",
            keywords: ["correios", "sedex", "envio postal"],
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
            keywords: ["contabilidade", "honorário contábil", "contador"],
         },
         {
            name: "Honorários Advocatícios",
            keywords: ["advogado", "honorário advocatício", "jurídico"],
         },
         {
            name: "Consultoria",
            keywords: ["consultoria", "consultor", "assessoria"],
         },
         {
            name: "Cartório",
            keywords: ["cartório", "reconhecimento de firma"],
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
            keywords: ["comissão de venda", "comissão vendedor"],
         },
         {
            name: "Marketing e Publicidade",
            keywords: [
               "marketing",
               "google ads",
               "meta ads",
               "facebook ads",
               "agência de marketing",
               "publicidade",
            ],
         },
         {
            name: "Brindes para Clientes",
            keywords: ["brinde cliente", "presente cliente"],
         },
         {
            name: "Viagens e Representações",
            keywords: ["viagem", "passagem aérea", "hospedagem", "uber"],
         },
         {
            name: "Frete sobre Vendas",
            keywords: ["frete de saída", "frete de venda", "transportadora"],
         },
         {
            name: "Taxa de Maquininha / Adquirência",
            keywords: ["taxa maquininha", "taxa cartão", "antecipação cartão"],
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
            keywords: ["tarifa bancária", "manutenção de conta"],
         },
         {
            name: "Tarifas de Boletos",
            keywords: ["tarifa boleto", "emissão boleto"],
         },
         { name: "IOF", keywords: ["iof"] },
         {
            name: "Taxas Municipais Diversas",
            keywords: ["taxa municipal", "sindicato", "jucea"],
         },
         {
            name: "Multas por Infração à Legislação",
            keywords: [
               "multa receita federal",
               "multa fiscal",
               "auto infração",
            ],
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
         { name: "Juros Pagos", keywords: ["juros pagos", "juros de mora"] },
         {
            name: "Empréstimos (Juros)",
            keywords: ["juros de empréstimo", "encargos empréstimo"],
         },
         {
            name: "Factoring / Antecipação",
            keywords: ["factoring", "antecipação", "desconto duplicata"],
         },
         {
            name: "Outras Despesas Bancárias",
            keywords: ["despesa bancária", "encargos bancários"],
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
         { name: "Doações", keywords: ["doação"] },
         {
            name: "Despesas Pessoais dos Sócios",
            keywords: ["despesa pessoal sócio", "antecipação sócio"],
         },
         {
            name: "Despesas a Identificar",
            keywords: ["despesa a identificar", "lançamento pendente"],
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
            keywords: ["equipamento", "máquina industrial", "ferramenta"],
         },
         {
            name: "Compra de Móveis e Utensílios",
            keywords: ["móvel", "utensílio", "mobiliário"],
         },
         {
            name: "Compra de Veículos",
            keywords: ["compra veículo", "carro empresa"],
         },
         {
            name: "Software / Licença de Uso",
            keywords: ["licença perpétua", "compra de software"],
         },
         {
            name: "Construções e Benfeitorias",
            keywords: ["construção", "benfeitoria", "reforma estrutural"],
         },
         { name: "Leasing", keywords: ["leasing", "arrendamento"] },
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
      children: [
         { name: "IRPJ", keywords: ["irpj", "imposto de renda pj"] },
         { name: "CSLL", keywords: ["csll", "contribuição social"] },
         { name: "MEI", keywords: ["das mei", "guia mei"] },
      ],
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
            keywords: ["distribuição de lucro", "lucros aos sócios"],
         },
         {
            name: "Antecipação de Lucros",
            keywords: ["antecipação de lucro"],
         },
      ],
   },
];

export function seedClassificationDefaults(
   db: DatabaseInstance,
   teamId: string,
) {
   return fromPromise(
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
               throw WebAppError.internal("Falha ao criar categoria padrão.");
            }
            if (root.children.length > 0) {
               await tx.insert(categories).values(
                  root.children.map((child) => ({
                     teamId,
                     name: child.name,
                     type: root.type,
                     description: child.description ?? null,
                     keywords: child.keywords,
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
      (e) =>
         e instanceof WebAppError
            ? e
            : WebAppError.internal("Falha ao semear classificação padrão.", {
                 cause: e,
              }),
   );
}
