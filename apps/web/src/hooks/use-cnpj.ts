import { skipToken, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { orpc } from "@/integrations/orpc/client";

export function useCnpj(teamId: string | null) {
   const { data: teamData } = useSuspenseQuery(
      teamId
         ? orpc.team.get.queryOptions({ input: { teamId } })
         : { queryKey: ["cnpj-skip"], queryFn: skipToken },
   );

   const cnpjData = teamData?.cnpjData ?? null;
   const raw = cnpjData?.data_inicio_atividade ?? null;
   const parsed = raw ? dayjs(raw) : null;
   const minDate = parsed?.isValid() ? parsed.toDate() : undefined;
   const minDateStr = parsed?.isValid() ? parsed.format("YYYY-MM-DD") : null;

   return { data: cnpjData, minDate, minDateStr };
}
