import dayjs from "dayjs";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import type { Value } from "platejs";

export type DemoStatus = "active" | "archived";

export type DemoCustomer = {
   id: string;
   name: string;
   tradeName: string;
   document: string;
   documentType: "cpf" | "cnpj";
   email: string;
   phone: string;
   city: string;
   state: string;
   segment: string;
   owner: string;
   lastContactAt: string;
   status: DemoStatus;
   notes: string;
   createdAt: string;
   updatedAt: string;
};

export type DemoSupplier = {
   id: string;
   name: string;
   tradeName: string;
   document: string;
   documentType: "cpf" | "cnpj";
   email: string;
   phone: string;
   city: string;
   state: string;
   category: string;
   owner: string;
   lastContactAt: string;
   status: DemoStatus;
   notes: string;
   createdAt: string;
   updatedAt: string;
};

export type ContractDirection = "receita" | "despesa";
export type ContractStatus = "draft" | "active" | "paused" | "ended";
export type ContractFrequency =
   | "monthly"
   | "quarterly"
   | "semiannual"
   | "annual";

export type DemoContract = {
   id: string;
   number: string;
   title: string;
   direction: ContractDirection;
   customerId: string;
   supplierId: string;
   templateId: string;
   status: ContractStatus;
   document: Value;
   billing: {
      amount: number;
      frequency: ContractFrequency;
      firstDueDate: string;
      dueDay: number;
      endDate: string;
      category: string;
      costCenter: string;
      bankAccount: string;
   };
   serviceDescription: string;
   createdAt: string;
   updatedAt: string;
};

export type ContractTemplate = {
   id: string;
   title: string;
   description: string;
   direction: ContractDirection | "ambos";
   document: Value;
};

export type ContractCharge = {
   id: string;
   contractId: string;
   competence: string;
   dueDate: string;
   amount: number;
   status: "prevista" | "em_aberto" | "recebida" | "atrasada";
};

const today = "2026-05-22";

export const initialCustomers: DemoCustomer[] = [
   {
      id: "cus-clinica-aurora",
      name: "Clínica Aurora Ltda",
      tradeName: "Clínica Aurora",
      document: "12.345.678/0001-90",
      documentType: "cnpj",
      email: "financeiro@clinicaaurora.com.br",
      phone: "(11) 4040-1000",
      city: "São Paulo",
      state: "SP",
      segment: "Saúde",
      owner: "Marina Costa",
      lastContactAt: "2026-05-20",
      status: "active",
      notes: "Cliente com contrato mensal de operação financeira.",
      createdAt: today,
      updatedAt: today,
   },
   {
      id: "cus-acme",
      name: "Acme Software Ltda",
      tradeName: "Acme",
      document: "22.444.555/0001-10",
      documentType: "cnpj",
      email: "ops@acme.dev",
      phone: "(31) 3555-9000",
      city: "Belo Horizonte",
      state: "MG",
      segment: "Software",
      owner: "Rafael Lima",
      lastContactAt: "2026-05-18",
      status: "active",
      notes: "Assinatura anual com cobrança mensal.",
      createdAt: today,
      updatedAt: today,
   },
   {
      id: "cus-norte",
      name: "Norte Coworking",
      tradeName: "Norte",
      document: "35.100.900/0001-42",
      documentType: "cnpj",
      email: "administrativo@nortecoworking.com",
      phone: "(85) 3030-2200",
      city: "Fortaleza",
      state: "CE",
      segment: "Serviços",
      owner: "Carla Nunes",
      lastContactAt: "2026-05-14",
      status: "active",
      notes: "Revisar reajuste no próximo ciclo.",
      createdAt: today,
      updatedAt: today,
   },
];

export const initialSuppliers: DemoSupplier[] = [
   {
      id: "sup-prisma",
      name: "Contabilidade Prisma Ltda",
      tradeName: "Prisma",
      document: "44.222.111/0001-70",
      documentType: "cnpj",
      email: "atendimento@prisma.com.br",
      phone: "(11) 3333-8080",
      city: "São Paulo",
      state: "SP",
      category: "Contabilidade",
      owner: "Marina Costa",
      lastContactAt: "2026-05-17",
      status: "active",
      notes: "Fornecedor mensal de contabilidade.",
      createdAt: today,
      updatedAt: today,
   },
   {
      id: "sup-cloudbox",
      name: "Cloudbox Tecnologia S.A.",
      tradeName: "Cloudbox",
      document: "18.300.200/0001-11",
      documentType: "cnpj",
      email: "billing@cloudbox.com",
      phone: "(41) 3020-7000",
      city: "Curitiba",
      state: "PR",
      category: "Infraestrutura",
      owner: "Rafael Lima",
      lastContactAt: "2026-05-16",
      status: "active",
      notes: "Infraestrutura com pagamento mensal.",
      createdAt: today,
      updatedAt: today,
   },
];

export const contractTemplates: ContractTemplate[] = [
   {
      id: "servicos-mensais",
      title: "Prestação de serviços mensal",
      description:
         "Modelo para mensalidade, assessoria, consultoria e operação.",
      direction: "receita",
      document: [
         heading("h1", "Contrato de prestação de serviços recorrentes"),
         paragraph(
            "Pelo presente instrumento particular, as partes abaixo identificadas ajustam a prestação recorrente de serviços, conforme as condições comerciais e operacionais descritas neste contrato.",
         ),
         heading("h2", "1. Partes"),
         clause(
            "Contratada: ",
            "{{empresa_nome}}, pessoa jurídica responsável pela execução dos serviços descritos neste instrumento.",
         ),
         clause(
            "Contratante: ",
            "{{parte_nome}}, inscrita no documento {{parte_documento}}, responsável pelo pagamento e pelo fornecimento das informações necessárias à execução dos serviços.",
         ),
         heading("h2", "2. Objeto"),
         paragraph(
            "A contratada prestará, de forma contínua e recorrente, {{descricao_servico}}, incluindo rotinas de acompanhamento, execução operacional, comunicação de pendências e suporte relacionado ao escopo contratado.",
         ),
         heading("h2", "3. Valor, frequência e vencimento"),
         paragraph(
            "Pelos serviços contratados, a contratante pagará à contratada o valor de {{valor_recorrente}}, com frequência {{frequencia}}, vencendo todo dia {{dia_vencimento}} de cada ciclo de cobrança.",
         ),
         paragraph(
            "Os pagamentos serão registrados no financeiro da contratada como cobrança recorrente, podendo gerar cobranças futuras enquanto o contrato estiver ativo.",
         ),
         heading("h2", "4. Vigência"),
         paragraph(
            "Este contrato inicia em {{data_inicio}} e permanecerá vigente até {{data_fim}}, salvo encerramento formal solicitado por uma das partes.",
         ),
         heading("h2", "5. Obrigações das partes"),
         clause(
            "Obrigações da contratada: ",
            "executar os serviços com regularidade, comunicar pendências relevantes e manter registro das entregas acordadas.",
         ),
         clause(
            "Obrigações da contratante: ",
            "manter dados cadastrais e financeiros atualizados, fornecer informações necessárias à execução do serviço e efetuar os pagamentos nos vencimentos definidos.",
         ),
         heading("h2", "6. Reajuste, suspensão e rescisão"),
         paragraph(
            "As partes poderão revisar valores e condições mediante acordo registrado por escrito. A inadimplência poderá suspender a prestação dos serviços até a regularização dos valores em aberto.",
         ),
         paragraph(
            "Qualquer parte poderá encerrar este contrato mediante aviso prévio formal, preservadas as cobranças já vencidas e as obrigações assumidas até a data de encerramento.",
         ),
      ],
   },
   {
      id: "suporte-manutencao",
      title: "Suporte e manutenção",
      description: "Modelo para suporte técnico, manutenção e SLA simples.",
      direction: "receita",
      document: [
         heading("h1", "Contrato de suporte e manutenção recorrente"),
         heading("h2", "1. Objeto"),
         paragraph(
            "A {{empresa_nome}} prestará suporte recorrente para {{parte_nome}}, incluindo acompanhamento, correções e manutenção preventiva.",
         ),
         heading("h2", "2. Cobrança"),
         paragraph(
            "O valor recorrente será de {{valor_recorrente}}, com cobrança {{frequencia}} e vencimento no dia {{dia_vencimento}} de cada ciclo.",
         ),
         heading("h2", "3. Vigência e atendimento"),
         paragraph(
            "A vigência começa em {{data_inicio}} e termina em {{data_fim}}. As solicitações serão priorizadas conforme criticidade operacional.",
         ),
      ],
   },
   {
      id: "assinatura-software",
      title: "Assinatura de software",
      description:
         "Modelo para licença, acesso, suporte e cobrança recorrente.",
      direction: "receita",
      document: [
         heading("h1", "Contrato de assinatura de software"),
         heading("h2", "1. Licença de uso"),
         paragraph(
            "A {{empresa_nome}} disponibilizará acesso ao software para {{parte_nome}}, com uso vinculado às condições comerciais deste contrato.",
         ),
         heading("h2", "2. Cobrança recorrente"),
         paragraph(
            "A assinatura terá valor de {{valor_recorrente}}, frequência {{frequencia}} e vencimento todo dia {{dia_vencimento}}.",
         ),
         heading("h2", "3. Suspensão"),
         paragraph(
            "O acesso poderá ser suspenso em caso de inadimplência, sem prejuízo da cobrança dos valores em aberto.",
         ),
      ],
   },
   {
      id: "fornecedor-recorrente",
      title: "Contrato com fornecedor recorrente",
      description:
         "Modelo para contabilidade, aluguel, infraestrutura e serviços tomados.",
      direction: "despesa",
      document: [
         heading("h1", "Contrato de fornecimento recorrente"),
         heading("h2", "1. Partes"),
         clause(
            "Contratante: ",
            "{{empresa_nome}}, responsável pelo pagamento e pela gestão do contrato.",
         ),
         clause(
            "Fornecedor: ",
            "{{parte_nome}}, inscrita no documento {{parte_documento}}, responsável pela prestação de {{descricao_servico}}.",
         ),
         heading("h2", "2. Valor e pagamento"),
         paragraph(
            "A {{empresa_nome}} pagará {{valor_recorrente}} com frequência {{frequencia}}, vencendo todo dia {{dia_vencimento}} de cada ciclo.",
         ),
         heading("h2", "3. Vigência"),
         paragraph(
            "O contrato começa em {{data_inicio}} e fica vigente até {{data_fim}}, com possibilidade de renovação operacional.",
         ),
         heading("h2", "4. Obrigações"),
         paragraph(
            "O fornecedor manterá a prestação regular do serviço e comunicará previamente mudanças que afetem a operação, valores, prazos ou disponibilidade.",
         ),
      ],
   },
   {
      id: "personalizado",
      title: "Serviço recorrente personalizado",
      description: "Base curta para adaptar durante a demonstração.",
      direction: "ambos",
      document: [
         heading("h1", "Contrato de serviço recorrente"),
         heading("h2", "1. Objeto"),
         paragraph(
            "A {{empresa_nome}} e {{parte_nome}} ajustam a prestação de {{descricao_servico}}.",
         ),
         heading("h2", "2. Condição comercial"),
         paragraph(
            "O valor recorrente será de {{valor_recorrente}}, com frequência {{frequencia}} e vencimento no dia {{dia_vencimento}}.",
         ),
         heading("h2", "3. Vigência"),
         paragraph(
            "A vigência começa em {{data_inicio}} e termina em {{data_fim}}.",
         ),
      ],
   },
];

export const initialContracts: DemoContract[] = [
   {
      id: "ctr-018",
      number: "CTR-2026-018",
      title: "Suporte recorrente Acme",
      direction: "receita",
      customerId: "cus-acme",
      supplierId: "",
      templateId: "suporte-manutencao",
      status: "active",
      document: contractTemplates[1]?.document ?? [],
      billing: {
         amount: 8900,
         frequency: "monthly",
         firstDueDate: "2026-06-05",
         dueDay: 5,
         endDate: "2027-05-31",
         category: "Serviços recorrentes",
         costCenter: "Operação",
         bankAccount: "Conta principal",
      },
      serviceDescription: "suporte técnico recorrente e manutenção operacional",
      createdAt: today,
      updatedAt: today,
   },
   {
      id: "ctr-019",
      number: "CTR-2026-019",
      title: "Operação financeira Clínica Aurora",
      direction: "receita",
      customerId: "cus-clinica-aurora",
      supplierId: "",
      templateId: "servicos-mensais",
      status: "draft",
      document: contractTemplates[0]?.document ?? [],
      billing: {
         amount: 2500,
         frequency: "monthly",
         firstDueDate: "2026-06-10",
         dueDay: 10,
         endDate: "",
         category: "Serviços recorrentes",
         costCenter: "Financeiro",
         bankAccount: "Conta principal",
      },
      serviceDescription: "operação financeira mensal",
      createdAt: today,
      updatedAt: today,
   },
   {
      id: "ctr-020",
      number: "CTR-2026-020",
      title: "Contabilidade Prisma",
      direction: "despesa",
      customerId: "",
      supplierId: "sup-prisma",
      templateId: "fornecedor-recorrente",
      status: "active",
      document: contractTemplates[3]?.document ?? [],
      billing: {
         amount: 650,
         frequency: "monthly",
         firstDueDate: "2026-06-08",
         dueDay: 8,
         endDate: "",
         category: "Contabilidade",
         costCenter: "Administrativo",
         bankAccount: "Conta principal",
      },
      serviceDescription: "serviços contábeis mensais",
      createdAt: today,
      updatedAt: today,
   },
];

const [useDemoCustomers] = createLocalStorageState<DemoCustomer[]>(
   "montte:demo:customers",
   initialCustomers,
);

const [useDemoSuppliers] = createLocalStorageState<DemoSupplier[]>(
   "montte:demo:suppliers",
   initialSuppliers,
);

const [useDemoContracts] = createLocalStorageState<DemoContract[]>(
   "montte:demo:contracts:v2",
   initialContracts,
);

export { useDemoContracts, useDemoCustomers, useDemoSuppliers };

export function getCustomerName(customers: DemoCustomer[], id: string) {
   return customers.find((customer) => customer.id === id)?.name ?? "Cliente";
}

export function getSupplierName(suppliers: DemoSupplier[], id: string) {
   return (
      suppliers.find((supplier) => supplier.id === id)?.name ?? "Fornecedor"
   );
}

export function getContractPartyDocument({
   contract,
   customers,
   suppliers,
}: {
   contract: DemoContract;
   customers: DemoCustomer[];
   suppliers: DemoSupplier[];
}) {
   if (contract.direction === "receita")
      return (
         customers.find((customer) => customer.id === contract.customerId)
            ?.document ?? ""
      );
   return (
      suppliers.find((supplier) => supplier.id === contract.supplierId)
         ?.document ?? ""
   );
}

export function getContractPartyName({
   contract,
   customers,
   suppliers,
}: {
   contract: DemoContract;
   customers: DemoCustomer[];
   suppliers: DemoSupplier[];
}) {
   if (contract.direction === "receita")
      return getCustomerName(customers, contract.customerId);
   return getSupplierName(suppliers, contract.supplierId);
}

export function formatCurrency(value: number) {
   return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
   }).format(value);
}

export function frequencyLabel(frequency: ContractFrequency) {
   if (frequency === "monthly") return "mensal";
   if (frequency === "quarterly") return "trimestral";
   if (frequency === "semiannual") return "semestral";
   return "anual";
}

export function statusLabel(status: ContractStatus) {
   if (status === "active") return "Ativo";
   if (status === "paused") return "Pausado";
   if (status === "ended") return "Encerrado";
   return "Rascunho";
}

export function formatDate(value: string) {
   if (!value) return "Sem data";
   return dayjs(value).format("DD/MM/YYYY");
}

export function deriveContractCharges(contract: DemoContract) {
   const interval = getFrequencyInterval(contract.billing.frequency);
   const charges: ContractCharge[] = [];

   for (let index = 0; index < 12; index += 1) {
      const dueDate = dayjs(contract.billing.firstDueDate).add(
         index * interval,
         "month",
      );
      const status = getChargeStatus(index, contract.status);
      charges.push({
         id: `${contract.id}-${dueDate.format("YYYY-MM-DD")}`,
         contractId: contract.id,
         competence: dueDate.format("MM/YYYY"),
         dueDate: dueDate.format("YYYY-MM-DD"),
         amount: contract.billing.amount,
         status,
      });
   }

   return charges;
}

export function replaceTemplateVariables({
   contract,
   customers,
   suppliers,
}: {
   contract: DemoContract;
   customers: DemoCustomer[];
   suppliers: DemoSupplier[];
}): Value {
   const partyName = getContractPartyName({ contract, customers, suppliers });
   const partyDocument = getContractPartyDocument({
      contract,
      customers,
      suppliers,
   });
   const replacements: { token: string; value: string }[] = [
      { token: "{{empresa_nome}}", value: "Montte Demo Ltda" },
      { token: "{{parte_nome}}", value: partyName },
      { token: "{{parte_documento}}", value: partyDocument || "não informado" },
      {
         token: "{{valor_recorrente}}",
         value: formatCurrency(contract.billing.amount),
      },
      {
         token: "{{frequencia}}",
         value: frequencyLabel(contract.billing.frequency),
      },
      { token: "{{dia_vencimento}}", value: String(contract.billing.dueDay) },
      {
         token: "{{data_inicio}}",
         value: formatDate(contract.billing.firstDueDate),
      },
      {
         token: "{{data_fim}}",
         value: contract.billing.endDate
            ? formatDate(contract.billing.endDate)
            : "prazo indeterminado",
      },
      { token: "{{descricao_servico}}", value: contract.serviceDescription },
   ];

   return contract.document.map((block) => {
      const type = typeof block.type === "string" ? block.type : "p";
      return {
         type,
         children: block.children.map((child) => {
            let text = getNodeText(child);
            for (const replacement of replacements) {
               text = text.split(replacement.token).join(replacement.value);
            }
            if (typeof child === "object" && child !== null) {
               return { ...child, text };
            }
            return { text };
         }),
      };
   });
}

export function makeCustomerDraft(): DemoCustomer {
   return {
      id: crypto.randomUUID(),
      name: "",
      tradeName: "",
      document: "",
      documentType: "cnpj",
      email: "",
      phone: "",
      city: "",
      state: "",
      segment: "",
      owner: "",
      lastContactAt: today,
      status: "active",
      notes: "",
      createdAt: today,
      updatedAt: today,
   };
}

export function makeSupplierDraft(): DemoSupplier {
   return {
      id: crypto.randomUUID(),
      name: "",
      tradeName: "",
      document: "",
      documentType: "cnpj",
      email: "",
      phone: "",
      city: "",
      state: "",
      category: "",
      owner: "",
      lastContactAt: today,
      status: "active",
      notes: "",
      createdAt: today,
      updatedAt: today,
   };
}

export function makeContractDraft({
   customers,
}: {
   customers: DemoCustomer[];
}): DemoContract {
   const template = contractTemplates[0];
   return {
      id: crypto.randomUUID(),
      number: `CTR-2026-${String(Math.floor(Math.random() * 800) + 200)}`,
      title: "Novo contrato recorrente",
      direction: "receita",
      customerId: customers[0]?.id ?? "",
      supplierId: "",
      templateId: template?.id ?? "servicos-mensais",
      status: "draft",
      document: template?.document ?? [],
      billing: {
         amount: 1500,
         frequency: "monthly",
         firstDueDate: "2026-06-10",
         dueDay: 10,
         endDate: "",
         category: "Serviços recorrentes",
         costCenter: "Operação",
         bankAccount: "Conta principal",
      },
      serviceDescription: "serviço recorrente contratado",
      createdAt: today,
      updatedAt: today,
   };
}

function paragraph(text: string) {
   return { type: "p", children: [{ text }] };
}

function heading(type: "h1" | "h2", text: string) {
   return { type, children: [{ text }] };
}

function clause(label: string, text: string) {
   return {
      type: "p",
      children: [{ text: label, bold: true }, { text }],
   };
}

function getNodeText(child: unknown) {
   if (
      typeof child === "object" &&
      child !== null &&
      "text" in child &&
      typeof child.text === "string"
   )
      return child.text;
   return "";
}

function getFrequencyInterval(frequency: ContractFrequency) {
   if (frequency === "quarterly") return 3;
   if (frequency === "semiannual") return 6;
   if (frequency === "annual") return 12;
   return 1;
}

function getChargeStatus(index: number, contractStatus: ContractStatus) {
   if (contractStatus !== "active") return "prevista";
   if (index === 0) return "recebida";
   if (index === 1) return "em_aberto";
   if (index === 2) return "atrasada";
   return "prevista";
}
