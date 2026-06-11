import { readFile } from "node:fs/promises";
import { join } from "node:path";

const fixtureDir = join(import.meta.dirname, "..", "fixtures", "contracts");

const mimeTypes = {
   pdf: "application/pdf",
   docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export type ContractFixtureName =
   | "contrato-mentoria-sintetico.docx"
   | `contrato-${string}.pdf`;

export async function loadContractFixture(fileName: ContractFixtureName) {
   const file = await readFile(join(fixtureDir, fileName));
   const extension = fileName.endsWith(".pdf") ? "pdf" : "docx";

   return {
      fileName,
      mimeType: mimeTypes[extension],
      dataBase64: file.toString("base64"),
   };
}
