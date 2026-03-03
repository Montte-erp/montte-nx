import { AddonName } from "@packages/stripe/constants";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc } from "@/integrations/orpc/client";

export function useHasAddon(addonName: AddonName): boolean {
   const { data } = useSuspenseQuery(
      orpc.organization.hasAddon.queryOptions({
         input: { addonId: addonName },
      }),
   );

   return data.hasAddon;
}

export function useAddons() {
   const { data: addons } = useSuspenseQuery(
      orpc.organization.getAddons.queryOptions({}),
   );

   const addonSet = useMemo(
      () => new Set(addons.map((a) => a.addonId)),
      [addons],
   );

   return {
      addons,
      hasAddon: (addonName: AddonName) => addonSet.has(addonName),
      hasBoost: addonSet.has(AddonName.BOOST),
      hasScale: addonSet.has(AddonName.SCALE),
      hasEnterprise: addonSet.has(AddonName.ENTERPRISE),
   };
}
