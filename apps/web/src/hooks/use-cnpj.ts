import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { orpc, type Outputs } from "@/integrations/orpc/client";

type CnpjData = NonNullable<Outputs["team"]["get"]["cnpjData"]>;

function extractDataInicio(value: CnpjData): string | undefined {
   if (typeof value !== "object" || value === null) return undefined;
   if (!("data_inicio_atividade" in value)) return undefined;
   const raw = value.data_inicio_atividade;
   if (typeof raw !== "string") return undefined;
   return raw;
}

export function useCnpj(teamId: string | null) {
   const { data: teamData } = useQuery({
      ...orpc.team.get.queryOptions({ input: { teamId: teamId ?? "" } }),
      enabled: !!teamId,
   });

   const cnpjData = teamData?.cnpjData ?? null;
   const raw = cnpjData !== null ? extractDataInicio(cnpjData) : undefined;

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
