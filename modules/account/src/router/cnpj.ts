import { ResultAsync, errAsync, fromThrowable, okAsync } from "neverthrow";
import { z } from "zod";
import { cnpjDataSchema } from "@core/authentication/server";
import { WebAppError } from "@core/logging/errors";
import { authenticatedProcedure } from "@core/orpc/server";

const FETCH_ERROR = "Não foi possível consultar o CNPJ. Tente novamente.";
const STATUS_ERRORS: Partial<Record<number, WebAppError>> = {
   404: WebAppError.notFound("CNPJ não encontrado ou inválido."),
};

const parseCnpjData = fromThrowable(cnpjDataSchema.parse, () =>
   WebAppError.internal(FETCH_ERROR),
);

export const fetchCnpjData = authenticatedProcedure
   .input(
      z.object({
         cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve conter 14 dígitos"),
      }),
   )
   .handler(({ input }) =>
      ResultAsync.fromPromise(
         fetch(`https://brasilapi.com.br/api/cnpj/v1/${input.cnpj}`, {
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": "Montte-ERP/1.0" },
         }),
         () => WebAppError.internal(FETCH_ERROR),
      )
         .andThen((res) =>
            res.ok
               ? ResultAsync.fromPromise(res.json(), () =>
                    WebAppError.internal(FETCH_ERROR),
                 )
               : errAsync(
                    STATUS_ERRORS[res.status] ??
                       WebAppError.internal(FETCH_ERROR),
                 ),
         )
         .andThen(parseCnpjData)
         .andThen((data) =>
            data.descricao_situacao_cadastral === "ATIVA"
               ? okAsync(data)
               : errAsync(
                    WebAppError.badRequest(
                       "Este CNPJ não está ativo na Receita Federal.",
                    ),
                 ),
         )
         .match(
            (data) => data,
            (error) => {
               throw error;
            },
         ),
   );
