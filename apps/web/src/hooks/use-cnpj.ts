import { skipToken, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import dayjs from "dayjs";
import { orpc } from "@/integrations/orpc/client";

export function useCnpj(teamId: string | null) {
   const { data: teamData } = useSuspenseQuery(
      teamId
         ? orpc.team.get.queryOptions({ input: { teamId } })
         : { queryKey: ["cnpj-skip"], queryFn: skipToken },
   );

   const { minDate, minDateStr } = useMemo(() => {
      const raw = teamData?.cnpjData?.data_inicio_atividade;
      const parsed = raw ? dayjs(raw) : null;
      if (!parsed?.isValid()) return { minDate: undefined, minDateStr: null };
      return {
         minDate: parsed.toDate(),
         minDateStr: parsed.format("YYYY-MM-DD"),
      };
   }, [teamData?.cnpjData?.data_inicio_atividade]);

   return { data: teamData?.cnpjData, minDate, minDateStr };
}
