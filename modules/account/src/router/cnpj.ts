import { Result } from "better-result";
import { z } from "zod";
import { cnpjDataSchema } from "@core/authentication/server";
import { authenticatedProcedure } from "@core/orpc/server";
import { AccountError, accountErrors } from "@modules/account/router/errors";

const fetchBrasilApi = (cnpj: string) =>
   Result.tryPromise({
      try: () =>
         fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": "Montte-ERP/1.0" },
         }),
      catch: () =>
         new AccountError({
            error: accountErrors.INTERNAL(),
            message: "Não foi possível consultar o CNPJ. Tente novamente.",
         }),
   });

const readJson = (response: Response) =>
   Result.tryPromise({
      try: () => response.json(),
      catch: () =>
         new AccountError({
            error: accountErrors.INTERNAL(),
            message: "Não foi possível consultar o CNPJ. Tente novamente.",
         }),
   });

export const fetchCnpjData = authenticatedProcedure
   .input(
      z.object({
         cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve conter 14 dígitos"),
      }),
   )
   .handler(async ({ input }) => {
      const responseResult = await fetchBrasilApi(input.cnpj);
      if (responseResult.isErr()) throw responseResult.error;

      const response = responseResult.value;
      if (!response.ok) {
         if (response.status === 404) {
            throw new AccountError({
               error: accountErrors.NOT_FOUND(),
               message: "CNPJ não encontrado ou inválido.",
            });
         }

         throw new AccountError({
            error: accountErrors.INTERNAL(),
            message: "Não foi possível consultar o CNPJ. Tente novamente.",
         });
      }

      const payloadResult = await readJson(response);
      if (payloadResult.isErr()) throw payloadResult.error;

      const parsedResult = await Result.try({
         try: () => cnpjDataSchema.parse(payloadResult.value),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Não foi possível consultar o CNPJ. Tente novamente.",
            }),
      });
      if (parsedResult.isErr()) throw parsedResult.error;

      if (parsedResult.value.descricao_situacao_cadastral === "ATIVA") {
         return parsedResult.value;
      }

      throw new AccountError({
         error: accountErrors.BAD_REQUEST(),
         message: "Este CNPJ não está ativo na Receita Federal.",
      });
   });
