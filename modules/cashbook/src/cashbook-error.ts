import { TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";

export const cashbookErrors = defineErrorCatalog("cashbook", {
   BAD_REQUEST: {
      status: 400,
      message: "Requisição inválida em caixa.",
      tags: ["cashbook"],
   },
   CONFLICT: {
      status: 409,
      message: "Conflito em caixa.",
      tags: ["cashbook"],
   },
   FORBIDDEN: {
      status: 403,
      message: "Ação não permitida em caixa.",
      tags: ["cashbook"],
   },
   INTERNAL: {
      status: 500,
      message: "Falha interna em caixa.",
      tags: ["cashbook"],
   },
   NOT_FOUND: {
      status: 404,
      message: "Registro de caixa não encontrado.",
      tags: ["cashbook"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      cashbook: typeof cashbookErrors;
   }
}

type CashbookCatalogError =
   | ReturnType<typeof cashbookErrors.BAD_REQUEST>
   | ReturnType<typeof cashbookErrors.CONFLICT>
   | ReturnType<typeof cashbookErrors.FORBIDDEN>
   | ReturnType<typeof cashbookErrors.INTERNAL>
   | ReturnType<typeof cashbookErrors.NOT_FOUND>;

export class CashbookError extends TaggedError("CashbookError")<{
   error: CashbookCatalogError;
   message: string;
}>() {}
