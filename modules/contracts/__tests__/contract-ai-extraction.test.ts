import { LLMock } from "@copilotkit/aimock";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { loadContractFixture } from "./helpers/contract-fixtures";

const llmMock = new LLMock({ port: 14020 });

const promptsStub = {
   get: vi.fn().mockResolvedValue({
      prompt:
         "Extraia contratos em JSON operacional genérico. Não invente dados. Mascare documentos.",
      name: "contracts-ai-extraction",
      version: 1,
   }),
   compile: vi.fn((prompt: string) => prompt),
};

function textField(
   value: string | null,
   quote: string,
   page: number | null = 1,
) {
   return {
      value,
      confidence: 0.92,
      evidence: [{ page, quote }],
      warnings: [],
   };
}

function boolField(value: boolean | null, quote: string) {
   return {
      value,
      confidence: 0.9,
      evidence: [{ page: 1, quote }],
      warnings: [],
   };
}

function syntheticBaseExtraction() {
   return {
      document: {
         title: textField("Contrato sintético", "CONTRATO SINTETICO"),
         typeLabel: textField("contrato de serviço", "CONTRATO SINTETICO"),
         summary: textField(
            "Contrato sintético para testes.",
            "CONTRATO SINTETICO",
         ),
         pageCount: {
            value: 1,
            confidence: 0.9,
            evidence: [{ page: 1, quote: "uma página" }],
            warnings: [],
         },
         hasAttachments: boolField(false, "sem anexo"),
         sensitiveDataCategories: [],
      },
      parties: [
         {
            role: "contratada",
            name: textField(
               "Empresa Modelo Hub LTDA",
               "Contratada: Empresa Modelo Hub LTDA",
            ),
            kind: "company",
            documentNumberMasked: textField(null, "Documento não visível"),
            email: textField(null, "E-mail não visível"),
            phone: textField(null, "Telefone não visível"),
            address: textField(null, "Endereço não visível"),
         },
      ],
      dates: [],
      monetaryTerms: [],
      operationalFlags: [],
      obligations: [],
      signatures: [],
      findings: [],
   };
}

beforeAll(async () => {
   await llmMock.start();
   process.env.OPENROUTER_BASE_URL = `${llmMock.url}/v1`;
   process.env.OPENROUTER_API_KEY = "mock";
}, 30_000);

afterAll(async () => {
   await llmMock.stop();
});

beforeEach(async () => {
   vi.clearAllMocks();
   llmMock.clearFixtures();
   llmMock.clearRequests();
   const { initContractsExtractionContext } =
      await import("../src/extraction/contract-ai-extraction");
   initContractsExtractionContext(promptsStub);
});

describe("extractContractWithAi", () => {
   it("extrai PDF sintético com structured output via TanStack AI", async () => {
      const fileName =
         "contrato-saas-crm-nuvem-clara-agencia-horizonte-001.pdf";

      llmMock.onMessage(new RegExp(fileName), {
         content: JSON.stringify({
            ...syntheticBaseExtraction(),
            document: {
               ...syntheticBaseExtraction().document,
               title: textField(
                  "Contrato sintético SaaS CRM",
                  "CONTRATO SINTETICO 001 - SAAS CRM",
               ),
               typeLabel: textField("contrato", "CONTRATO SINTETICO"),
            },
            operationalFlags: [
               {
                  key: "sla_operacional",
                  label: "SLA operacional",
                  value: "SLA 99,5%",
                  confidence: 0.92,
                  evidence: [{ page: 1, quote: "SLA operacional: SLA 99,5%" }],
               },
               {
                  key: "usuarios_ativos",
                  label: "Controle de usuários ativos",
                  value: true,
                  confidence: 0.92,
                  evidence: [{ page: 1, quote: "controle de usuarios ativos" }],
               },
            ],
            monetaryTerms: [
               {
                  label: "Taxa de implantação",
                  amountCents: 123456,
                  currency: "BRL",
                  recurrence: "unique",
                  confidence: 0.9,
                  evidence: [
                     { page: 1, quote: "Taxa de implantacao: R$ 1.234,56" },
                  ],
               },
            ],
            obligations: [
               {
                  type: "operational",
                  title: "Responder incidentes críticos em 2 horas úteis",
                  party: "contratada",
                  triggerEvent: "incidente crítico",
                  offsetDays: null,
                  calendarBasis: null,
                  confidence: 0.9,
                  evidence: [
                     {
                        page: 1,
                        quote: "incidentes criticos devem ter resposta em 2 horas uteis",
                     },
                  ],
               },
            ],
         }),
         systemFingerprint: "fp_contracts_test",
      });

      const { extractContractWithAi } =
         await import("../src/extraction/contract-ai-extraction");

      const output = await extractContractWithAi({
         files: [await loadContractFixture(fileName)],
      });

      expect(output.document.typeLabel.value).toBe("contrato");
      expect(output.operationalFlags.map((flag) => flag.key)).toContain(
         "usuarios_ativos",
      );
      expect(output.monetaryTerms[0]?.amountCents).toBe(123456);
      expect(output.obligations[0]?.party).toBe("contratada");
      expect(promptsStub.get).toHaveBeenCalledWith("contracts-ai-extraction", {
         withMetadata: true,
      });
      expect(llmMock.getRequests()).toHaveLength(1);
   });

   it("extrai DOCX sintético usando o mesmo singleton de prompts", async () => {
      llmMock.onMessage(/contrato-mentoria-sintetico.docx/, {
         content: JSON.stringify({
            ...syntheticBaseExtraction(),
            document: {
               ...syntheticBaseExtraction().document,
               title: textField(
                  "Contrato sintético de mentoria jurídica",
                  "CONTRATO SINTETICO DE MENTORIA JURIDICA",
                  null,
               ),
               typeLabel: textField(
                  "mentoria jurídica",
                  "MENTORIA JURIDICA",
                  null,
               ),
            },
            findings: [
               {
                  severity: "warning",
                  category: "financial",
                  title: "Desconto inconsistente",
                  description:
                     "20% sobre R$ 3.600,00 não resulta em R$ 2.900,00.",
                  suggestedAction: "Revisar valor antes de aprovar.",
                  evidence: [{ page: null, quote: "20% para R$ 2.900,00" }],
               },
            ],
         }),
         systemFingerprint: "fp_contracts_test",
      });

      const { extractContractWithAi } =
         await import("../src/extraction/contract-ai-extraction");

      const output = await extractContractWithAi({
         files: [await loadContractFixture("contrato-mentoria-sintetico.docx")],
      });

      expect(output.document.typeLabel.value).toBe("mentoria jurídica");
      expect(output.findings[0]?.category).toBe("financial");
      expect(promptsStub.compile).toHaveBeenCalled();
      expect(llmMock.getRequests()).toHaveLength(1);
   });
});
