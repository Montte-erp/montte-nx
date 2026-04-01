import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

type Modulo = Outputs["organizationConfig"]["getModules"][number]["modulo"];

const MODULE_TO_NAV_IDS: Partial<Record<Modulo, string[]>> = {
   CONTAS: ["bank-accounts"],
   CARTOES: ["credit-cards"],
   PLANEJAMENTO: ["goals"],
   RELATORIOS: ["insights", "dashboards"],
   CONTATOS: ["contacts"],
   ESTOQUE: ["inventory"],
   SERVICOS: ["services"],
};

export function useOrganizationModules() {
   const { data } = useSuspenseQuery(
      orpc.organizationConfig.getModules.queryOptions(),
   );

   const disabledNavIds = new Set<string>();
   for (const row of data) {
      if (!row.habilitado) {
         const ids = MODULE_TO_NAV_IDS[row.modulo] ?? [];
         for (const id of ids) {
            disabledNavIds.add(id);
         }
      }
   }

   return {
      modules: data,
      isModuleEnabled: (navItemId: string) => !disabledNavIds.has(navItemId),
   };
}
