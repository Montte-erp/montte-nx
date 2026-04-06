import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { orpc } from "@/integrations/orpc/client";

type CnpjData = {
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

function isCnpjData(value: unknown): value is CnpjData {
   return typeof value === "object" && value !== null;
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

   const cnpjData = isCnpjData(teamData?.cnpjData) ? teamData.cnpjData : null;
   const raw = cnpjData?.data_inicio_atividade;

   let minDate: Date | undefined;
   let minDateStr: string | null = null;
   if (raw) {
      for (const fmt of ["DD/MM/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"]) {
         const d = dayjs(raw, fmt, true);
         if (d.isValid()) {
            minDateStr = d.format("YYYY-MM-DD");
            minDate = d.toDate();
            break;
         }
      }
   }

   return { data: cnpjData, minDate, minDateStr };
}
