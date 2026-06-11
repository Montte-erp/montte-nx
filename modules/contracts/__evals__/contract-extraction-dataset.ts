import { readFileSync } from "node:fs";
import { join } from "node:path";

export type GoldenCase = {
   id: string;
   inputFiles: Array<string>;
   sourceText: string;
   expected: {
      titleIncludes: Array<string>;
      typeIncludes: Array<string>;
      parties: Array<{ roleIncludes: string; nameIncludes: string }>;
      monetaryTerms: Array<{
         labelIncludes: string;
         amountCents: number;
         recurrenceIncludes?: string;
      }>;
      dates: Array<{ labelIncludes: string; valueIncludes: string }>;
      obligations: Array<{
         partyIncludes: string;
         titleIncludes: Array<string>;
         offsetDays?: number;
         calendarBasis?: "business_days" | "calendar_days" | "unknown";
      }>;
      operationalFlags: Array<{ labelIncludes: Array<string> }>;
      signatures: Array<{
         signerIncludes?: string;
         providerIncludes?: string;
         statusIncludes?: string;
      }>;
      findings: Array<{
         categoryIncludes: Array<string>;
         titleOrDescriptionIncludes: Array<string>;
         severity?: "info" | "warning" | "risk" | "critical";
      }>;
      forbidden: Array<string>;
   };
};

type DatasetRow = {
   id: string;
   document: {
      files: Array<string>;
      text: string;
   };
   expected: GoldenCase["expected"];
};

const datasetPath = join(
   import.meta.dirname,
   "dataset",
   "contract-extraction-stress.pt-BR.jsonl",
);

function parseDatasetRow(line: string) {
   const row = JSON.parse(line) as DatasetRow;

   return {
      id: row.id,
      inputFiles: row.document.files,
      sourceText: row.document.text,
      expected: row.expected,
   } satisfies GoldenCase;
}

export const goldenCases = readFileSync(datasetPath, "utf8")
   .trim()
   .split("\n")
   .filter(Boolean)
   .map(parseDatasetRow);
