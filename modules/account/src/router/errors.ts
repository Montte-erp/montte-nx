import { TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";

export const accountErrors = defineErrorCatalog("account", {
   BAD_REQUEST: {
      status: 400,
      message: "Requisição inválida no módulo de conta.",
      tags: ["account"],
   },
   UNAUTHORIZED: {
      status: 401,
      message: "Acesso não autorizado no módulo de conta.",
      tags: ["account"],
   },
   FORBIDDEN: {
      status: 403,
      message: "Acesso negado no módulo de conta.",
      tags: ["account"],
   },
   NOT_FOUND: {
      status: 404,
      message: "Recurso não encontrado no módulo de conta.",
      tags: ["account"],
   },
   INTERNAL: {
      status: 500,
      message: "Falha interna no módulo de conta.",
      tags: ["account"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      account: typeof accountErrors;
   }
}

type AccountCatalogError =
   | ReturnType<typeof accountErrors.BAD_REQUEST>
   | ReturnType<typeof accountErrors.UNAUTHORIZED>
   | ReturnType<typeof accountErrors.FORBIDDEN>
   | ReturnType<typeof accountErrors.NOT_FOUND>
   | ReturnType<typeof accountErrors.INTERNAL>;

export class AccountError extends TaggedError("AccountError")<{
   error: AccountCatalogError;
   message: string;
   organizationId?: string;
   teamId?: string;
   userId?: string;
   token?: string;
}>() {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
   typeof value === "object" && value !== null;

export const getErrorField = (
   value: unknown,
   field: string,
): string | number | undefined => {
   if (!isRecord(value)) return undefined;
   const candidate = value[field];
   if (typeof candidate === "string" || typeof candidate === "number") {
      return candidate;
   }
   return undefined;
};

export const toAuthError = (
   error: unknown,
   unauthorizedMessage: string,
   forbiddenMessage?: string,
   fallbackMessage?: string,
) => {
   const status = getErrorField(error, "status");
   const statusCode = getErrorField(error, "statusCode");

   if (status === "UNAUTHORIZED" || statusCode === 401) {
      return new AccountError({
         error: accountErrors.UNAUTHORIZED(),
         message: unauthorizedMessage,
      });
   }

   if (status === "FORBIDDEN" || statusCode === 403) {
      return new AccountError({
         error: accountErrors.FORBIDDEN(),
         message: forbiddenMessage ?? unauthorizedMessage,
      });
   }

   return new AccountError({
      error: accountErrors.INTERNAL(),
      message: fallbackMessage ?? "Falha no módulo de conta.",
   });
};
