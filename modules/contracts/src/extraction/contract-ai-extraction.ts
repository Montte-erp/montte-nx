import {
   chat,
   type DocumentPart,
   type ImagePart,
   type TextPart,
} from "@tanstack/ai";
import type { Prompts } from "@core/posthog/server";
import { fileModel } from "@core/ai/models";
import { strFromU8, unzipSync } from "fflate";
import { z } from "zod";

export const CONTRACT_AI_EXTRACTION_PROMPT = "contracts-ai-extraction";

type ContractsPrompts = Pick<Prompts, "compile" | "get">;

let contractsPrompts: ContractsPrompts | null = null;

export function initContractsExtractionContext(prompts: ContractsPrompts) {
   contractsPrompts = prompts;
}

function getContractsPrompts() {
   if (contractsPrompts) return contractsPrompts;
   throw new Error("Prompts de contratos não foram inicializados.");
}

type ContractContentPart = TextPart | DocumentPart | ImagePart;

const evidenceSchema = z.object({
   page: z.number().int().positive().nullable(),
   quote: z.string().min(1),
});

const extractedTextSchema = z.object({
   value: z.string().nullable(),
   confidence: z.number().min(0).max(1),
   evidence: z.array(evidenceSchema),
   warnings: z.array(z.string()),
});

const extractedBooleanSchema = z.object({
   value: z.union([z.boolean(), z.string()]).nullable(),
   confidence: z.number().min(0).max(1),
   evidence: z.array(evidenceSchema),
   warnings: z.array(z.string()),
});

export const contractAiExtractionSchema = z.object({
   document: z.object({
      title: extractedTextSchema,
      typeLabel: extractedTextSchema,
      summary: extractedTextSchema,
      pageCount: z.object({
         value: z.number().int().positive().nullable(),
         confidence: z.number().min(0).max(1),
         evidence: z.array(evidenceSchema),
         warnings: z.array(z.string()),
      }),
      hasAttachments: extractedBooleanSchema,
      sensitiveDataCategories: z.array(z.string()),
   }),
   parties: z.array(
      z.object({
         role: z.string().min(1),
         name: extractedTextSchema,
         kind: z.enum(["person", "company", "unknown"]),
         documentNumberMasked: extractedTextSchema,
         email: extractedTextSchema,
         phone: extractedTextSchema,
         address: extractedTextSchema,
      }),
   ),
   dates: z.array(
      z.object({
         label: z.string().min(1),
         value: extractedTextSchema,
      }),
   ),
   monetaryTerms: z.array(
      z.object({
         label: z.string().min(1),
         amountCents: z.number().int().nullable(),
         currency: z.string().nullable(),
         recurrence: z.string().nullable(),
         confidence: z.number().min(0).max(1),
         evidence: z.array(evidenceSchema),
      }),
   ),
   operationalFlags: z.array(
      z.object({
         key: z.string().min(1),
         label: z.string().min(1),
         value: z.union([z.boolean(), z.string()]).nullable(),
         confidence: z.number().min(0).max(1),
         evidence: z.array(evidenceSchema),
      }),
   ),
   obligations: z.array(
      z.object({
         type: z.string().min(1),
         title: z.string().min(1),
         party: z.string().min(1),
         triggerEvent: z.string().nullable(),
         offsetDays: z.number().int().nullable(),
         calendarBasis: z
            .enum(["business_days", "calendar_days", "unknown"])
            .nullable(),
         confidence: z.number().min(0).max(1),
         evidence: z.array(evidenceSchema),
      }),
   ),
   signatures: z.array(
      z.object({
         kind: z.string().min(1),
         signerName: z.string().nullable(),
         provider: z.string().nullable(),
         signedAt: z.string().nullable(),
         confidence: z.number().min(0).max(1),
         evidence: z.array(evidenceSchema),
      }),
   ),
   findings: z.array(
      z.object({
         severity: z.enum(["info", "warning", "risk", "critical"]),
         category: z.string().min(1),
         title: z.string().min(1),
         description: z.string(),
         suggestedAction: z.string().nullable(),
         evidence: z.array(evidenceSchema),
      }),
   ),
});

export const contractAiExtractionInputSchema = z.object({
   files: z
      .array(
         z.object({
            fileName: z.string().min(1),
            mimeType: z.string().min(1),
            dataBase64: z.string().min(1),
         }),
      )
      .min(1),
});

function extractDocxText(dataBase64: string) {
   const zip = unzipSync(Buffer.from(dataBase64, "base64"));
   const documentXml = zip["word/document.xml"];
   if (!documentXml) return null;

   return strFromU8(documentXml)
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
}

function buildFileContent(
   file: z.infer<typeof contractAiExtractionInputSchema>["files"][number],
): Array<ContractContentPart> {
   const header: TextPart = {
      type: "text",
      content: `Arquivo: ${file.fileName} (${file.mimeType})`,
   };

   if (
      file.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
   ) {
      const text = extractDocxText(file.dataBase64);
      return [
         header,
         {
            type: "text",
            content: text
               ? `Texto extraído do DOCX ${file.fileName}:\n\n${text}`
               : `Não foi possível extrair texto do DOCX ${file.fileName}.`,
         },
      ];
   }

   if (file.mimeType.startsWith("image/")) {
      return [
         header,
         {
            type: "image",
            source: {
               type: "data",
               value: file.dataBase64,
               mimeType: file.mimeType,
            },
         },
      ];
   }

   return [
      header,
      {
         type: "document",
         source: {
            type: "data",
            value: file.dataBase64,
            mimeType: file.mimeType,
         },
      },
   ];
}

function buildContent(
   input: z.infer<typeof contractAiExtractionInputSchema>,
): Array<ContractContentPart> {
   return [
      {
         type: "text",
         content:
            "Extraia dados operacionais de contrato dos arquivos anexados. Não limite a extração a um tipo específico de contrato.",
      },
      ...input.files.flatMap((file) => buildFileContent(file)),
   ];
}

export async function extractContractWithAi(
   input: z.infer<typeof contractAiExtractionInputSchema>,
) {
   const prompts = getContractsPrompts();
   const prompt = await prompts.get(CONTRACT_AI_EXTRACTION_PROMPT, {
      withMetadata: true,
   });

   return chat({
      adapter: fileModel,
      systemPrompts: [prompts.compile(prompt.prompt, {})],
      messages: [{ role: "user", content: buildContent(input) }],
      outputSchema: contractAiExtractionSchema,
      stream: false,
      modelOptions: {
         temperature: 0,
         reasoning: { effort: "low" },
      },
   });
}
