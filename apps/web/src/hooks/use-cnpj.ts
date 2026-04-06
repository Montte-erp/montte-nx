import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { orpc } from "@/integrations/orpc/client";

dayjs.extend(customParseFormat);

export type CnpjData = {
   cnpj?: string;
   razao_social?: string;
   nome_fantasia?: string | null;
   cnae_fiscal?: number;
   cnae_fiscal_descricao?: string | null;
   porte?: string | null;
   natureza_juridica?: string | null;
   municipio?: string;
   uf?: string;
   data_inicio_atividade?: string;
   descricao_situacao_cadastral?: string;
};

function parseCnpjRaw(raw: unknown): CnpjData | null {
   if (!raw || typeof raw !== "object") return null;
   return raw as CnpjData;
}

function parseDateOfCreation(raw: string | undefined): {
   minDate: Date | undefined;
   minDateStr: string | null;
} {
   if (!raw) return { minDate: undefined, minDateStr: null };
   const formats = ["DD/MM/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"];
   for (const fmt of formats) {
      const d = dayjs(raw, fmt, true);
      if (d.isValid()) {
         const minDateStr = d.format("YYYY-MM-DD");
         return { minDate: d.toDate(), minDateStr };
      }
   }
   return { minDate: undefined, minDateStr: null };
}

export function useCnpj(teamId: string | null): {
   data: CnpjData | null;
   minDate: Date | undefined;
   minDateStr: string | null;
} {
   const { data: teamData } = useQuery({
      ...orpc.team.get.queryOptions({ input: { teamId: teamId ?? "" } }),
      enabled: !!teamId,
   });

   const data = parseCnpjRaw(teamData?.cnpjData);
   const { minDate, minDateStr } = parseDateOfCreation(
      data?.data_inicio_atividade,
   );

   return { data, minDate, minDateStr };
}
