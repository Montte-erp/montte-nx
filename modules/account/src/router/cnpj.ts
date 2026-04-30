import { errAsync, fromPromise, fromThrowable, okAsync } from "neverthrow";
import { z } from "zod";
import { cnpjDataSchema } from "@core/authentication/server";
import { WebAppError } from "@core/logging/errors";
import { authenticatedProcedure } from "@core/orpc/server";

const FETCH_ERROR = WebAppError.internal(
   "Não foi possível consultar o CNPJ. Tente novamente.",
);
const NOT_FOUND_ERROR = WebAppError.notFound(
   "CNPJ não encontrado ou inválido.",
);
const INACTIVE_ERROR = WebAppError.badRequest(
   "Este CNPJ não está ativo na Receita Federal.",
);

const parseCnpjData = fromThrowable(cnpjDataSchema.parse, () => FETCH_ERROR);

const fetchBrasilApi = (cnpj: string) =>
   fromPromise(
      fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
         signal: AbortSignal.timeout(10000),
         headers: { "User-Agent": "Montte-ERP/1.0" },
      }),
      () => FETCH_ERROR,
   );

const readJson = (res: Response) =>
   res.ok
      ? fromPromise(res.json(), () => FETCH_ERROR)
      : errAsync(res.status === 404 ? NOT_FOUND_ERROR : FETCH_ERROR);

export const fetchCnpjData = authenticatedProcedure
   .input(
      z.object({
         cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve conter 14 dígitos"),
      }),
   )
   .handler(async ({ input }) => {
      const result = await fetchBrasilApi(input.cnpj)
         .andThen(readJson)
         .andThen(parseCnpjData)
         .andThen((data) =>
            data.descricao_situacao_cadastral === "ATIVA"
               ? okAsync(data)
               : errAsync(INACTIVE_ERROR),
         );
      if (result.isErr()) throw result.error;
      return result.value;
   });
