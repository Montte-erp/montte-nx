import { z } from "zod";
import { authenticatedProcedure } from "@core/orpc/server";
import { fetchActiveCnpjData } from "@modules/account/router/cnpj-utils";

export const fetchCnpjData = authenticatedProcedure
   .input(
      z.object({
         cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve conter 14 dígitos"),
      }),
   )
   .handler(async ({ input }) => fetchActiveCnpjData(input.cnpj));
